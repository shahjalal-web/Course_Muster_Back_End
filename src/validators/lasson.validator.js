import { z } from "zod";

const optionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1, "Option text cannot be empty"),
});

const questionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(3, "Question must be at least 3 chars"),
  options: z.array(optionSchema).min(2, "Each question must have at least 2 options"),
  correctIndex: z.number().int().nonnegative(),
});

export const createLessonSchema = z.object({
  // metadata
  courseId: z.string().optional(),
  courseName: z.string().optional().nullable(),
  courseCategory: z.string().optional().nullable(),
  batchId: z.string().optional().nullable(),
  batchName: z.string().optional().nullable(),

  // lesson core
  title: z.string().min(3),
  lessonNumber: z.preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number().int().min(1)),
  type: z.enum(["video", "quiz", "assignment", "article"]).default("video"),

  // video fields
  videoUrl: z.string().url().optional().nullable(),
  durationMinutes: z.preprocess((v) => (v === "" ? null : Number(v)), z.number().int().nonnegative().optional().nullable()),

  // quiz: an array of structured questions (optional unless type==='quiz')
  quizPayload: z.array(questionSchema).optional().nullable(),

  // assignment
  assignmentInstructions: z.string().optional().nullable(),
  assignmentDueDate: z.string().optional().nullable(),

  // article/resources
  resources: z.string().optional().nullable(),
});
