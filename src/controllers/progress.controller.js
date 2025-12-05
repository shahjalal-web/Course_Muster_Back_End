// controllers/progressController.js
const mongoose = require("mongoose");
const Course =
  require("../model/course.model").default || require("../model/course.model");
const Lesson =
  require("../model/lesson.model").default || require("../model/lesson.model");
const StudentLessonProgress = require("../model/StudentLessonProgress");

// Helper to compare student id in purchases (handles ObjectId or string)
const purchaseMatchesUser = (p, userId) => {
  if (!p) return false;
  if (!p.student) return false;
  try {
    // p.student may be an ObjectId or string or object like { $oid: '...' }
    const pid =
      typeof p.student === "object" && p.student !== null && p.student.toString
        ? p.student.toString()
        : String(p.student);
    return pid === String(userId);
  } catch (e) {
    return false;
  }
};

// normalize id to string
const toStr = (v) => (v && v.toString ? v.toString() : String(v || ""));

const getProgressForStudent = async (req, res) => {
  try {
    const userId = req.user.id;
    if (!userId) return res.status(400).json({ error: "userId missing" });

    // Step 1: fetch candidate courses.
    let courses = [];
    try {
      // try matching purchases.student as ObjectId
      courses = await Course.find({
        "purchases.student": mongoose.Types.ObjectId(userId),
      }).lean();
    } catch (e) {
      // fallback: fetch all and filter in JS (handles string-stored student ids)
      courses = await Course.find({}).lean();
      courses = courses.filter((c) =>
        (c.purchases || []).some((p) => purchaseMatchesUser(p, userId))
      );
    }

    if (!courses || courses.length === 0) {
      return res.json({
        courses: [],
        overall: {
          totalLessons: 0,
          lessonsCompleted: 0,
          lessonsRemaining: 0,
          quizzesTaken: 0,
          assignmentsSubmitted: 0,
          avgQuizScore: null,
          quizBuckets: [
            { name: "0-49", value: 0 },
            { name: "50-69", value: 0 },
            { name: "70-89", value: 0 },
            { name: "90-100", value: 0 },
          ],
        },
      });
    }

    const resultCourses = [];
    // overall accumulators
    let totalLessonsAll = 0;
    let lessonsCompletedAll = 0;
    let quizzesTakenAll = 0;
    let quizScoreSum = 0;
    let quizScoreCount = 0;
    let assignmentsSubmittedAll = 0;
    const quizBuckets = [
      { name: "0-49", value: 0 },
      { name: "50-69", value: 0 },
      { name: "70-89", value: 0 },
      { name: "90-100", value: 0 },
    ];

    // For each course, we might have multiple purchases by this user.
    for (const course of courses) {
      const courseIdStr = toStr(course._id);
      // collect all matching purchase entries for this user (could be multiple)
      const matchingPurchases = (course.purchases || []).filter((p) =>
        purchaseMatchesUser(p, userId)
      );

      // Fetch lessons for this course ONCE
      const lessons = await Lesson.find({ course: course._id }).lean();

      // Pre-calc lesson counts (videos/quizzes/assignments) regardless of purchase/batch
      const lessonCounts = {
        total: lessons.length,
        videos: 0,
        quizzes: 0,
        assignments: 0,
      };
      for (const ls of lessons) {
        if (
          (ls.type && ls.type === "video") ||
          (ls.videoUrl && String(ls.videoUrl).trim() !== "")
        )
          lessonCounts.videos += 1;
        if (
          (ls.type && ls.type === "quiz") ||
          (ls.quizPayload && Object.keys(ls.quizPayload || {}).length > 0)
        )
          lessonCounts.quizzes += 1;
        if (
          (ls.type && ls.type === "assignment") ||
          (ls.assignmentInstructions &&
            String(ls.assignmentInstructions).trim() !== "")
        )
          lessonCounts.assignments += 1;
      }
      totalLessonsAll += lessonCounts.total;

      // fetch all StudentLessonProgress entries for this user AND these lessons in one query
      const lessonIds = lessons.map((l) => l._id);
      const progressDocs = await StudentLessonProgress.find({
        userId: String(userId),
        lessonId: { $in: lessonIds },
        // don't require courseId here; sometimes courseId stored differently,
        // we'll filter by lessonId map below which is authoritative
      }).lean();

      // map progress by lessonId string
      const progMap = {};
      for (const p of progressDocs) {
        progMap[toStr(p.lessonId)] = p;
      }

      // For each matching purchase we will create a separate result entry
      for (const purchaseItem of matchingPurchases) {
        // Per-purchase accumulators
        let completedCount = 0;
        let courseQuizzesTaken = 0;
        let courseQuizScoreSum = 0;
        let courseQuizScoreCount = 0;
        let courseAssignmentsSubmitted = 0;
        const quizzesDetails = [];

        // Optionally: if purchaseItem contains batchId or batchName and you want to restrict lessons to that batch,
        // you can filter lessons by lesson.batchId === purchaseItem.batchId. For now we will include all lessons of the course,
        // but mark the batchName in the purchase info.
        const filteredLessons = lessons.filter((ls) => {
          // if purchase has batchId and lesson has batchId, match them; otherwise include all
          if (purchaseItem.batchId && ls.batchId) {
            return String(ls.batchId) === String(purchaseItem.batchId);
          }
          return true;
        });

        // iterate lessons and build progress / quizzes detail
        for (const lesson of filteredLessons) {
          const lid = toStr(lesson._id);
          const prog = progMap[lid];

          // status completed
          if (prog && prog.status === "completed") {
            completedCount += 1;
            lessonsCompletedAll += 1;
          }

          // quiz handling: include every quiz-type lesson in the UI (attempted or not)
          const isQuizLesson =
            (lesson.type && lesson.type === "quiz") ||
            (lesson.quizPayload &&
              Object.keys(lesson.quizPayload || {}).length > 0);

          if (isQuizLesson) {
            const quizObj = prog && prog.quiz ? prog.quiz : null;
            const hasScore = quizObj && typeof quizObj.score === "number";
            const hasDetails =
              quizObj &&
              Array.isArray(quizObj.detailed) &&
              quizObj.detailed.length > 0;
            const attempted = !!(
              quizObj &&
              (quizObj.attempted === true || hasScore || hasDetails)
            );

            // Determine score value (if present)
            const score = hasScore ? quizObj.score : null;

            // If we consider this quiz as attempted (by above heuristic), count it
            if (attempted) {
              courseQuizzesTaken += 1;
              quizzesTakenAll += 1;

              if (hasScore) {
                courseQuizScoreSum += score;
                courseQuizScoreCount += 1;
                quizScoreSum += score;
                quizScoreCount += 1;

                // Bucket the score only when numeric score exists
                const s = score;
                if (s < 50) quizBuckets[0].value += 1;
                else if (s < 70) quizBuckets[1].value += 1;
                else if (s < 90) quizBuckets[2].value += 1;
                else quizBuckets[3].value += 1;
              }
            }

            quizzesDetails.push({
              lessonId: lesson._id,
              title: lesson.title || `Lesson ${lesson.lessonNumber || ""}`,
              attempted,
              score,
              detailed: quizObj ? quizObj.detailed || [] : [],
            });
          }

          // assignment handling
          if (prog && prog.assignment && prog.assignment.submitted) {
            courseAssignmentsSubmitted += 1;
            assignmentsSubmittedAll += 1;
          }
        } // end lessons loop per purchase

        const avgQuizScore = courseQuizScoreCount
          ? Math.round((courseQuizScoreSum / courseQuizScoreCount) * 100) / 100
          : null;

        resultCourses.push({
          courseId: courseIdStr,
          title: course.title,
          thumbnail: course.thumbnail,
          // for batchName prefer purchase-provided batchName / batchId; else fallback to course batches
          batchName:
            purchaseItem?.batchName ||
            purchaseItem?.batchId ||
            (course.batches && course.batches[0]?.name) ||
            "",
          purchasedAt:
            purchaseItem?.purchasedAt ||
            purchaseItem?.purchasedAt?.$date ||
            null,
          lessonCounts,
          progress: {
            completed: completedCount,
            remaining: Math.max(0, lessonCounts.total - completedCount),
          },
          assessments: {
            quizzesTaken: courseQuizzesTaken,
            avgQuizScore,
            assignmentsSubmitted: courseAssignmentsSubmitted,
          },
          quizzes: quizzesDetails,
          rawPurchase: {
            _id: purchaseItem?._id || null,
            student: purchaseItem?.student || null,
          },
        });
      } // end purchases loop for this course
    } // end courses loop

    const overall = {
      totalLessons: totalLessonsAll,
      lessonsCompleted: lessonsCompletedAll,
      lessonsRemaining: Math.max(0, totalLessonsAll - lessonsCompletedAll),
      quizzesTaken: quizzesTakenAll,
      assignmentsSubmitted: assignmentsSubmittedAll,
      avgQuizScore: quizScoreCount
        ? Math.round((quizScoreSum / quizScoreCount) * 100) / 100
        : null,
      quizBuckets,
    };

    return res.json({ courses: resultCourses, overall });
  } catch (err) {
    console.error("progressController error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const getProgressForadmin = async (req, res) => {
  try {
    const userId = req.params?.userId;
    console.log(userId, "hello")
    if (!userId) return res.status(400).json({ error: "userId missing" });

    // Step 1: fetch candidate courses.
    let courses = [];
    try {
      // try matching purchases.student as ObjectId
      courses = await Course.find({
        "purchases.student": mongoose.Types.ObjectId(userId),
      }).lean();
    } catch (e) {
      // fallback: fetch all and filter in JS (handles string-stored student ids)
      courses = await Course.find({}).lean();
      courses = courses.filter((c) =>
        (c.purchases || []).some((p) => purchaseMatchesUser(p, userId))
      );
    }

    if (!courses || courses.length === 0) {
      return res.json({
        courses: [],
        overall: {
          totalLessons: 0,
          lessonsCompleted: 0,
          lessonsRemaining: 0,
          quizzesTaken: 0,
          assignmentsSubmitted: 0,
          avgQuizScore: null,
          quizBuckets: [
            { name: "0-49", value: 0 },
            { name: "50-69", value: 0 },
            { name: "70-89", value: 0 },
            { name: "90-100", value: 0 },
          ],
        },
      });
    }

    const resultCourses = [];
    // overall accumulators
    let totalLessonsAll = 0;
    let lessonsCompletedAll = 0;
    let quizzesTakenAll = 0;
    let quizScoreSum = 0;
    let quizScoreCount = 0;
    let assignmentsSubmittedAll = 0;
    const quizBuckets = [
      { name: "0-49", value: 0 },
      { name: "50-69", value: 0 },
      { name: "70-89", value: 0 },
      { name: "90-100", value: 0 },
    ];

    // For each course, we might have multiple purchases by this user.
    for (const course of courses) {
      const courseIdStr = toStr(course._id);
      // collect all matching purchase entries for this user (could be multiple)
      const matchingPurchases = (course.purchases || []).filter((p) =>
        purchaseMatchesUser(p, userId)
      );

      // Fetch lessons for this course ONCE
      const lessons = await Lesson.find({ course: course._id }).lean();

      // Pre-calc lesson counts (videos/quizzes/assignments) regardless of purchase/batch
      const lessonCounts = {
        total: lessons.length,
        videos: 0,
        quizzes: 0,
        assignments: 0,
      };
      for (const ls of lessons) {
        if (
          (ls.type && ls.type === "video") ||
          (ls.videoUrl && String(ls.videoUrl).trim() !== "")
        )
          lessonCounts.videos += 1;
        if (
          (ls.type && ls.type === "quiz") ||
          (ls.quizPayload && Object.keys(ls.quizPayload || {}).length > 0)
        )
          lessonCounts.quizzes += 1;
        if (
          (ls.type && ls.type === "assignment") ||
          (ls.assignmentInstructions &&
            String(ls.assignmentInstructions).trim() !== "")
        )
          lessonCounts.assignments += 1;
      }
      totalLessonsAll += lessonCounts.total;

      // fetch all StudentLessonProgress entries for this user AND these lessons in one query
      const lessonIds = lessons.map((l) => l._id);
      const progressDocs = await StudentLessonProgress.find({
        userId: String(userId),
        lessonId: { $in: lessonIds },
        // don't require courseId here; sometimes courseId stored differently,
        // we'll filter by lessonId map below which is authoritative
      }).lean();

      // map progress by lessonId string
      const progMap = {};
      for (const p of progressDocs) {
        progMap[toStr(p.lessonId)] = p;
      }

      // For each matching purchase we will create a separate result entry
      for (const purchaseItem of matchingPurchases) {
        // Per-purchase accumulators
        let completedCount = 0;
        let courseQuizzesTaken = 0;
        let courseQuizScoreSum = 0;
        let courseQuizScoreCount = 0;
        let courseAssignmentsSubmitted = 0;
        const quizzesDetails = [];

        // Optionally: if purchaseItem contains batchId or batchName and you want to restrict lessons to that batch,
        // you can filter lessons by lesson.batchId === purchaseItem.batchId. For now we will include all lessons of the course,
        // but mark the batchName in the purchase info.
        const filteredLessons = lessons.filter((ls) => {
          // if purchase has batchId and lesson has batchId, match them; otherwise include all
          if (purchaseItem.batchId && ls.batchId) {
            return String(ls.batchId) === String(purchaseItem.batchId);
          }
          return true;
        });

        // iterate lessons and build progress / quizzes detail
        for (const lesson of filteredLessons) {
          const lid = toStr(lesson._id);
          const prog = progMap[lid];

          // status completed
          if (prog && prog.status === "completed") {
            completedCount += 1;
            lessonsCompletedAll += 1;
          }

          // quiz handling: include every quiz-type lesson in the UI (attempted or not)
          const isQuizLesson =
            (lesson.type && lesson.type === "quiz") ||
            (lesson.quizPayload &&
              Object.keys(lesson.quizPayload || {}).length > 0);

          if (isQuizLesson) {
            const quizObj = prog && prog.quiz ? prog.quiz : null;
            const hasScore = quizObj && typeof quizObj.score === "number";
            const hasDetails =
              quizObj &&
              Array.isArray(quizObj.detailed) &&
              quizObj.detailed.length > 0;
            const attempted = !!(
              quizObj &&
              (quizObj.attempted === true || hasScore || hasDetails)
            );

            // Determine score value (if present)
            const score = hasScore ? quizObj.score : null;

            // If we consider this quiz as attempted (by above heuristic), count it
            if (attempted) {
              courseQuizzesTaken += 1;
              quizzesTakenAll += 1;

              if (hasScore) {
                courseQuizScoreSum += score;
                courseQuizScoreCount += 1;
                quizScoreSum += score;
                quizScoreCount += 1;

                // Bucket the score only when numeric score exists
                const s = score;
                if (s < 50) quizBuckets[0].value += 1;
                else if (s < 70) quizBuckets[1].value += 1;
                else if (s < 90) quizBuckets[2].value += 1;
                else quizBuckets[3].value += 1;
              }
            }

            quizzesDetails.push({
              lessonId: lesson._id,
              title: lesson.title || `Lesson ${lesson.lessonNumber || ""}`,
              attempted,
              score,
              detailed: quizObj ? quizObj.detailed || [] : [],
            });
          }

          // assignment handling
          if (prog && prog.assignment && prog.assignment.submitted) {
            courseAssignmentsSubmitted += 1;
            assignmentsSubmittedAll += 1;
          }
        } // end lessons loop per purchase

        const avgQuizScore = courseQuizScoreCount
          ? Math.round((courseQuizScoreSum / courseQuizScoreCount) * 100) / 100
          : null;

        resultCourses.push({
          courseId: courseIdStr,
          title: course.title,
          thumbnail: course.thumbnail,
          // for batchName prefer purchase-provided batchName / batchId; else fallback to course batches
          batchName:
            purchaseItem?.batchName ||
            purchaseItem?.batchId ||
            (course.batches && course.batches[0]?.name) ||
            "",
          purchasedAt:
            purchaseItem?.purchasedAt ||
            purchaseItem?.purchasedAt?.$date ||
            null,
          lessonCounts,
          progress: {
            completed: completedCount,
            remaining: Math.max(0, lessonCounts.total - completedCount),
          },
          assessments: {
            quizzesTaken: courseQuizzesTaken,
            avgQuizScore,
            assignmentsSubmitted: courseAssignmentsSubmitted,
          },
          quizzes: quizzesDetails,
          rawPurchase: {
            _id: purchaseItem?._id || null,
            student: purchaseItem?.student || null,
          },
        });
      } // end purchases loop for this course
    } // end courses loop

    const overall = {
      totalLessons: totalLessonsAll,
      lessonsCompleted: lessonsCompletedAll,
      lessonsRemaining: Math.max(0, totalLessonsAll - lessonsCompletedAll),
      quizzesTaken: quizzesTakenAll,
      assignmentsSubmitted: assignmentsSubmittedAll,
      avgQuizScore: quizScoreCount
        ? Math.round((quizScoreSum / quizScoreCount) * 100) / 100
        : null,
      quizBuckets,
    };

    return res.json({ courses: resultCourses, overall });
  } catch (err) {
    console.error("progressController error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { getProgressForStudent, getProgressForadmin };
