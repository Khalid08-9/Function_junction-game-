const pool = require("../config/database");
const { canViewSession } = require("../utils/sessionAccess");

// GET /api/sessions -> the lecturer's own sessions, newest first
async function listMySessions(req, res) {
    const lecturerId = req.session.user.user_id;

    try {
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

        const sessions = rows.map((row) => ({
            ...row,
            team_count: Number(row.team_count),
            player_count: Number(row.player_count)
        }));

        return res.status(200).json({ sessions });
    } catch (error) {
        console.error("List sessions failed:", error.code || error.message);

        return res.status(500).json({
            message: "Could not load the sessions. Please try again."
        });
    }
}

// GET /api/sessions/:sessionId -> session, teams and players (waiting room)
async function getSession(req, res) {
    const sessionId = Number(req.params.sessionId);

    if (!Number.isInteger(sessionId) || sessionId < 1) {
        return res.status(400).json({
            message: "Session ID must be a positive whole number."
        });
    }

    try {
        if (!(await canViewSession(sessionId, req.session.user.user_id))) {
            return res.status(404).json({ message: "Session not found." });
        }

        const [[session]] = await pool.execute(
            `SELECT session_id, session_code, status, started_at, ended_at
             FROM game_sessions WHERE session_id = ?`,
            [sessionId]
        );

        // Only names are returned (no emails), because students can call this
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

        return res.status(200).json({ session, teams });
    } catch (error) {
        console.error("Get session failed:", error.code || error.message);

        return res.status(500).json({
            message: "Could not load the session. Please try again."
        });
    }
}

module.exports = { listMySessions, getSession };