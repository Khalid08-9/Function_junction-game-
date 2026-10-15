const pool = require("../config/database");


async function canViewSession(sessionId, userId) {
    const [rows] = await pool.execute(
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

    return rows.length > 0;
}

module.exports = { canViewSession };