const crypto = require("crypto");
const pool = require("../config/database");

// Letters and numbers without confusing ones (no 0, O, 1, I)
const CODE_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const MAX_ATTEMPTS = 5;

function generateSessionCode() {
    let code = "";

    for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_CHARACTERS[crypto.randomInt(CODE_CHARACTERS.length)];
    }

    return code;
}

async function createSession(req, res) {
    const lecturerId = req.session.user.user_id;

    try {
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            const sessionCode = generateSessionCode();

            try {
                const [result] = await pool.execute(
                    `INSERT INTO game_sessions (lecturer_id, session_code)
                     VALUES (?, ?)`,
                    [lecturerId, sessionCode]
                );

                return res.status(201).json({
                    message: "Session created successfully.",
                    session: {
                        session_id: result.insertId,
                        session_code: sessionCode,
                        status: "waiting"
                    }
                });
            } catch (error) {
                // The code already exists, so try again with a new code
                if (error.code === "ER_DUP_ENTRY") {
                    continue;
                }

                throw error;
            }
        }

        return res.status(500).json({
            message: "Could not create a unique session code. Please try again."
        });
    } catch (error) {
        console.error("Create session failed:", error.code || error.message);

        return res.status(500).json({
            message: "Could not create the session. Please try again."
        });
    }
}

module.exports = { createSession };