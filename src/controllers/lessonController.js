// controllers/lessonController.js
const { default: Lesson } = require("../model/lesson.model");
const StudentLessonProgress = require("../model/StudentLessonProgress");
// helper to extract user id from req.authUser or token (tryAuth middleware recommended)
// helper inside your controller file (or import where needed)
function getUserIdFromReq(req) {
  // prefer req.user because your requireAuth sets req.user
  if (req.user && (req.user.id || req.user._id))
    return req.user.id || req.user._id;
  // support legacy/alternate key if present
  if (req.authUser && (req.authUser.id || req.authUser._id))
    return req.authUser.id || req.authUser._id;
  // fallback to body (useful for tests or internal calls)
  if (req.body?.userId) return req.body.userId;
  if (req.body?.user?.id) return req.body.user.id;
  return null;
}

// GET /api/lessons?courseId=...&batchId=...
async function getLessons(req, res) {
  try {
    const { courseId, batchId } = req.query;
    console.log("hello", courseId, batchId);
    if (!courseId) return res.status(400).json({ error: "courseId required" });

    const filter = { course: courseId };
    if (batchId) {
      // lesson.batchId stored as string
      filter.$or = [{ batchId }, { batchName: batchId }];
    }

    const lessons = await Lesson.find(filter).sort({ lessonNumber: 1 }).lean();
    return res.json({ count: lessons.length, lessons });
  } catch (err) {
    console.error("getLessons error", err);
    return res.status(500).json({ error: "Server error" });
  }
}

// POST /api/lessons/:id/complete  -> { userId } or token
async function markLessonComplete(req, res) {
  try {
    const lessonId = req.params.lessonId;
    if (!lessonId) return res.status(400).json({ error: "lesson id required" });

    // since requireAuth ALWAYS sets req.user
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ error: "user required" });

    const lesson = await Lesson.findById(lessonId).lean();
    if (!lesson) return res.status(404).json({ error: "lesson not found" });

    const filter = { userId: String(userId), lessonId };
    const update = {
      userId: String(userId),
      lessonId,
      courseId: String(lesson.course),
      batchId: lesson.batchId || null,
      status: "completed",
    };

    const opts = { upsert: true, new: true, setDefaultsOnInsert: true };
    await StudentLessonProgress.findOneAndUpdate(
      filter,
      { $set: update },
      opts
    );

    return res.json({ message: "Lesson marked completed" });
  } catch (err) {
    console.error("markLessonComplete error", err);
    return res.status(500).json({ error: "Server error" });
  }
}

// in BatchLessonViewerPage component (replace existing handleSubmitQuiz)
// POST /api/course/student/:id/submit-quiz
async function submitQuiz(req, res) {
  try {
    const lessonId = req.params.id || req.params.lessonId;
    if (!lessonId) return res.status(400).json({ error: "lesson id required" });

    // requireAuth should have populated req.user
    const userId = req.user && (req.user.id || req.user._id);
    if (!userId) return res.status(401).json({ error: "user required" });

    const { answers } = req.body; // expected array of { questionId, selectedIndex, selectedOptionId }
    if (!Array.isArray(answers)) return res.status(400).json({ error: "answers array required" });

    const lesson = await Lesson.findById(lessonId).lean();
    if (!lesson) return res.status(404).json({ error: "lesson not found" });
    if ((lesson.type || "").toLowerCase() !== "quiz") return res.status(400).json({ error: "not a quiz lesson" });

    // questions is an array in your DB sample
    const questions = Array.isArray(lesson.quizPayload) ? lesson.quizPayload : [];

    // build a map from questionId -> submitted answer for faster lookup
    // allow questionId to be null (then we'll fallback to matching by index)
    const submittedById = {};
    answers.forEach((a, idx) => {
      if (a && (a.questionId !== undefined && a.questionId !== null)) {
        submittedById[String(a.questionId)] = a;
      } else {
        // store index-based answer under special key
        submittedById[`__idx_${idx}`] = a;
      }
    });

    // grade each question and build detailed
    let correctCount = 0;
    const detailed = questions.map((q, qi) => {
      // resolve submitted answer: prefer by questionId, fallback to index
      const qId = q.id != null ? String(q.id) : null;
      let submitted = null;

      if (qId && submittedById[qId]) {
        submitted = submittedById[qId];
      } else if (submittedById[`__idx_${qi}`]) {
        submitted = submittedById[`__idx_${qi}`];
      } else {
        // maybe answers array contains one entry per question in order; try that
        submitted = answers[qi] || null;
      }

      const selectedIndex = (submitted && typeof submitted.selectedIndex === "number") ? submitted.selectedIndex : null;
      const selectedOptionId = submitted && (submitted.selectedOptionId || submitted.selectedOptionId === null) ? submitted.selectedOptionId : (Array.isArray(q.options) && selectedIndex != null ? (q.options[selectedIndex] && q.options[selectedIndex].id) : null);

      const correctIndex = (typeof q.correctIndex === "number") ? q.correctIndex : null;
      const correct = correctIndex !== null && selectedIndex !== null ? correctIndex === selectedIndex : false;
      if (correct) correctCount++;

      return {
        questionId: qId || qi,
        selectedIndex,
        selectedOptionId,
        correctIndex,
        correct,
      };
    });

    console.log(detailed, "detials")

    const total = questions.length;
    const scorePercent = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    // prepare progress object to save
    const progressDoc = {
      userId: String(userId),
      lessonId: lessonId,
      courseId: String(lesson.course),
      batchId: lesson.batchId || null,
      status: total > 0 && correctCount === total ? "completed" : "attempted",
      quiz: {
        correctCount,
        total,
        score: scorePercent,
        detailed,
      },
      // keep assignment field if present (no change)
      assignment: (/* keep if previously present */ null),
    };

    // upsert student's lesson progress
    const filter = { userId: String(userId), lessonId: lessonId };
    const opts = { upsert: true, new: true, setDefaultsOnInsert: true };
    const progress = await StudentLessonProgress.findOneAndUpdate(filter, { $set: progressDoc }, opts);

    return res.json({
      score: scorePercent,
      total,
      detailed,
      progress,
    });
  } catch (err) {
    console.error("submitQuiz error", err);
    return res.status(500).json({ error: "Server error" });
  }
}



// POST /api/lessons/:id/submit-assignment
// body: { submission: { text, url } }
async function submitAssignment(req, res) {
  try {
    const lessonId = req.params.id;
    if (!lessonId) return res.status(400).json({ error: "lesson id required" });
    const userId = getUserIdFromReq(req) || req.body.userId;
    if (!userId) return res.status(401).json({ error: "user required" });

    const lesson = await Lesson.findById(lessonId).lean();
    if (!lesson) return res.status(404).json({ error: "lesson not found" });
    if (String(lesson.type).toLowerCase() !== "assignment") {
      return res.status(400).json({ error: "lesson is not an assignment" });
    }

    const submission = req.body.submission || null;
    if (!submission)
      return res.status(400).json({ error: "submission required" });

    const filter = { userId: String(userId), lessonId: lessonId };
    const update = {
      userId: String(userId),
      lessonId: lessonId,
      courseId: String(lesson.course),
      batchId: lesson.batchId || null,
      assignment: {
        submitted: true,
        submission,
        submittedAt: new Date(),
      },
    };
    const opts = { upsert: true, new: true, setDefaultsOnInsert: true };
    const progress = await StudentLessonProgress.findOneAndUpdate(
      filter,
      { $set: update },
      opts
    );

    return res.json({ message: "Assignment submitted", progress });
  } catch (err) {
    console.error("submitAssignment error", err);
    return res.status(500).json({ error: "Server error" });
  }
}

module.exports = {
  getLessons,
  markLessonComplete,
  submitQuiz,
  submitAssignment,
};
