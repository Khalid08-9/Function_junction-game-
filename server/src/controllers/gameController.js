const pool = require("../config/database");

const POINTS_FOR_CORRECT = 10; // wrong answers give 0 and never remove points
const MAX_RESPONSE_SECONDS = 3600;

function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}


async function submitAnswer(req, res) {
    const sessionId = Number(req.body.session_id);
    const questionId = Number(req.body.question_id);
    const optionId = Number(req.body.selected_option_id);
    const seconds = Number(req.body.response_seconds);
    const userId = req.session.user.user_id;

    if (
        !isPositiveInteger(sessionId) ||
        !isPositiveInteger(questionId) ||
        !isPositiveInteger(optionId) ||
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
            `SELECT tm.team_id, gs.status
             FROM team_members tm
             JOIN teams t ON t.team_id = tm.team_id
             JOIN game_sessions gs ON gs.session_id = t.session_id
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

        const { team_id: teamId, status } = members[0];

        // 2. The game must be running
        if (status !== "active") {
            await connection.rollback();
            return res.status(409).json({ message: "This session is not active." });
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

        // The SERVER decides if the answer is correct, never the browser
        const isCorrect = options[0].is_correct === 1;
        const points = isCorrect ? POINTS_FOR_CORRECT : 0;

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

        // 7. Collect what the result screen needs
        const [[info]] = await connection.execute(
            `SELECT q.explanation, c.full_action, c.basic_action
             FROM questions q
             JOIN cards c ON c.card_id = q.card_id
             WHERE q.question_id = ?`,
            [questionId]
        );

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

async function getLeaderboard(req, res) {
    const sessionId = Number(req.params.sessionId);
    const userId = req.session.user.user_id;

    if (!isPositiveInteger(sessionId)) {
        return res.status(400).json({
            message: "Session ID must be a positive whole number."
        });
    }

    try {
        const [allowed] = await pool.execute(
            `SELECT gs.session_id
             FROM game_sessions gs
             WHERE gs.session_id = ?
               AND (gs.lecturer_id = ?
                    OR EXISTS (
                        SELECT 1
                        FROM teams t
                        JOIN team_members tm ON tm.team_id = t.team_id
                        WHERE t.session_id = gs.session_id AND tm.user_id = ?
                    ))`,
            [sessionId, userId, userId]
        );

        if (allowed.length === 0) {
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

module.exports = { submitAnswer, getLeaderboard };