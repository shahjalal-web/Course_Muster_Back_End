// controllers/enrollController.js

const EnrolledCourseModel = require("../model/EnrolledCourse.model");
let CourseModel;
try {
  const cm = require("../model/course.model");
  CourseModel = cm && (cm.default || cm);
} catch (err) {
  CourseModel = null;
}

async function enroll(req, res) {
  try {
    console.log("hi")
    const { courseId, batchId = null, user: userFromBody, payment, meta } = req.body;
    if (!courseId) return res.status(400).json({ error: "courseId required" });
    if (!payment || !payment.method || !payment.status) {
      return res.status(400).json({ error: "payment method/status required" });
    }

    // derive user (prefer JWT)
    const authUser = req.authUser || null;
    const user = {
      id: authUser?.id || authUser?._id || userFromBody?.id || null,
      name: authUser?.name || userFromBody?.name || null,
      email: authUser?.email || userFromBody?.email || null,
    };

    // prevent duplicate enrollment
    if (user.id) {
      const exists = await EnrolledCourseModel.findOne({
        "user.id": user.id,
        courseId,
        batchId: batchId || null,
      }).lean();

      if (exists) {
        return res.status(200).json({ message: "Already enrolled", enrolledId: exists._id });
      }
    }

    // save in EnrolledCourse collection
    const doc = new EnrolledCourseModel({
      courseId,
      batchId: batchId || null,
      user,
      payment,
      meta: meta || null,
    });

    await doc.save();

    // UPDATE COURSE MODEL
    if (CourseModel) {
      try {
        const purchaseEntry = {
          student: user.id || null,
          studentName: user.name || "Unknown",
          studentEmail: user.email || null,   // <-- added
          purchasedAt: new Date(),
        };

        const updateOps = {
          $inc: { totalPurchases: 1 },
        };

        if (user.id) {
          updateOps.$push = { purchases: purchaseEntry };
        }

        const courseFilter = { _id: courseId };

        const updated = await CourseModel.findOneAndUpdate(
          courseFilter,
          updateOps,
          { new: true }
        );

        if (!updated) {
          console.warn("Course not found to update purchases:", courseId);
        }
      } catch (err) {
        console.error("Failed to update Course purchases:", err);
      }
    }

    return res.status(201).json({
      message: "Enrollment stored",
      enrolledId: doc._id,
    });

  } catch (err) {
    console.error("enroll error", err);
    return res.status(500).json({ error: "Server error" });
  }
}




async function getEnrollmentsByUser(req, res) {
  try {
    const userId = req.params.userId || req.query.userId;
    if (!userId) return res.status(400).json({ error: "userId required" });

    const docs = await EnrolledCourseModel.find({ "user.id": userId })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ count: docs.length, enrollments: docs });
  } catch (err) {
    console.error("getEnrollmentsByUser error", err);
    return res.status(500).json({ error: "Server error" });
  }
}

/**
 * GET /api/enroll/:id
 * Return single enrollment by enroll id (Mongo _id)
 */
async function getEnrollmentById(req, res) {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: "id required" });

    const doc = await EnrolledCourseModel.findById(id).lean();
    if (!doc) return res.status(404).json({ error: "Enrollment not found" });
    return res.json(doc);
  } catch (err) {
    console.error("getEnrollmentById error", err);
    return res.status(500).json({ error: "Server error" });
  }
}

module.exports = {
  enroll,
  getEnrollmentsByUser,
  getEnrollmentById,
};





