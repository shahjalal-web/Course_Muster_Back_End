// src/models/student.model.js
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student','admin','instructor'], default: 'student' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Students', studentSchema);
