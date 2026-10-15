const crypto = require("crypto");
const pool = require("../config/database");
const { startGame } = require("../services/turnService");

// Session code settings (no 0, O, 1, I because they look alike)
const CODE_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const MAX_CODE_ATTEMPTS = 5;

// Team settings
const TEAM_COLOURS = ["Red", "Blue", "Green", "Yellow", "Purple", "Orange"];
const MAX_TEAM_SIZE = 2;

/* ---------- Create a session (lecturer) ---------- */

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
        for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt++) {
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
                // Code already exists: try again with a new code
                if (error.code !== "ER_DUP_ENTRY") {
                    throw error;
                }
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

/* ---------- Join a session (student) ---------- */
// Small helpers: each one does one job. All use the same connection
// so they are part of the same transaction.

async function isAlreadyInSession(connection, sessionId, userId) {
    const [rows] = await connection.execute(
        `SELECT tm.team_member_id
         FROM team_members tm
         JOIN teams t ON t.team_id = tm.team_id
         WHERE t.session_id = ? AND tm.user_id = ?`,
        [sessionId, userId]
    );

    return rows.length > 0;
}

async function findOpenTeam(connection, sessionId) {
    const [rows] = await connection.execute(
        `SELECT t.team_id, t.team_name, t.team_colour
         FROM teams t
         LEFT JOIN team_members tm ON tm.team_id = t.team_id
         WHERE t.session_id = ?
         GROUP BY t.team_id, t.team_name, t.team_colour
         HAVING COUNT(tm.team_member_id) < ?
         ORDER BY t.team_id
         LIMIT 1`,
        [sessionId, MAX_TEAM_SIZE]
    );

    return rows[0] || null;
}

async function createTeam(connection, sessionId) {
    const [countRows] = await connection.execute(
        `SELECT COUNT(*) AS total FROM teams WHERE session_id = ?`,
        [sessionId]
    );

    const teamNumber = Number(countRows[0].total) + 1;
    const teamName = `Team ${teamNumber}`;
    const teamColour = TEAM_COLOURS[(teamNumber - 1) % TEAM_COLOURS.length];

    const [result] = await connection.execute(
        `INSERT INTO teams (session_id, team_name, team_colour)
         VALUES (?, ?, ?)`,
        [sessionId, teamName, teamColour]
    );

    return {
        team_id: result.insertId,
        team_name: teamName,
        team_colour: teamColour
    };
}

async function findFreeSeat(connection, teamId) {
    const [rows] = await connection.execute(
        `SELECT seat_number FROM team_members WHERE team_id = ?`,
        [teamId]
    );

    const taken = rows.map((row) => row.seat_number);

    for (let seat = 1; seat <= MAX_TEAM_SIZE; seat++) {
        if (!taken.includes(seat)) {
            return seat;
        }
    }

    return null;
}

async function joinSession(req, res) {
    const { session_code } = req.body;

    if (typeof session_code !== "string" || !session_code.trim()) {
        return res.status(400).json({ message: "Session code is required." });
    }

    const code = session_code.trim().toUpperCase();
    const userId = req.session.user.user_id;
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Lock the session row so two students cannot take the same seat
        const [sessions] = await connection.execute(
            `SELECT session_id, status
             FROM game_sessions
             WHERE session_code = ?
             FOR UPDATE`,
            [code]
        );

        if (sessions.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Session not found." });
        }

        const session = sessions[0];

        if (session.status !== "waiting") {
            await connection.rollback();
            return res.status(409).json({
                message: "This session is not open for joining."
            });
        }

        if (await isAlreadyInSession(connection, session.session_id, userId)) {
            await connection.rollback();
            return res.status(409).json({
                message: "You have already joined this session."
            });
        }

        const team =
            (await findOpenTeam(connection, session.session_id)) ||
            (await createTeam(connection, session.session_id));

        const seatNumber = await findFreeSeat(connection, team.team_id);

        await connection.execute(
            `INSERT INTO team_members (team_id, user_id, seat_number)
             VALUES (?, ?, ?)`,
            [team.team_id, userId, seatNumber]
        );

        await connection.commit();

        return res.status(201).json({
            message: "Joined the session successfully.",
            session_id: session.session_id,
            team: { ...team, seat_number: seatNumber }
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Join session failed:", error.code || error.message);

        return res.status(500).json({
            message: "Could not join the session. Please try again."
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

/* ---------- Start / finish a session (lecturer) ---------- */

async function changeSessionStatus(req, res, rule) {
    const { fromStatus, toStatus, timeColumn, successMessage, afterChange } = rule;
    const sessionId = Number(req.params.sessionId);
    const lecturerId = req.session.user.user_id;

    if (!Number.isInteger(sessionId) || sessionId < 1) {
        return res.status(400).json({
            message: "Session ID must be a positive whole number."
        });
    }

    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Works only if: session exists + belongs to this lecturer + right status
        const [result] = await connection.execute(
            `UPDATE game_sessions
             SET status = ?, ${timeColumn} = NOW()
             WHERE session_id = ? AND lecturer_id = ? AND status = ?`,
            [toStatus, sessionId, lecturerId, fromStatus]
        );

        if (result.affectedRows === 1) {
            // Extra work that must succeed together with the status change.
            // It returns a message if something is wrong, or null if all is fine.
            const problem = afterChange ? await afterChange(connection, sessionId) : null;

            if (problem) {
                await connection.rollback();
                return res.status(409).json({ message: problem });
            }

            await connection.commit();

            return res.status(200).json({
                message: successMessage,
                session: { session_id: sessionId, status: toStatus }
            });
        }

        // Nothing changed: find out why
        await connection.rollback();

        const [rows] = await pool.execute(
            `SELECT lecturer_id, status FROM game_sessions WHERE session_id = ?`,
            [sessionId]
        );

        if (rows.length === 0 || rows[0].lecturer_id !== lecturerId) {
            return res.status(404).json({ message: "Session not found." });
        }

        return res.status(409).json({
            message: `The session is "${rows[0].status}", so this action is not allowed.`
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Change session status failed:", error.code || error.message);

        return res.status(500).json({
            message: "Could not update the session. Please try again."
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

function startSession(req, res) {
    return changeSessionStatus(req, res, {
        fromStatus: "waiting",
        toStatus: "active",
        timeColumn: "started_at",
        successMessage: "Session started.",
        // Make round 1 with a random player order
        afterChange: async (connection, sessionId) => {
            const firstPlayer = await startGame(connection, sessionId);
            return firstPlayer ? null : "No players have joined this session yet.";
        }
    });
}

function finishSession(req, res) {
    return changeSessionStatus(req, res, {
        fromStatus: "active",
        toStatus: "finished",
        timeColumn: "ended_at",
        successMessage: "Session finished."
    });
}

module.exports = { createSession, joinSession, startSession, finishSession };