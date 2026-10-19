const pool = require("../config/database");
const { canViewSession } = require("../utils/sessionAccess");

// Points for a correct answer depend on the card's difficulty.
// Wrong answers give 0 and never remove points.
const POINTS_BY_DIFFICULTY = {
    low: 5,
    medium: 10,
    high: 15,
    advanced: 20
};
const DEFAULT_POINTS = 10; // used only if a card has an unknown difficulty
const MAX_RESPONSE_SECONDS = 3600;

function pointsForDifficulty(difficulty) {
    const key = String(difficulty || "").trim().toLowerCase();

    if (!(key in POINTS_BY_DIFFICULTY)) {
        console.warn("Unknown card difficulty:", difficulty);
        return DEFAULT_POINTS;
    }

    return POINTS_BY_DIFFICULTY[key];
}

function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}

/* ---------- Submit an answer (student) ---------- */

async function submitAnswer(req, res) {
    const sessionId = Number(req.body.session_id);
    const questionId = Number(req.body.question_id);
    const optionId = Number(req.body.selected_option_id);
    const seconds = Number(req.body.response_seconds);
    const userId = req.session.user.user_id;

    const isTimedOut = req.body.timed_out === true;

    if (
        !isPositiveInteger(sessionId) ||
        !isPositiveInteger(questionId) ||
        (!isTimedOut && !isPositiveInteger(optionId)) ||
        !Number.isInteger(seconds) ||
        seconds < 0 ||
        seconds > MAX_RESPONSE_SECONDS
    ) {
        return res.status(400).json({
            message: "session_id, question_id, selected_option_id and response_seconds are required."
        });
    }

    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Is this student in a team of this session? (row is locked, so
        //    two quick submits cannot both pass the checks below)
        const [members] = await connection.execute(
            `SELECT tm.team_id, gs.status, st.current_team_id
             FROM team_members tm
             JOIN teams t ON t.team_id = tm.team_id
             JOIN game_sessions gs ON gs.session_id = t.session_id
             LEFT JOIN game_state st ON st.session_id = t.session_id
             WHERE t.session_id = ? AND tm.user_id = ?
             FOR UPDATE`,
            [sessionId, userId]
        );

        if (members.length === 0) {
            await connection.rollback();
            return res.status(403).json({
                message: "You are not a member of this session."
            });
        }

        const { team_id: teamId, status, current_team_id: currentTeamId } = members[0];

        // 2. The game must be running
        if (status !== "active") {
            await connection.rollback();
            return res.status(409).json({ message: "This session is not active." });
        }

        // 2b. Only the team whose turn it is can answer (any teammate may answer)
        if (currentTeamId !== teamId) {
            await connection.rollback();
            return res.status(403).json({
                message: "It is not your team's turn."
            });
        }

        // Handle timed out - no attempt recorded, just return basic result
        if (isTimedOut) {
            const [[cardInfo]] = await connection.execute(
                `SELECT c.card_name, c.basic_action
                 FROM questions q
                 JOIN cards c ON c.card_id = q.card_id
                 WHERE q.question_id = ?`,
                [questionId]
            );
            const [[teamScore]] = await connection.execute(
                `SELECT current_score FROM teams WHERE team_id = ?`,
                [teamId]
            );
            await connection.commit();
            return res.status(200).json({
                is_correct: false,
                card_name: cardInfo ? cardInfo.card_name : "Unknown",
                points_awarded: 0,
                team_score: teamScore ? teamScore.current_score : 0,
                card_action: cardInfo ? cardInfo.basic_action : "Basic move: advance 1 space",
                correct_option: null,
                explanation: null,
                timed_out: true
            });
        }

        // 3. One answer per student per question in a session
        const [previous] = await connection.execute(
            `SELECT attempt_id FROM attempts
             WHERE session_id = ? AND user_id = ? AND question_id = ?`,
            [sessionId, userId, questionId]
        );

        if (previous.length > 0) {
            await connection.rollback();
            return res.status(409).json({
                message: "You already answered this question in this session."
            });
        }

        // 4. The option must belong to the question, and the question be active
        const [options] = await connection.execute(
            `SELECT o.is_correct
             FROM question_options o
             JOIN questions q ON q.question_id = o.question_id
             WHERE o.option_id = ? AND o.question_id = ? AND q.is_active = 1`,
            [optionId, questionId]
        );

        if (options.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                message: "This option does not belong to this question."
            });
        }

        // Card details: explanation, actions and difficulty (for the points)
        const [[info]] = await connection.execute(
            `SELECT q.explanation, c.full_action, c.basic_action, c.difficulty, c.card_name
             FROM questions q
             JOIN cards c ON c.card_id = q.card_id
             WHERE q.question_id = ?`,
            [questionId]
        );

        // The SERVER decides if the answer is correct, never the browser
        const isCorrect = options[0].is_correct === 1;
        const points = isCorrect ? pointsForDifficulty(info.difficulty) : 0;

        // 5. Save the attempt
        const [attempt] = await connection.execute(
            `INSERT INTO attempts
                (session_id, team_id, user_id, question_id,
                 selected_option_id, is_correct, response_seconds)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [sessionId, teamId, userId, questionId, optionId, isCorrect ? 1 : 0, seconds]
        );

        // 6. Correct answer: record the score event and update the team score
        if (isCorrect) {
            await connection.execute(
                `INSERT INTO score_event
                    (session_id, team_id, attempt_id, points_change, reason)
                 VALUES (?, ?, ?, ?, ?)`,
                [sessionId, teamId, attempt.insertId, points, "Correct answer"]
            );

            await connection.execute(
                `UPDATE teams SET current_score = current_score + ?
                 WHERE team_id = ?`,
                [points, teamId]
            );
        }

        // 7. Collect the rest of what the result screen needs
        const [[correctOption]] = await connection.execute(
            `SELECT option_id, option_label, option_text
             FROM question_options
             WHERE question_id = ? AND is_correct = 1
             LIMIT 1`,
            [questionId]
        );

        const [[team]] = await connection.execute(
            `SELECT current_score FROM teams WHERE team_id = ?`,
            [teamId]
        );

        await connection.commit();

        return res.status(201).json({
            is_correct: isCorrect,
            card_name: info.card_name,
            points_awarded: points,
            team_score: team.current_score,
            card_action: isCorrect ? info.full_action : info.basic_action,
            correct_option: correctOption || null,
            explanation: info.explanation
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Submit answer failed:", error.code || error.message);

        return res.status(500).json({
            message: "Could not save the answer. Please try again."
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

/* ---------- Leaderboard (owner lecturer or a member student) ---------- */

/* ---------- QR Code Generation for a Card ---------- */
const QRCode = require("qrcode");

async function getCardQr(req, res) {
    const cardId = Number(req.params.cardId);
    const sessionId = Number(req.query.session_id);
    const teamId = Number(req.query.team_id);

    if (!isPositiveInteger(cardId)) {
        return res.status(400).json({ message: "Invalid card ID." });
    }

    try {
        const [[card]] = await pool.execute(
            `SELECT card_id, card_name, card_effect, qr_token FROM cards WHERE card_id = ?`,
            [cardId]
        );

        if (!card) {
            return res.status(404).json({ message: "Card not found." });
        }

        const host = req.get("host");
        const protocol = req.protocol;
        const mobileUrl = `${protocol}://${host}/q/${card.qr_token}?session=${sessionId || ""}&team=${teamId || ""}`;
        const qrDataUrl = await QRCode.toDataURL(mobileUrl, {
            width: 260,
            margin: 2,
            color: { dark: "#170d29", light: "#ffffff" }
        });

        return res.status(200).json({
            card_id: card.card_id,
            card_name: card.card_name,
            card_effect: card.card_effect,
            qr_token: card.qr_token,
            mobile_url: mobileUrl,
            qr_data_url: qrDataUrl
        });
    } catch (error) {
        console.error("Get card QR failed:", error.message);
        return res.status(500).json({ message: "Could not generate QR code." });
    }
}

/* ---------- Check Latest Answer (for Desktop polling while QR is shown) ---------- */
async function getLatestAttempt(req, res) {
    const sessionId = Number(req.params.sessionId);
    const sinceTimestamp = req.query.since || 0;

    if (!isPositiveInteger(sessionId)) {
        return res.status(400).json({ message: "Session ID required." });
    }

    try {
        const [rows] = await pool.execute(
            `SELECT a.attempt_id, a.session_id, a.team_id, a.user_id, a.question_id,
                    a.is_correct, a.response_seconds, a.answered_at,
                    q.card_id, c.card_name, c.full_action, c.basic_action, c.difficulty,
                    t.team_name, t.team_colour, t.current_score
             FROM attempts a
             JOIN questions q ON q.question_id = a.question_id
             JOIN cards c ON c.card_id = q.card_id
             JOIN teams t ON t.team_id = a.team_id
             WHERE a.session_id = ? AND a.attempt_id > ?
             ORDER BY a.attempt_id DESC
             LIMIT 1`,
            [sessionId, Number(sinceTimestamp) || 0]
        );

        if (rows.length === 0) {
            return res.status(200).json({ attempt: null });
        }

        const att = rows[0];
        const isCorrect = att.is_correct === 1;
        const points = isCorrect ? pointsForDifficulty(att.difficulty) : 0;

        return res.status(200).json({
            attempt: {
                attempt_id: att.attempt_id,
                card_name: att.card_name,
                is_correct: isCorrect,
                points_awarded: points,
                team_score: att.current_score,
                card_action: isCorrect ? att.full_action : att.basic_action,
                team_name: att.team_name,
                team_colour: att.team_colour
            }
        });
    } catch (error) {
        console.error("Get latest attempt failed:", error.message);
        return res.status(500).json({ message: "Could not check latest attempt." });
    }
}

/* ---------- Submit Answer from Mobile Phone ---------- */
async function submitMobileAnswer(req, res) {
    const sessionId = Number(req.body.session_id);
    const questionId = Number(req.body.question_id);
    const optionId = Number(req.body.selected_option_id);
    const seconds = Number(req.body.response_seconds) || 10;
    const isTimedOut = req.body.timed_out === true;
    let userId = req.session && req.session.user ? req.session.user.user_id : null;
    let teamId = Number(req.body.team_id);

    if (!isPositiveInteger(sessionId) || !isPositiveInteger(questionId) || (!isTimedOut && !isPositiveInteger(optionId))) {
        return res.status(400).json({ message: "Invalid parameters." });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // If userId not present, find active team's member or active player in session
        if (!userId) {
            if (teamId) {
                const [tm] = await connection.execute(
                    `SELECT user_id FROM team_members WHERE team_id = ? LIMIT 1`,
                    [teamId]
                );
                if (tm.length > 0) userId = tm[0].user_id;
            } else {
                const [gs] = await connection.execute(
                    `SELECT st.current_team_id, tm.user_id
                     FROM game_state st
                     JOIN team_members tm ON tm.team_id = st.current_team_id
                     WHERE st.session_id = ? LIMIT 1`,
                    [sessionId]
                );
                if (gs.length > 0) {
                    teamId = gs[0].current_team_id;
                    userId = gs[0].user_id;
                }
            }
        }

        if (!userId || !teamId) {
            await connection.rollback();
            return res.status(400).json({ message: "Could not identify team or player." });
        }

        // Fetch question info
        const [[info]] = await connection.execute(
            `SELECT q.explanation, c.card_name, c.full_action, c.basic_action, c.difficulty
             FROM questions q
             JOIN cards c ON c.card_id = q.card_id
             WHERE q.question_id = ?`,
            [questionId]
        );

        if (isTimedOut) {
            const [opts] = await connection.execute(
                `SELECT option_id FROM question_options WHERE question_id = ? LIMIT 1`,
                [questionId]
            );
            const fallbackOptionId = opts.length > 0 ? opts[0].option_id : 1;

            await connection.execute(
                `INSERT INTO attempts
                    (session_id, team_id, user_id, question_id, selected_option_id, is_correct, response_seconds)
                 VALUES (?, ?, ?, ?, ?, 0, ?)`,
                [sessionId, teamId, userId, questionId, fallbackOptionId, seconds]
            );

            const [[teamScore]] = await connection.execute(
                `SELECT current_score FROM teams WHERE team_id = ?`,
                [teamId]
            );
            await connection.commit();
            return res.status(200).json({
                is_correct: false,
                card_name: info ? info.card_name : "Unknown",
                points_awarded: 0,
                team_score: teamScore ? teamScore.current_score : 0,
                card_action: info ? info.basic_action : "Basic move: advance 1 space",
                timed_out: true
            });
        }

        const [options] = await connection.execute(
            `SELECT is_correct FROM question_options WHERE option_id = ? AND question_id = ?`,
            [optionId, questionId]
        );

        if (options.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: "Invalid option." });
        }

        const isCorrect = options[0].is_correct === 1;
        const points = isCorrect ? pointsForDifficulty(info.difficulty) : 0;

        const [attempt] = await connection.execute(
            `INSERT INTO attempts
                (session_id, team_id, user_id, question_id, selected_option_id, is_correct, response_seconds)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [sessionId, teamId, userId, questionId, optionId, isCorrect ? 1 : 0, seconds]
        );

        if (isCorrect) {
            await connection.execute(
                `INSERT INTO score_event (session_id, team_id, attempt_id, points_change, reason)
                 VALUES (?, ?, ?, ?, ?)`,
                [sessionId, teamId, attempt.insertId, points, "Mobile answer"]
            );
            await connection.execute(
                `UPDATE teams SET current_score = current_score + ? WHERE team_id = ?`,
                [points, teamId]
            );
        }

        const [[team]] = await connection.execute(
            `SELECT current_score FROM teams WHERE team_id = ?`,
            [teamId]
        );

        await connection.commit();

        return res.status(201).json({
            is_correct: isCorrect,
            card_name: info.card_name,
            points_awarded: points,
            team_score: team.current_score,
            card_action: isCorrect ? info.full_action : info.basic_action,
            explanation: info.explanation
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Submit mobile answer error:", error.message);
        return res.status(500).json({ message: "Could not record answer." });
    } finally {
        if (connection) connection.release();
    }
}

/* ---------- Leaderboard (owner lecturer or a member student) ---------- */
async function getLeaderboard(req, res) {
    const sessionId = Number(req.params.sessionId);
    const userId = req.session && req.session.user ? req.session.user.user_id : null;

    if (!isPositiveInteger(sessionId)) {
        return res.status(400).json({
            message: "Session ID must be a positive whole number."
        });
    }

    try {
        if (userId && !(await canViewSession(sessionId, userId))) {
            return res.status(404).json({ message: "Session not found." });
        }

        const [teams] = await pool.execute(
            `SELECT team_id, team_name, team_colour, current_score
             FROM teams
             WHERE session_id = ?
             ORDER BY current_score DESC, team_id`,
            [sessionId]
        );

        return res.status(200).json({ session_id: sessionId, teams });
    } catch (error) {
        console.error("Leaderboard failed:", error.code || error.message);

        return res.status(500).json({
            message: "Could not load the leaderboard. Please try again."
        });
    }
}

module.exports = { submitAnswer, getLeaderboard, getCardQr, getLatestAttempt, submitMobileAnswer };