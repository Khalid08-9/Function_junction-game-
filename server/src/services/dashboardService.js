const pool = require("../config/database");

// Gathers all the lecturer-dashboard statistics for one session.
// Used by /api/game/sessions/:sessionId/summary and by the dashboard page.
async function getSummaryData(sessionId, lecturerId) {
    const [sessions] = await pool.execute(
        `SELECT session_id, session_code, status, started_at, ended_at
         FROM game_sessions
         WHERE session_id = ? AND lecturer_id = ?`,
        [sessionId, lecturerId]
    );

    if (sessions.length === 0) {
        return null;
    }

    const [[players]] = await pool.execute(
        `SELECT COUNT(*) AS total
         FROM team_members tm
         JOIN teams t ON t.team_id = tm.team_id
         WHERE t.session_id = ?`,
        [sessionId]
    );

    const [[answers]] = await pool.execute(
        `SELECT COUNT(*) AS total, COALESCE(SUM(is_correct), 0) AS correct
         FROM attempts WHERE session_id = ?`,
        [sessionId]
    );

    const [teams] = await pool.execute(
        `SELECT team_id, team_name, team_colour, current_score
         FROM teams
         WHERE session_id = ?
         ORDER BY current_score DESC, team_id`,
        [sessionId]
    );

    const [recent] = await pool.execute(
        `SELECT a.attempt_id, u.full_name, t.team_name, a.is_correct,
                a.response_seconds, a.answered_at,
                COALESCE(se.points_change, 0) AS points
         FROM attempts a
         JOIN users u ON u.user_id = a.user_id
         JOIN teams t ON t.team_id = a.team_id
         LEFT JOIN score_event se ON se.attempt_id = a.attempt_id
         WHERE a.session_id = ?
         ORDER BY a.attempt_id DESC
         LIMIT 10`,
        [sessionId]
    );

    // The question students found hardest (lowest share of correct answers)
    const [hardest] = await pool.execute(
        `SELECT a.question_id, q.topic,
                COUNT(*) AS attempts, SUM(a.is_correct) AS correct
         FROM attempts a
         JOIN questions q ON q.question_id = a.question_id
         WHERE a.session_id = ?
         GROUP BY a.question_id, q.topic
         ORDER BY SUM(a.is_correct) / COUNT(*) ASC, COUNT(*) DESC, a.question_id
         LIMIT 1`,
        [sessionId]
    );

    const [top] = await pool.execute(
        `SELECT a.user_id, u.full_name, SUM(a.is_correct) AS correct_answers
         FROM attempts a
         JOIN users u ON u.user_id = a.user_id
         WHERE a.session_id = ?
         GROUP BY a.user_id, u.full_name
         HAVING SUM(a.is_correct) > 0
         ORDER BY SUM(a.is_correct) DESC, a.user_id
         LIMIT 1`,
        [sessionId]
    );

    // ---- Per-student evaluation breakdown ----
    const [studentBreakdown] = await pool.execute(
        `SELECT u.user_id, u.full_name, t.team_name, t.team_colour,
                COUNT(a.attempt_id) AS attempts,
                COALESCE(SUM(a.is_correct), 0) AS correct,
                ROUND(AVG(a.response_seconds)) AS avg_response_seconds
         FROM users u
         JOIN team_members tm ON tm.user_id = u.user_id
         JOIN teams t ON t.team_id = tm.team_id
         LEFT JOIN attempts a ON a.user_id = u.user_id AND a.session_id = ?
         WHERE t.session_id = ?
         GROUP BY u.user_id, u.full_name, t.team_name, t.team_colour
         ORDER BY correct DESC, attempts DESC, u.full_name`,
        [sessionId, sessionId]
    ).then(([rows]) => rows.map((row) => ({
        user_id: row.user_id,
        full_name: row.full_name,
        team_name: row.team_name,
        team_colour: row.team_colour,
        attempts: Number(row.attempts),
        correct: Number(row.correct),
        wrong: Number(row.attempts) - Number(row.correct),
        accuracy: Number(row.attempts)
            ? Math.round((Number(row.correct) * 100) / Number(row.attempts))
            : null,
        avg_response_seconds: row.avg_response_seconds
            ? Math.round(Number(row.avg_response_seconds))
            : null
    })));

    // ---- Per-question analysis (what the class struggled with) ----
    const [questionBreakdown] = await pool.execute(
        `SELECT q.question_id, q.topic, q.question_text,
                c.card_name, c.card_effect,
                COUNT(a.attempt_id) AS attempts,
                COALESCE(SUM(a.is_correct), 0) AS correct,
                ROUND(AVG(a.response_seconds)) AS avg_response_seconds
         FROM questions q
         JOIN cards c ON c.card_id = q.card_id
         JOIN attempts a ON a.question_id = q.question_id AND a.session_id = ?
         WHERE a.session_id = ?
         GROUP BY q.question_id, q.topic, q.question_text, c.card_name, c.card_effect
         ORDER BY (COALESCE(SUM(a.is_correct), 0) / COUNT(a.attempt_id)) ASC,
                  COUNT(a.attempt_id) DESC, q.question_id`,
        [sessionId, sessionId]
    ).then(([rows]) => rows.map((row) => ({
        question_id: row.question_id,
        topic: row.topic,
        question_text: row.question_text,
        card_name: row.card_name,
        card_effect: row.card_effect,
        attempts: Number(row.attempts),
        correct: Number(row.correct),
        wrong: Number(row.attempts) - Number(row.correct),
        success_percent: Number(row.attempts)
            ? Math.round((Number(row.correct) * 100) / Number(row.attempts))
            : null,
        avg_response_seconds: row.avg_response_seconds
            ? Math.round(Number(row.avg_response_seconds))
            : null
    })));

    // ---- Full attempt history for the session ----
    const [allAttempts] = await pool.execute(
        `SELECT a.attempt_id, u.full_name, t.team_name, q.topic,
                c.card_name, qo.option_label AS selected_option,
                a.is_correct, a.response_seconds, a.answered_at
         FROM attempts a
         JOIN users u ON u.user_id = a.user_id
         JOIN teams t ON t.team_id = a.team_id
         JOIN questions q ON q.question_id = a.question_id
         JOIN cards c ON c.card_id = q.card_id
         LEFT JOIN question_options qo ON qo.option_id = a.selected_option_id
         WHERE a.session_id = ?
         ORDER BY a.answered_at DESC`,
        [sessionId]
    ).then(([rows]) => rows.map((row) => ({
        attempt_id: row.attempt_id,
        full_name: row.full_name,
        team_name: row.team_name,
        topic: row.topic,
        card_name: row.card_name,
        selected_option: row.selected_option,
        is_correct: row.is_correct === 1,
        response_seconds: row.response_seconds,
        answered_at: row.answered_at
    })));

    const totalAnswers = Number(answers.total);
    const correctAnswers = Number(answers.correct);
    const hasLeader = teams.length > 0 && teams[0].current_score > 0;

    return {
        session: sessions[0],
        students: Number(players.total),
        answers: totalAnswers,
        correct_answers: correctAnswers,
        accuracy_percent: totalAnswers
            ? Math.round((correctAnswers * 100) / totalAnswers)
            : null,
        leading_team: hasLeader ? teams[0] : null,
        is_tie: hasLeader && teams.length > 1 &&
                teams[1].current_score === teams[0].current_score,
        teams,
        hardest_question: hardest[0]
            ? {
                question_id: hardest[0].question_id,
                topic: hardest[0].topic,
                attempts: Number(hardest[0].attempts),
                success_percent: Math.round(
                    (Number(hardest[0].correct) * 100) / Number(hardest[0].attempts)
                )
            }
            : null,
        top_performer: top[0]
            ? {
                user_id: top[0].user_id,
                full_name: top[0].full_name,
                correct_answers: Number(top[0].correct_answers)
            }
            : null,
        recent_activity: recent.map((row) => ({
            attempt_id: row.attempt_id,
            full_name: row.full_name,
            team_name: row.team_name,
            is_correct: row.is_correct === 1,
            points: row.points,
            response_seconds: row.response_seconds,
            answered_at: row.answered_at
        })),
        studentBreakdown,
        questionBreakdown,
        allAttempts
    };
}

module.exports = { getSummaryData };
