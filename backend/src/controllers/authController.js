const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { query } = require("../db");

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const JWT_EXPIRES = "7d";
const USER_SELECT = `
  SELECT
    users.id,
    users.username,
    users.email,
    users.full_name,
    users.agreed_to_terms,
    users.created_at,
    profile_photos.image_url AS profile_photo_url
  FROM users
  LEFT JOIN profile_photos ON profile_photos.user_id = users.id
`;
const USER_LOGIN_SELECT = `
  SELECT
    users.id,
    users.username,
    users.email,
    users.full_name,
    users.password_hash,
    users.agreed_to_terms,
    users.created_at,
    profile_photos.image_url AS profile_photo_url
  FROM users
  LEFT JOIN profile_photos ON profile_photos.user_id = users.id
`;

function sanitizeUser(row) {
  if (!row) return null;
  const { password_hash, ...user } = row;
  return user;
}

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

async function fetchUserById(userId) {
  const result = await query(`${USER_SELECT} WHERE users.id = $1`, [userId]);
  return result.rows[0] ?? null;
}

async function signup(req, res) {
  try {
    const { username, email, password, full_name: fullName } = req.body;
    if (!username?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: "Username, email, and password are required." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format." });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const fullNameTrimmed = typeof fullName === "string" ? fullName.trim() : "";
    const result = await query(
      `INSERT INTO users (username, email, password_hash, full_name) VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [username.trim(), email.trim().toLowerCase(), password_hash, fullNameTrimmed]
    );
    const newUserId = result.rows[0].id;
    await query(
      `INSERT INTO user_stats (id, flyers, hours, scans, "updatedAt") VALUES ($1, 0, 0, 0, NOW())`,
      [newUserId]
    );
    const user = await fetchUserById(newUserId);
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );
    return res.status(201).json({ user: sanitizeUser(user), token });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Username or email already in use." });
    }
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Registration failed." });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const result = await query(
      `${USER_LOGIN_SELECT} WHERE users.email = $1`,
      [email.trim().toLowerCase()]
    );
    const row = result.rows[0];
    if (!row) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    const match = await bcrypt.compare(password, row.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const user = sanitizeUser(row);
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );
    return res.json({ user, token });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Login failed." });
  }
}

async function me(req, res) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ error: "Not authenticated." });
    }
    const decoded = verifyToken(token);
    const user = await fetchUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found." });
    }
    return res.json({ user });
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired token." });
    }
    console.error("Me error:", err);
    return res.status(500).json({ error: "Failed to get user." });
  }
}

async function agreeToTerms(req, res) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ error: "Not authenticated." });
    }
    const decoded = verifyToken(token);
    await query(
      "UPDATE users SET agreed_to_terms = TRUE WHERE id = $1 RETURNING id",
      [decoded.userId]
    );
    const user = await fetchUserById(decoded.userId);
    return res.json({ user });
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired token." });
    }
    console.error("Agree to terms error:", err);
    return res.status(500).json({ error: "Failed to update." });
  }
}

async function uploadProfilePhoto(req, res) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ error: "Not authenticated." });
    }

    const { imageUrl } = req.body;
    if (!imageUrl?.trim()) {
      return res.status(400).json({ error: "imageUrl is required." });
    }

    const decoded = verifyToken(token);
    await query(
      `
        INSERT INTO profile_photos (user_id, image_url)
        VALUES ($1, $2)
        ON CONFLICT (user_id)
        DO UPDATE SET image_url = EXCLUDED.image_url, updated_at = NOW()
      `,
      [decoded.userId, imageUrl.trim()]
    );

    const user = await fetchUserById(decoded.userId);
    return res.json({ user });
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired token." });
    }
    console.error("Upload profile photo error:", err);
    return res.status(500).json({ error: "Failed to upload profile photo." });
  }
}

module.exports = { signup, login, me, agreeToTerms, uploadProfilePhoto };
