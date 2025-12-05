// src/utils/jwt.util.js
const jwt = require("jsonwebtoken");
const secret = process.env.JWT_SECRET || "change_this_secret";

function signToken(payload, expiresIn = "7d") {
  return jwt.sign(payload, secret, { expiresIn });
}

// safer verify
function verifyToken(token) {
  try {
    return jwt.verify(token, secret);
  } catch (err) {
    // Custom error handling
    if (err.name === "TokenExpiredError") {
      throw { status: 401, message: "Token expired" };
    }
    if (err.name === "JsonWebTokenError") {
      throw { status: 401, message: "Invalid token" };
    }
    throw { status: 400, message: "Token verification failed" };
  }
}

module.exports = { signToken, verifyToken };
