// src/routes/admin.course.routes.js
const express = require('express');
const { createCourse, getAdminCourses, addLesson, getCourses, getCourseById, addBatchToCourse } = require('../controllers/admin.course.controller.js');
const { requireAuth } = require('../middlewares/authMiddleware.js');
const { getCoursesForStudent } = require('../controllers/course.controller.js');

const router = express.Router();


router.post("/add-course", requireAuth(["admin"]), createCourse);
router.post("/:courseId/lessons", requireAuth(["admin"]), addLesson);
router.get("/lessons", requireAuth(["admin"]), getAdminCourses);
router.get("/all-courses", getCourses);
router.get("/:courseId", getCourseById);
router.post("/:courseId/batches", requireAuth(["admin"]), addBatchToCourse);

// GET /api/courses
router.get("/all-course-for-student", getCoursesForStudent);

module.exports = router;
