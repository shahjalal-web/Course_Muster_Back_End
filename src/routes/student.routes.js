// routes/student.routes.js
const express = require("express");
const {
  enroll,
  getEnrollmentById,
  getEnrollmentsByUser,
} = require("../controllers/EnrolledCouse.contorller.js");
const {
  markLessonComplete,
  submitQuiz,
  submitAssignment,
  getLessons,
} = require("../controllers/lessonController.js");
const { requireAuth } = require("../middlewares/authMiddleware.js");
const { getProgressForStudent } = require("../controllers/progress.controller.js");

const router = express.Router();

// enroll
router.post("/enroll", requireAuth(["student", "admin"]), enroll);

// lessons listing (specific route)
router.get("/get-lessons", requireAuth(["student", "admin"]), getLessons);

router.post(
  "/:lessonId/complete",
  requireAuth(["student", "admin"]),
  markLessonComplete
);

router.post("/:id/submit-quiz", requireAuth(["student", "admin"]), submitQuiz);

router.post(
  "/:id/submit-assignment",
  requireAuth(["student", "admin"]),
  submitAssignment
);

router.get("/progress",requireAuth(["student", "admin"]), getProgressForStudent);

router.get(
  "/user/:userId",
  requireAuth(["student", "admin"]),
  getEnrollmentsByUser
);
router.get("/enroll/:id", requireAuth(["student", "admin"]), getEnrollmentById);

module.exports = router;
