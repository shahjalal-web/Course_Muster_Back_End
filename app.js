// app.js
const express = require('express');
const cors = require('cors');
const authRoutes = require('./src/routes/auth.routes');
const adminCourseRouters = require('./src/routes/admin.course.routes')
const courseRoutes = require("./src/routes/course.routes");
const studentRoutes = require("./src/routes/student.routes");
const adminRoutes = require("./src/routes/admin.user.routes");
const adminProgressRoutes = require("./src/routes/admin.pogress.routes");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root route (health check)
app.get('/', (req, res) => {
  res.send('Portfolio server is running');
});


// auth routes (student register)
app.use('/api/auth', authRoutes);
app.use("/api/course/progress", adminProgressRoutes);
app.use('/api/course', adminCourseRouters);
app.use('/api/courses', courseRoutes);
app.use("/api/course/student", studentRoutes)
app.use("/api/admin", adminRoutes);

module.exports = app;
