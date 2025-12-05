import { verifyToken } from "../utils/jwt.util.js";

export const requireAuth = (roles = []) => {
  return (req, res, next) => {
    try {
      const header = req.headers.authorization;
      if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No token provided" });
      }

      const token = header.split(" ")[1];
      const decoded = verifyToken(token);
      req.user = decoded;
      console.log(req.user.id, "user decode")

      // check role if provided
      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ message: "Forbidden: insufficient role" });
      }

      next();
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  };
};
