const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

function getOptionalUserFromRequest(req) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    return {
      id: decoded.userId,
      email: decoded.email,
    };
  } catch {
    return null;
  }
}

module.exports = {
  getOptionalUserFromRequest,
};
