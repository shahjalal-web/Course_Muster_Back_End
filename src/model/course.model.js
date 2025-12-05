// models/course.model.js
import mongoose from "mongoose";

const BatchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    // you may later add batch-level purchase tracking here if needed
  },
  { _id: false }
);

const PurchaseSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    studentName: { type: String, required: true, trim: true },
    purchasedAt: { type: Date, default: Date.now },
    // optional: store payment metadata (txn id, amount) if you want
    // txnId: { type: String, default: null },
    // amount: { type: Number, default: null }
  },
  { _id: true } // allow an _id for each purchase entry
);

const CourseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String, required: true },
    category: { type: String, trim: true, index: true },
    price: { type: Number, default: 0, min: 0, required: true },
    thumbnail: { type: String, default: null },
    batches: { type: [BatchSchema], default: [] },
    instructorName: { type: String, trim: true, default: null },

    // NEW: purchase tracking
    totalPurchases: { type: Number, default: 0 }, // increment when someone buys
    purchases: { type: [PurchaseSchema], default: [] }, // detailed purchase records

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// avoid model recompilation in dev
const Course = mongoose.models.Course || mongoose.model("Course", CourseSchema);
export default Course;
