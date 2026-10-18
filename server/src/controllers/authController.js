const bcrypt = require("bcrypt");
const pool = require("../config/database");

// ---------- Login attempt limiting ----------
// Stops brute-force guessing by locking an (IP, email) pair after too many
// failed attempts. Kept in memory; it resets when the server restarts.
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 3 * 60 * 1000; // 15 minutes
const WINDOW_MS = 3* 60 * 1000;  // attempts expire after 15 minutes

const loginAttempts = new Map();

function clientIp(req) {
    return (
        (req.headers["x-forwarded-for"] ||
         req.socket.remoteAddress ||
         req.ip ||
         "unknown").toString().split(",")[0].trim() || "unknown"
    );
}

function attemptKey(req, email) {
    return clientIp(req) + "|" + String(email || "").trim().toLowerCase();
}

function recordFailedAttempt(req, email) {
    const key = attemptKey(req, email);
    const now = Date.now();
    let entry = loginAttempts.get(key);

    if (!entry || now - entry.firstAttempt > WINDOW_MS) {
        entry = { firstAttempt: now, count: 0 };
    }

    entry.count += 1;
    loginAttempts.set(key, entry);

    return entry.count;
}

function clearAttempts(req, email) {
    loginAttempts.delete(attemptKey(req, email));
}

function isLocked(req, email) {
    const entry = loginAttempts.get(attemptKey(req, email));
    if (!entry) {
        return false;
    }

    const now = Date.now();

    if (now - entry.firstAttempt > WINDOW_MS) {
        loginAttempts.delete(attemptKey(req, email));
        return false;
    }

    return entry.count >= MAX_ATTEMPTS;
}

function remainingLockoutMs(req, email) {
    const entry = loginAttempts.get(attemptKey(req, email));
    if (!entry) {
        return 0;
    }

    return Math.max(0, LOCKOUT_MS - (Date.now() - entry.firstAttempt));
}

async function register(req, res) {
    const { full_name, email, password } = req.body;

    if (
        typeof full_name !== "string" ||
        typeof email !== "string" ||
        typeof password !== "string"
    ) {
        return res.status(400).json({
            message: "Full name, email and password are required."
        });
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
        return res.status(400).json({
            message: "Enter a valid email address."
        });
    }

    if (
        password.length < 8 ||
        Buffer.byteLength(password, "utf8") > 72
    ) {
        return res.status(400).json({
            message: "Password must have at least 8 characters and at most 72 bytes."
        });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 12);

        const [result] = await pool.execute(
            `INSERT INTO users
                (full_name, email, password_hash, role)
             VALUES (?, ?, ?, ?)`,
            [name, normalizedEmail, passwordHash, "student"]
        );

        return res.status(201).json({
            message: "Registration successful.",
            user: {
                user_id: result.insertId,
                full_name: name,
                email: normalizedEmail,
                role: "student"
            }
        });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                message: "This email is already registered."
            });
        }

        console.error("Registration failed:", error.code);

        return res.status(500).json({
            message: "Registration failed. Please try again."
        });
    }
}



async function login(req, res) {
    const { email, password } = req.body;

    // 1. Validate the input
    if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        !email.trim() ||
        !password
    ) {
        return res.status(400).json({
            message: "Email and password are required."
        });
    }

    // 2. Normalize the email
    const normalizedEmail = email.trim().toLowerCase();

    // 2b. Reject if this (IP, email) is currently locked out
    if (isLocked(req, normalizedEmail)) {
        const retryAfter = Math.ceil(remainingLockoutMs(req, normalizedEmail) / 1000);
        return res.status(429).json({
            message: "Too many failed login attempts. Try again in " + retryAfter + " seconds."
        });
    }

    try {
        // 3. Find the user in the database
        const [users] = await pool.execute(
            `SELECT user_id, full_name, email, password_hash, role
             FROM users
             WHERE email = ?`,
            [normalizedEmail]
        );

        // 4. Check whether the user exists
        if (users.length === 0) {
            recordFailedAttempt(req, normalizedEmail);
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        const user = users[0];

        // 5. Compare the password with the stored hash
        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            recordFailedAttempt(req, normalizedEmail);
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        // 6. Regenerate the session ID after successful login
        req.session.regenerate((error) => {
            if (error) {
                console.error("Session regeneration failed:", error.message);

                return res.status(500).json({
                    message: "Login failed. Please try again."
                });
            }

            // 7. Clear any failed attempts for this (IP, email), then store the user
            clearAttempts(req, normalizedEmail);

            req.session.user = {
                user_id: user.user_id,
                full_name: user.full_name,
                email: user.email,
                role: user.role
            };

            // 8. Save the session before responding
            req.session.save((saveError) => {
                if (saveError) {
                    console.error("Session save failed:", saveError.message);

                    return res.status(500).json({
                        message: "Login failed. Please try again."
                    });
                }

                return res.status(200).json({
                    message: "Login successful.",
                    user: req.session.user
                });
            });
        });
    } catch (error) {
        console.error("Login failed:", error.code || error.message);

        return res.status(500).json({
            message: "Login failed. Please try again."
        });
    }
}

function logout(req, res) {
    if (!req.session) {
        return res.status(401).json({
            message: "You are not logged in."
        });
    }

    req.session.destroy((error) => {
        if (error) {
            return res.status(500).json({
                message: "Logout failed."
            });
        }

        res.clearCookie("connect.sid");

        return res.status(200).json({
            message: "Logout successful."
        });
    });
}




module.exports = { register , login , logout };