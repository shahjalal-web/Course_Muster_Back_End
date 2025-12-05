import bcrypt from "bcryptjs";
import adminModel from "../model/admin.model.js";
import { signToken } from "../utils/jwt.util.js";

// Load secret key from env
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;


import { z } from "zod";

export const adminRegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100).trim(),
  email: z.string().email("Invalid email").transform((s) => s.toLowerCase()),
  password: z.string().min(6, "Password must be at least 6 characters"),
  key: z.string().min(1, "Secret key is required"),
});

export const adminLoginSchema = z.object({
  email: z.string().email("Invalid email").transform((s) => s.toLowerCase()),
  password: z.string().min(1, "Password required"),
});


// ----------------------- Admin Register -----------------------
export const registerAdmin = async (req, res, next) => {
  try {
    const parse = adminRegisterSchema.safeParse(req.body);
    if (!parse.success) {
      const first = parse.error.errors[0];
      const message = first ? `${first.path.join(".")}: ${first.message}` : "Invalid input";
      return res.status(400).json({ message });
    }

    const { name, email, password, key } = parse.data;

    // check secret key
    if (!ADMIN_SECRET_KEY || key !== ADMIN_SECRET_KEY) {
      return res.status(403).json({ message: "Invalid admin secret key" });
    }

    // check if exists
    const exists = await adminModel.findOne({ email });
    if (exists) return res.status(409).json({ message: "Admin email already registered" });

    // hash password
    const hash = await bcrypt.hash(password, 10);

    // create admin
    const AdminDoc = await adminModel.create({
      name,
      email,
      password: hash,
    });

    const admin = {
      id: AdminDoc._id.toString(),
      name: AdminDoc.name,
      email: AdminDoc.email,
      role: AdminDoc.role,
    };

    const token = signToken({ id: admin.id, role: admin.role });

    return res.status(201).json({ user: admin, token });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Admin email already registered" });
    }
    next(err);
  }
};

// ----------------------- Admin Login -----------------------
export const loginAdmin = async (req, res, next) => {
  try {
    const parse = adminLoginSchema.safeParse(req.body);
    if (!parse.success) {
      const first = parse.error.errors[0];
      const message = first ? `${first.path.join(".")}: ${first.message}` : "Invalid input";
      return res.status(400).json({ message });
    }

    const { email, password } = parse.data;

    const admin = await adminModel.findOne({ email });
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(401).json({ message: "Invalid password" });

    const payload = {
      id: admin._id.toString(),
      name: admin.name,
      email: admin.email,
      role: admin.role,
    };

    const token = signToken(payload);

    res.json({ user: payload, token });
  } catch (err) {
    next(err);
  }
};
