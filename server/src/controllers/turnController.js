const pool = require("../config/database");
const { canViewSession } = require("../utils/sessionAccess");
const { createRound } = require("../services/turnService");

function parseSessionId(req) {
    const sessionId = Number(req.params.sessionId);
    return Number.isInteger(sessionId) && sessionId > 0 ? sessionId : null;
}

// Reads the current game state. "db" can be the pool or a transaction connection.
async function loadTurnState(db, sessionId) {
    const [states] = await db.execute(
        `SELECT turn_number, last_action FROM game_state WHERE session_id = ?`,
        [sessionId]
    );

    if (states.length === 0) {
        return null;
    }

    const [[round]] = await db.execute(
        `SELECT MAX(round_number) AS round_number
         FROM round_turns WHERE session_id = ?`,
        [sessionId]
    );

    const [turns] = await db.execute(
        `SELECT rt.turn_order, rt.user_id, rt.team_id, rt.played_at,
                u.full_name, t.team_name, t.team_colour
         FROM round_turns rt
         JOIN users u ON u.user_id = rt.user_id
         JOIN teams t ON t.team_id = rt.team_id
         WHERE rt.session_id = ? AND rt.round_number = ?
         ORDER BY rt.turn_order`,
        [sessionId, round.round_number]
    );

    const current = turns.find((turn) => turn.played_at === null) || null;

    let actionText = states[0].last_action || "";
    try {
        const parsed = JSON.parse(actionText);
        if (parsed && typeof parsed === "object" && parsed.text) {
            actionText = parsed.text;
        }
    } catch (e) {}

    return {
        session_id: sessionId,
        round_number: round.round_number,
        turn_number: states[0].turn_number,
        last_action: actionText,
        current_player: current && {
            user_id: current.user_id,
            full_name: current.full_name,
            team_id: current.team_id,
            team_name: current.team_name,
            team_colour: current.team_colour
        },
        order: turns.map((turn) => ({
            turn_order: turn.turn_order,
            user_id: turn.user_id,
            full_name: turn.full_name,
            team_id: turn.team_id,
            team_colour: turn.team_colour,
            played: turn.played_at !== null
        }))
    };
}

/* ---------- Who is playing now? ---------- */

async function getTurnState(req, res) {
    const sessionId = parseSessionId(req);

    if (!sessionId) {
        return res.status(400).json({
            message: "Session ID must be a positive whole number."
        });
    }

    try {
        if (!(await canViewSession(sessionId, req.session.user.user_id))) {
            return res.status(404).json({ message: "Session not found." });
        }

        const state = await loadTurnState(pool, sessionId);

        if (!state) {
            return res.status(404).json({ message: "The game has not started yet." });
        }

        return res.status(200).json(state);
    } catch (error) {
        console.error("Get turn state failed:", error.code || error.message);

        return res.status(500).json({
            message: "Could not load the turn. Please try again."
        });
    }
}

/* ---------- End the current turn ---------- */
// Allowed for the current player, or for the lecturer who owns the session
// (for example, to skip a player who left).

async function endTurn(req, res) {
    const sessionId = parseSessionId(req);
    const userId = req.session.user.user_id;

    if (!sessionId) {
        return res.status(400).json({
            message: "Session ID must be a positive whole number."
        });
    }

    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Lock the game state, so two "end turn" requests cannot clash
        const [states] = await connection.execute(
            `SELECT gs.status, gs.lecturer_id
             FROM game_state st
             JOIN game_sessions gs ON gs.session_id = st.session_id
             WHERE st.session_id = ?
             FOR UPDATE`,
            [sessionId]
        );

        if (states.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "The game has not started yet." });
        }

        if (states[0].status !== "active") {
            await connection.rollback();
            return res.status(409).json({ message: "This session is not active." });
        }

        const [[round]] = await connection.execute(
            `SELECT MAX(round_number) AS round_number
             FROM round_turns WHERE session_id = ?`,
            [sessionId]
        );

        const [waiting] = await connection.execute(
            `SELECT rt.round_turn_id, rt.user_id, u.full_name
             FROM round_turns rt
             JOIN users u ON u.user_id = rt.user_id
             WHERE rt.session_id = ? AND rt.round_number = ? AND rt.played_at IS NULL
             ORDER BY rt.turn_order`,
            [sessionId, round.round_number]
        );

        const current = waiting[0];
        const isOwnerLecturer = states[0].lecturer_id === userId;

        if (!current || (current.user_id !== userId && !isOwnerLecturer)) {
            await connection.rollback();
            return res.status(403).json({
                message: "Only the current player or the lecturer can end this turn."
            });
        }

        await connection.execute(
            `UPDATE round_turns SET played_at = NOW() WHERE round_turn_id = ?`,
            [current.round_turn_id]
        );

        let next = waiting[1];
        let roundComplete = false;
        let lastAction;

        if (next) {
            lastAction = `${current.full_name} ended their turn. ${next.full_name} plays next.`;
        } else {
            // Everybody played: start a new round with a NEW random order
            roundComplete = true;
            const newOrder = await createRound(connection, sessionId, round.round_number + 1);
            next = newOrder[0];
            lastAction = `Round ${round.round_number} complete. ` +
                `Round ${round.round_number + 1} starts: ${next.full_name} plays first.`;
        }

        const [[nextTeam]] = await connection.execute(
            `SELECT team_id FROM team_members tm
             WHERE tm.user_id = ? AND tm.team_id IN
                   (SELECT team_id FROM teams WHERE session_id = ?)`,
            [next.user_id, sessionId]
        );

        await connection.execute(
            `UPDATE game_state
             SET current_team_id = ?, turn_number = turn_number + 1, last_action = ?
             WHERE session_id = ?`,
            [nextTeam.team_id, lastAction, sessionId]
        );

        const state = await loadTurnState(connection, sessionId);

        await connection.commit();

        return res.status(200).json({
            message: roundComplete ? "Round complete. A new round started." : "Turn ended.",
            round_complete: roundComplete,
            ...state
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("End turn failed:", error.code || error.message);

        return res.status(500).json({
            message: "Could not end the turn. Please try again."
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

module.exports = { getTurnState, endTurn };