import mongoose from "mongoose";
import Course from "../model/course.model.js";
import Lesson from "../model/lesson.model.js";
import { courseQuerySchema } from "../validators/course.validator.js";


/**
 * GET /api/courses
 * Supports query params: q, category, instructor, price=free|paid, sort, page, limit
 * Returns { items: [...], total }
 */
export const getCoursesForStudent = async (req, res, next) => {
  try {
    console.log(req.query)
    // parse raw query params and coerce types robustly
    const {
      q = undefined,
      category = undefined,
      instructor = undefined,
      price = undefined,
      sort = undefined,
      page = "1",
      limit = "12",
    } = req.query || {};

    // coerce page/limit to numbers, fallback to defaults if invalid
    const pageNum = Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
    const limitNum = Number.isInteger(Number(limit)) && Number(limit) > 0 ? Number(limit) : 12;

    // validate price and sort values (optional)
    const priceVal = ["free", "paid"].includes(String(price)) ? String(price) : undefined;
    const sortVal = ["price_asc", "price_desc", "newest"].includes(String(sort)) ? String(sort) : "newest";

    // build filter
    const filter = {};
    if (q) {
      filter.$or = [
        { title: { $regex: String(q), $options: "i" } },
        { instructorName: { $regex: String(q), $options: "i" } },
        { category: { $regex: String(q), $options: "i" } },
      ];
    }
    if (category) filter.category = String(category);
    if (instructor) filter.instructorName = String(instructor);
    if (priceVal === "free") filter.price = 0;
    if (priceVal === "paid") filter.price = { $gt: 0 };

    // sort
    let sortObj = { createdAt: -1 };
    if (sortVal === "price_asc") sortObj = { price: 1 };
    if (sortVal === "price_desc") sortObj = { price: -1 };

    const skip = (pageNum - 1) * limitNum;

    const [total, items] = await Promise.all([
      Course.countDocuments(filter),
      Course.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .select("title description category price thumbnail batches instructorName createdAt")
        .lean(),
    ]);

    return res.json({ items, total, page: pageNum, limit: limitNum });
  } catch (err) {
    next(err);
  }
};


export const getCourseByIdForStudent = async (req, res, next) => {
  try {
    console.log("first")
    const { courseId } = req.params;
    if (!courseId || !mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({ message: "Invalid course id" });
    }

    // Fetch the course
    const course = await Course.findById(courseId)
      .select("-__v") // omit __v
      .lean();

    if (!course) return res.status(404).json({ message: "Course not found" });

    // Fetch lessons related to this course (if you store lessons in separate collection)
    // Make sure your Lesson model has `course` field referencing Course._id
    let lessons = [];
    try {
      lessons = await Lesson.find({ course: course._id })
        .sort({ lessonNumber: 1 })
        .select("-__v -createdAt -updatedAt")
        .lean();
    } catch (e) {
      // if Lesson model does not exist or query fails, ignore and continue (course will be returned)
      lessons = [];
    }

    // Attach lessons to returned object for convenience
    course.lessons = lessons;

    // Optionally compute enrollCount fallback if you want (not required)
    // course.enrollCount = course.totalPurchases ?? (Array.isArray(course.purchases) ? course.purchases.length : 0);

    return res.json({ course });
  } catch (err) {
    console.error("getCourseById error:", err);
    return next(err);
  }
};