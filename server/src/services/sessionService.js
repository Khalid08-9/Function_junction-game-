const pool = require("../config/database");
const { parseGameStateMeta } = require("./cardService");

async function getLecturerSessions(lecturerId) {
    const [rows] = await pool.execute(
        `SELECT gs.session_id, gs.session_code, gs.status, gs.started_at, gs.ended_at,
                (SELECT COUNT(*) FROM teams t
                 WHERE t.session_id = gs.session_id) AS team_count,
                (SELECT COUNT(*) FROM team_members tm
                 JOIN teams t ON t.team_id = tm.team_id
                 WHERE t.session_id = gs.session_id) AS player_count
         FROM game_sessions gs
         WHERE gs.lecturer_id = ?
         ORDER BY gs.session_id DESC`,
        [lecturerId]
    );

    return rows.map((row) => ({
        ...row,
        team_count: Number(row.team_count),
        player_count: Number(row.player_count)
    }));
}

// Sessions a student has joined, with the student's own team
async function getStudentSessions(userId) {
    const [rows] = await pool.execute(
        `SELECT gs.session_id, gs.session_code, gs.status, t.team_name, t.team_colour
         FROM team_members tm
         JOIN teams t ON t.team_id = tm.team_id
         JOIN game_sessions gs ON gs.session_id = t.session_id
         WHERE tm.user_id = ?
         ORDER BY gs.session_id DESC`,
        [userId]
    );

    return rows;
}

// Session + teams + players (names only, no emails). Includes lecturer_id,
// so the API controller removes it before answering.
async function getSessionWithTeams(sessionId) {
    const [sessions] = await pool.execute(
        `SELECT gs.session_id, gs.lecturer_id, gs.session_code, gs.status, gs.started_at, gs.ended_at,
                st.last_action AS card_settings
         FROM game_sessions gs LEFT JOIN game_state st ON st.session_id = gs.session_id
         WHERE gs.session_id = ?`,
        [sessionId]
    );

    if (sessions.length === 0) {
        return null;
    }

    const [rows] = await pool.execute(
        `SELECT t.team_id, t.team_name, t.team_colour, t.current_score,
                tm.user_id, tm.seat_number, u.full_name
         FROM teams t
         LEFT JOIN team_members tm ON tm.team_id = t.team_id
         LEFT JOIN users u ON u.user_id = tm.user_id
         WHERE t.session_id = ?
         ORDER BY t.team_id, tm.seat_number`,
        [sessionId]
    );

    const teams = [];

    for (const row of rows) {
        let team = teams.find((item) => item.team_id === row.team_id);

        if (!team) {
            team = {
                team_id: row.team_id,
                team_name: row.team_name,
                team_colour: row.team_colour,
                current_score: row.current_score,
                members: []
            };
            teams.push(team);
        }

        if (row.user_id !== null) {
            team.members.push({
                user_id: row.user_id,
                full_name: row.full_name,
                seat_number: row.seat_number
            });
        }
    }

    const { card_settings, ...session } = sessions[0];
    session.card_mode = parseGameStateMeta(card_settings).card_mode === "physical" ? "physical" : "digital";
    return { session, teams };
}

module.exports = { getLecturerSessions, getStudentSessions, getSessionWithTeams };
