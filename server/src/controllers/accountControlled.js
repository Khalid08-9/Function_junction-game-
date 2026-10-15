const bcrypt = require("bcrypt");
const crypto = require("crypto");
const pool = require("../config/database");

// Compares two secrets safely (the time taken does not reveal how close the guess was)
function sameSecret(given, expected) {
    const a = crypto.createHash("sha256").update(given).digest();
    const b = crypto.createHash("sha256").update(expected).digest();

    return crypto.timingSafeEqual(a, b);
}

// POST /api/auth/register-lecturer
// Only people who know the secret LECTURER_INVITE_CODE (in .env) can use it.
async function registerLecturer(req, res) {
    const expectedCode = process.env.LECTURER_INVITE_CODE;

    if (!expectedCode) {
        return res.status(503).json({
            message: "Lecturer registration is not enabled."
        });
    }

    const { full_name, email, password, invite_code } = req.body;

    if (
        typeof full_name !== "string" ||
        typeof email !== "string" ||
        typeof password !== "string" ||
        typeof invite_code !== "string"
    ) {
        return res.status(400).json({
            message: "Full name, email, password and invite code are required."
        });
    }

    if (!sameSecret(invite_code, expectedCode)) {
        return res.status(403).json({ message: "Invalid invite code." });
    }

    const name = full_name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!name || name.length > 100) {
        return res.status(400).json({
            message: "Full name must contain 1–100 characters."
        });
    }

    if (
        normalizedEmail.length > 255 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
        return res.status(400).json({ message: "Enter a valid email address." });
    }

    if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
        return res.status(400).json({
            message: "Password must have at least 8 characters and at most 72 bytes."
        });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 12);

        const [result] = await pool.execute(
            `INSERT INTO users (full_name, email, password_hash, role)
             VALUES (?, ?, ?, ?)`,
            [name, normalizedEmail, passwordHash, "lecturer"]
        );

        return res.status(201).json({
            message: "Lecturer registration successful.",
            user: {
                user_id: result.insertId,
                full_name: name,
                email: normalizedEmail,
                role: "lecturer"
            }
        });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                message: "This email is already registered."
            });
        }

        console.error("Lecturer registration failed:", error.code);

        return res.status(500).json({
            message: "Registration failed. Please try again."
        });
    }
}

// GET /api/auth/me -> tells the front end who is logged in
function getMe(req, res) {
    return res.status(200).json({ user: req.session.user });
}

module.exports = { registerLecturer, getMe };