// validators/course.validator.js
import { z } from "zod";

export const batchSchema = z.object({
  name: z.string().min(1, "Batch name required").trim(),
  startDate: z
    .string()
    .optional()
    .refine((s) => !s || !Number.isNaN(Date.parse(s)), {
      message: "startDate must be a valid date string",
    })
    .nullable(),
  endDate: z
    .string()
    .optional()
    .refine((s) => !s || !Number.isNaN(Date.parse(s)), {
      message: "endDate must be a valid date string",
    })
    .nullable(),
});

// purchase record schema for Course.purchases
const purchaseSchema = z.object({
  student: z
    .string()
    .min(1, "student id is required")
    .regex(/^[0-9a-fA-F]{24}$/, "student must be a valid ObjectId string")
    .optional(), // optional when creating a course; will be provided when recording purchase
  studentName: z.string().min(1, "studentName is required").trim().optional(),
  purchasedAt: z
    .string()
    .optional()
    .refine((s) => !s || !Number.isNaN(Date.parse(s)), {
      message: "purchasedAt must be a valid date string",
    })
    .nullable(),
});

export const createCourseSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").trim(),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .trim(),
  category: z.string().optional().nullable(),

  // price: accept string or number -> coerce to number, ensure non-negative
  price: z
    .preprocess((val) => {
      if (typeof val === "string") {
        const t = val.trim();
        if (t === "") return undefined;
        const n = Number(t);
        return Number.isNaN(n) ? val : n;
      }
      return val;
    }, z.number().nonnegative("Price must be a non-negative number"))
    .optional()
    .nullable(),

  thumbnail: z.string().url().optional().nullable(),
  batches: z.array(batchSchema).optional().default([]),

  // optional instructor name
  instructorName: z
    .string()
    .min(2, "Instructor name must be at least 2 characters")
    .trim()
    .optional()
    .nullable(),

  // purchase tracking fields (optional on create; usually empty)
  totalPurchases: z
    .preprocess((v) => (typeof v === "string" && v !== "" ? Number(v) : v), z.number().int().nonnegative().default(0))
    .optional()
    .default(0),

  purchases: z.array(purchaseSchema).optional().default([]),
});



export const courseQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  instructor: z.string().optional(),
  price: z.enum(["free","paid"]).optional(),
  sort: z.enum(["newest","price_asc","price_desc"]).optional(),
  page: z.preprocess(val => Number(val), z.number().int().positive().optional()).default(1),
  limit: z.preprocess(val => Number(val), z.number().int().positive().optional()).default(12)
});

