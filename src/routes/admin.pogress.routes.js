// routes/progress.js (or your api router)
const express = require("express");
const router = express.Router();
const { getProgressForadmin } = require("../controllers/progress.controller");
const { requireAuth } = require("../middlewares/authMiddleware");


router.get("/student/:userId/progress", requireAuth(["admin"]), getProgressForadmin);


module.exports = router;
