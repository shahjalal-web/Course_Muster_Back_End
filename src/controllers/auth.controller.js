// src/controllers/auth.controller.js
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { signToken } = require('../utils/jwt.util');
const studentModel = require('../model/student.model');

// Zod schema for login
const loginSchema = z.object({
  email: z.string().email('Invalid email address').transform((s) => s.toLowerCase()),
  password: z.string().min(1, 'Password is required'),
});

// Zod schema
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim(),
  email: z.string().email('Invalid email address').transform((s) => s.toLowerCase()),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});


const register = async (req, res, next) => {
  try {
    // validate with zod
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      // Build readable message
      const first = parseResult.error.errors[0];
      const message = first ? `${first.path.join('.')}: ${first.message}` : 'Invalid input';
      return res.status(400).json({ message });
    }

    const { name, email, password } = parseResult.data;

    // check existing student
    const exists = await studentModel.findOne({ email });
    if (exists) return res.status(409).json({ message: 'Email already registered' });

    // hash password
    const hash = await bcrypt.hash(password, 10);

    // create student (role defaults to 'student')
    const StudentDoc = await studentModel.create({ name, email, password: hash });

    const student = {
      id: StudentDoc._id.toString(),
      name: StudentDoc.name,
      email: StudentDoc.email,
      role: StudentDoc.role,
    };

    // generate token
    const token = signToken({ id: student.id, role: student.role });

    return res.status(201).json({ student, token });
  } catch (err) {
    // duplicate key (race) safety
    if (err?.code === 11000) return res.status(409).json({ message: 'Email already registered' });
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    // validate request
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      const first = parseResult.error.errors[0];
      const message = first ? `${first.path.join('.')}: ${first.message}` : 'Invalid input';
      return res.status(400).json({ message });
    }

    const { email, password } = parseResult.data;

    // find user by email
    const StudentDoc = await studentModel.findOne({ email });
    if (!StudentDoc) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // compare password
    const isMatch = await bcrypt.compare(password, StudentDoc.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // prepare student payload (don't expose password)
    const student = {
      id: StudentDoc._id.toString(),
      name: StudentDoc.name,
      email: StudentDoc.email,
      role: StudentDoc.role,
    };

    // generate token
    const token = signToken({ id: student.id, role: student.role });

    return res.status(200).json({ user: student, token });
  } catch (err) {
    next(err);
  }
};


module.exports = { register, login };
