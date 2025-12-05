// models/StudentLessonProgress.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const QuizDetailSchema = new Schema(
  {
    questionId: { type: Schema.Types.Mixed, required: false },
    selectedIndex: { type: Number, required: false, default: null },
    selectedOptionId: { type: String, required: false, default: null },
    correctIndex: { type: Number, required: false, default: null },
    correct: { type: Boolean, required: false, default: false },
  },
  { _id: false }
);

const QuizSchema = new Schema(
  {
    attempted: { type: Boolean, default: false },
    // optional raw answers sent by student (keeps original payload)
    answers: { type: Schema.Types.Mixed, default: null },

    // computed grading
    correctCount: { type: Number, default: 0 },
    total: { type: Number, default: null },
    score: { type: Number, default: null }, // percent or numeric as you choose
    detailed: { type: [QuizDetailSchema], default: [] },
  },
  { _id: false }
);

const AssignmentSchema = new Schema(
  {
    submitted: { type: Boolean, default: false },
    submission: { type: Schema.Types.Mixed, default: null }, // e.g. { text, url }
    submittedAt: { type: Date, default: null },
  },
  { _id: false }
);

const StudentLessonProgressSchema = new Schema(
  {
    userId: { type: String, required: true, index: true }, // store as string (ObjectId string or other)
    lessonId: { type: Schema.Types.ObjectId, ref: "Lesson", required: true, index: true },
    courseId: { type: String, required: true },
    batchId: { type: String, default: null },
    // status: 'incomplete' | 'attempted' | 'completed'
    status: { type: String, enum: ["incomplete", "attempted", "completed"], default: "incomplete" },

    quiz: { type: QuizSchema, default: () => ({}) },
    assignment: { type: AssignmentSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// avoid recompilation in dev
module.exports = mongoose.models.StudentLessonProgress || mongoose.model("StudentLessonProgress", StudentLessonProgressSchema);
