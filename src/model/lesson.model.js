import mongoose from "mongoose";

const LessonSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    courseTitle: { type: String, trim: true, required: true },
    courseCategory: { type: String, trim: true, default: null },
    batchId: { type: String, default: null },
    batchName: { type: String, default: null },
    title: { type: String, required: true, trim: true },
    lessonNumber: { type: Number, required: true },
    type: { type: String, enum: ["video", "quiz", "assignment", "article"], default: "video" },
    videoUrl: { type: String, default: null },
    durationMinutes: { type: Number, default: null },
    // quiz payload: store structured array of questions (flexible)
    quizPayload: { type: mongoose.Schema.Types.Mixed, default: null },
    assignmentInstructions: { type: String, default: null },
    assignmentDueDate: { type: Date, default: null },
    resources: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

const Lesson = mongoose.models.Lesson || mongoose.model("Lesson", LessonSchema);
export default Lesson;
