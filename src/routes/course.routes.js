// routes/course.routes.js
const express = require("express");
const {
  getCoursesForStudent,
  getCourseByIdForStudent,
} = require("../controllers/student.course.controller.js");
const { requireAuth } = require("../middlewares/authMiddleware.js");

const router = express.Router();

// public / student-facing course list
router.get("/get-all-courses", getCoursesForStudent);

// course detail for student (protected)
router.get("/:courseId", requireAuth(["student", "admin"]), getCourseByIdForStudent);

module.exports = router;
