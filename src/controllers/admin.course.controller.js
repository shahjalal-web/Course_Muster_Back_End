// controllers/adminCourse.controller.js
import mongoose from "mongoose";
import Course from "../model/course.model.js";
import Lesson from "../model/lesson.model.js";
import { batchSchema, createCourseSchema } from "../validators/course.validator.js";
import { createLessonSchema } from "../validators/lasson.validator.js";

/**
 * POST /api/admin/courses
 * Create a new course (admin only)
 */
export const createCourse = async (req, res, next) => {
  try {
    // 1) validate request body with zod
    const parseResult = createCourseSchema.safeParse(req.body);

    if (!parseResult.success) {
      const issues = parseResult.error.issues?.[0]?.message || "Invalid input";
      return res.status(400).json({ message: issues });
    }

    const payload = parseResult.data;

    // 2) Normalize batches: convert ISO strings to Date or null
    const normalizedBatches = (payload.batches || []).map((b) => {
      const start = b.startDate ? new Date(b.startDate) : null;
      const end = b.endDate ? new Date(b.endDate) : null;
      return {
        name: b.name,
        startDate: start,
        endDate: end,
      };
    });

    // 3) Ensure price is number and non-negative
    const price =
      typeof payload.price === "number"
        ? payload.price
        : (typeof payload.price === "string" ? Number(payload.price) : 0);
    const safePrice = Number.isFinite(price) && price >= 0 ? price : 0;

    // 4) Build course doc
    const courseDoc = new Course({
      title: payload.title,
      description: payload.description,
      category: payload.category || "General",
      price: safePrice,
      thumbnail: payload.thumbnail || null,
      batches: normalizedBatches,
      instructorName: payload.instructorName || null,
      // DO NOT trust client to pass purchases/totalPurchases — server manages that
      totalPurchases: 0,
      purchases: [],
      // store creator if available (use _id if present)
      createdBy: req.user?._id ?? null,
    });

    // 5) Save to DB
    const saved = await courseDoc.save();

    // 6) return created course
    return res.status(201).json({ course: saved });
  } catch (err) {
    // handle mongoose duplicate / validation errors gracefully
    if (err?.code === 11000) return res.status(409).json({ message: "Duplicate resource" });
    next(err);
  }
};


export const getCourseById = async (req, res) => {
  try {
    const { courseId } = req.params;
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: "Invalid course id" });
    }

    // Fetch course (includes purchases array if stored in course doc)
    const course = await Course.findById(courseId).lean();
    if (!course) return res.status(404).json({ message: "Course not found" });

    // Optionally load lessons if you store lessons in a separate collection
    let lessons = [];
    try {
      lessons = await Lesson.find({ course: course._id })
        .select("-__v -createdAt -updatedAt")
        .sort({ lessonNumber: 1 })
        .lean();
    } catch (err) {
      // if Lesson model doesn't exist / query fails, ignore — we still return course
      lessons = [];
    }

    // Attach lessons for convenience (frontend expects course.lessons sometimes)
    const courseObj = {
      ...course,
      lessons,
    };

    return res.json({ course: courseObj });
  } catch (err) {
    console.error("getCourseById err:", err);
    return res.status(500).json({ message: "Failed to fetch course" });
  }
};

export const addBatchToCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: "Invalid course id" });
    }

    // validate body
    const parsed = batchSchema.safeParse(req.body || {});
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return res.status(400).json({ message: `Validation error: ${msg}` });
    }
    const { name, startDate, endDate } = parsed.data;

    // find course existence
    const course = await Course.findById(courseId).lean();
    if (!course) return res.status(404).json({ message: "Course not found" });

    // check duplicate batch name in same course (case-insensitive)
    const exists = (course.batches || []).some(
      (b) => String(b.name || "").trim().toLowerCase() === String(name).trim().toLowerCase()
    );
    if (exists) {
      return res.status(409).json({ message: "A batch with this name already exists for the course" });
    }

    // prepare new batch doc
    const newBatch = {
      name: name.trim(),
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    };

    // atomic push and return updated course (new: true)
    const updated = await Course.findByIdAndUpdate(
      courseId,
      { $push: { batches: newBatch } },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) return res.status(500).json({ message: "Failed to add batch" });

    // find the pushed batch (last element) — depending on schema it may have _id
    const pushed = Array.isArray(updated.batches) ? updated.batches[updated.batches.length - 1] : null;

    return res.status(201).json({
      message: "Batch added",
      batch: pushed,
      course: updated, // optional: client may prefer updated course
    });
  } catch (err) {
    console.error("addBatchToCourse err:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAdminCourses = async (req, res) => {
  try {
    // You can add filters / pagination as needed. For now return all.
    const docs = await Course.find(
      {},
      "title instructorName batches createdAt updatedAt"
    )
      .sort({ createdAt: -1 })
      .lean();

    // Ensure batches have an id for frontend use (because BatchSchema may not have _id)
    const courses = docs.map((c) => {
      const batches =
        Array.isArray(c.batches) && c.batches.length
          ? c.batches.map((b, idx) => ({
              // if batch has _id (unlikely with _id:false) use it; else generate stable id
              id: b._id ? String(b._id) : `${String(c._id)}-batch-${idx + 1}`,
              name: b.name || `Batch ${idx + 1}`,
              startDate: b.startDate
                ? new Date(b.startDate).toISOString()
                : null,
              endDate: b.endDate ? new Date(b.endDate).toISOString() : null,
            }))
          : [];

      return {
        _id: String(c._id),
        title: c.title,
        instructorName: c.instructorName || null,
        batches,
        createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : null,
        updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : null,
      };
    });

    return res.json(courses);
  } catch (err) {
    console.error("getAdminCourses error:", err);
    return res.status(500).json({ message: "Failed to fetch courses" });
  }
};

export const addLesson = async (req, res) => {
  try {
    const { courseId } = req.params;

    // merge body + ensure lessonNumber/duration normalized (Zod preprocess handles some)
    const incoming = { ...req.body };

    const parsed = createLessonSchema.safeParse(incoming);
    if (!parsed.success) {
      const msg = parsed.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      return res.status(400).json({ message: `Validation error: ${msg}` });
    }

    const data = parsed.data;

    // If type is quiz, ensure quizPayload exists
    if (data.type === "quiz") {
      if (!Array.isArray(data.quizPayload) || data.quizPayload.length === 0) {
        return res
          .status(400)
          .json({ message: "Quiz must contain at least one question" });
      }
      // ensure each question's correctIndex within range
      for (const [i, q] of data.quizPayload.entries()) {
        if (q.correctIndex < 0 || q.correctIndex >= q.options.length) {
          return res
            .status(400)
            .json({ message: `Question ${i + 1} has invalid correctIndex` });
        }
      }
    }

    // fetch canonical course
    const course = await Course.findById(courseId).lean();
    if (!course) return res.status(404).json({ message: "Course not found" });

    const canonicalTitle = course.title;
    const canonicalCategory = course.category || data.courseCategory || null;

    // resolve batch (similar logic as earlier)
    let resolvedBatchId = null;
    let resolvedBatchName = null;
    if (data.batchId) {
      const found = (course.batches || []).find((b, idx) => {
        if (b._id && String(b._id) === String(data.batchId)) return true;
        if (b.id && b.id === data.batchId) return true;
        if (b.name === data.batchId) return true;
        if (String(data.batchId) === `${String(course._id)}-batch-${idx + 1}`)
          return true;
        return false;
      });
      if (found) {
        resolvedBatchId = found._id
          ? String(found._id)
          : found.id ||
            `${String(course._id)}-batch-${course.batches.indexOf(found) + 1}`;
        resolvedBatchName = found.name || null;
      } else {
        resolvedBatchId = data.batchId;
        resolvedBatchName = data.batchName || null;
      }
    }

    // === NEW: uniqueness check for lessonNumber within same course (and batch if provided) ===
    // If resolvedBatchId is null, we check for existing lessons with batchId === null.
    const existingQuery = {
      course: course._id,
      lessonNumber: data.lessonNumber,
      batchId: resolvedBatchId ?? null,
    };
    const existing = await Lesson.findOne(existingQuery).lean();
    if (existing) {
      return res.status(409).json({
        message: `Lesson number ${
          data.lessonNumber
        } already exists for this course${
          resolvedBatchId ? " and batch" : ""
        }. Please choose a different lesson number.`,
      });
    }
    // ================================================================================

    // prepare lesson doc
    const lessonDoc = {
      course: course._id,
      courseTitle: canonicalTitle,
      courseCategory: canonicalCategory,
      batchId: resolvedBatchId,
      batchName: resolvedBatchName,
      title: data.title,
      lessonNumber: data.lessonNumber,
      type: data.type,
      videoUrl: data.videoUrl || null,
      durationMinutes: data.durationMinutes ?? null,
      quizPayload: data.type === "quiz" ? data.quizPayload : null,
      assignmentInstructions: data.assignmentInstructions || null,
      assignmentDueDate: data.assignmentDueDate
        ? new Date(data.assignmentDueDate)
        : null,
      resources: data.resources || null,
      createdBy: req.user ? req.user._id : null,
    };

    const lesson = await Lesson.create(lessonDoc);
    return res.status(201).json({ message: "Lesson created", lesson });
  } catch (err) {
    console.error("addLesson err", err);
    return res.status(500).json({ message: "Failed to add lesson" });
  }
};

export const getCourses = async (req, res) => {
  try {
    const {
      q,
      category,
      instructor,
      price = "all",
      page: pageRaw = "1",
      limit: limitRaw = "12",
    } = req.query;

    const page = Math.max(1, parseInt(pageRaw, 10) || 1);
    let limit = Math.max(1, parseInt(limitRaw, 10) || 12);
    limit = Math.min(limit, 100); // cap for safety

    const query = {};

    // text-like search on title and description
    if (q && String(q).trim().length > 0) {
      const regex = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ title: regex }, { description: regex }];
    }

    if (category && String(category).trim() !== "") {
      query.category = String(category).trim();
    }

    if (instructor && String(instructor).trim() !== "") {
      query.instructorName = String(instructor).trim();
    }

    if (price === "free") {
      query.price = { $eq: 0 };
    } else if (price === "paid") {
      query.price = { $gt: 0 };
    }

    // count total matching
    const total = await Course.countDocuments(query);

    // projection: adjust fields returned as you wish
    const projection = "title description category price thumbnail instructorName batches createdAt";

    const items = await Course.find(query)
      .select(projection)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.json({ items, total, page, limit });
  } catch (err) {
    console.error("getCourses error:", err);
    return res.status(500).json({ message: "Failed to fetch courses" });
  }
};
