const bcrypt = require("bcrypt");
const pool = require("../config/database");

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

            // 7. Store the user information in the session
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