// controllers/adminController.js

const studentModel = require("../model/student.model");

/**
 * GET /api/admin/students
 * Query:
 *  ?q=search (name|email)
 *  ?role=student|admin
 *  ?page=1&limit=20
 *  ?sort=createdAt_desc|createdAt_asc|name_asc
 */
const listStudents = async (req, res, next) => {
  try {
    const { q, role, page = 1, limit = 20, sort = "createdAt_desc" } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.min(200, parseInt(limit, 10) || 20);
    const skip = (pageNum - 1) * lim;

    const filter = {};
    if (q && String(q).trim()) {
      const re = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: re }, { email: re }, { "meta.phone": re }, { phone: re }];
    }
    if (role) filter.role = role;

    let sortObj = { createdAt: -1 };
    if (sort === "createdAt_asc") sortObj = { createdAt: 1 };
    if (sort === "name_asc") sortObj = { name: 1 };
    if (sort === "name_desc") sortObj = { name: -1 };

    const [total, students] = await Promise.all([
      studentModel.countDocuments(filter),
      studentModel.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(lim)
        .lean()
    ]);

    return res.json({ total, page: pageNum, limit: lim, items: students });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/students/:id
 */
const getStudent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const student = await studentModel.findById(id).lean();
    if (!student) return res.status(404).json({ message: "Student not found" });
    return res.json({ student });
  } catch (err) {
    next(err);
  }
};

module.exports = { listStudents, getStudent };
