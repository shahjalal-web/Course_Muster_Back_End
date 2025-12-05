// models/EnrolledCourse.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const PaymentSchema = new Schema({
  method: { type: String, required: true }, // 'card' | 'bikash' | etc.
  status: { type: String, required: true }, // 'paid', 'pending'
  paidAt: { type: Date },
  cardLast4: { type: String },
  trxId: { type: String }, // bKash trx id
  raw: { type: Schema.Types.Mixed }, // store raw response if needed
});

const EnrolledCourseSchema = new Schema(
  {
    courseId: { type: String, required: true, index: true },
    batchId: { type: String },
    user: {
      id: { type: String }, // optional if userless
      name: { type: String },
      email: { type: String },
    },
    payment: PaymentSchema,
    meta: { type: Schema.Types.Mixed }, // any extra info
  },
  { timestamps: true }
);

module.exports = mongoose.model("EnrolledCourse", EnrolledCourseSchema);
