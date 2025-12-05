// routes/adminRoutes.js
const express = require("express");
const { listStudents, getStudent } = require("../controllers/user.controller");
const { requireAuth } = require("../middlewares/authMiddleware");
const router = express.Router();

// All routes under /api/admin require auth+admin
router.get("/students", requireAuth(["admin"]), listStudents);
router.get("/students/:id", requireAuth(["admin"]), getStudent);

module.exports = router;
