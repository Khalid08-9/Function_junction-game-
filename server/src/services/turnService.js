const crypto = require("crypto");

// Fisher-Yates shuffle using a secure random number
function shuffle(items) {
    const list = [...items];
    for (let i = list.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

// Creates round turns where teams alternate strictly:
// Team 1 Player 1 -> Team 2 Player 1 -> Team 1 Player 2 -> Team 2 Player 2
// Clockwise play around the table with opposing teammates sitting across each other.
async function createRound(connection, sessionId, roundNumber) {
    const [players] = await connection.execute(
        `SELECT tm.user_id, tm.team_id, u.full_name
         FROM team_members tm
         JOIN teams t ON t.team_id = tm.team_id
         JOIN users u ON u.user_id = tm.user_id
         WHERE t.session_id = ?
         ORDER BY tm.team_id, tm.user_id`,
        [sessionId]
    );

    const [teams] = await connection.execute(
        `SELECT team_id FROM teams WHERE session_id = ? ORDER BY team_id`,
        [sessionId]
    );

    let order = [];
    if (teams.length >= 2) {
        const team1Players = players.filter(p => p.team_id === teams[0].team_id);
        const team2Players = players.filter(p => p.team_id === teams[1].team_id);

        // Seat 0 (Team 1 P1), Seat 1 (Team 2 P1), Seat 2 (Team 1 P2), Seat 3 (Team 2 P2)
        const tableSeats = [];
        const maxCount = Math.max(team1Players.length, team2Players.length);
        for (let i = 0; i < maxCount; i++) {
            if (team1Players[i]) tableSeats.push(team1Players[i]);
            if (team2Players[i]) tableSeats.push(team2Players[i]);
        }

        // Rotate starting player clockwise across rounds:
        if (tableSeats.length > 0) {
            const shift = (roundNumber - 1) % tableSeats.length;
            order = tableSeats.slice(shift).concat(tableSeats.slice(0, shift));
        } else {
            order = tableSeats;
        }
    } else {
        order = players;
    }

    for (let i = 0; i < order.length; i++) {
        await connection.execute(
            `INSERT INTO round_turns
                (session_id, round_number, turn_order, user_id, team_id)
             VALUES (?, ?, ?, ?, ?)`,
            [sessionId, roundNumber, i + 1, order[i].user_id, order[i].team_id]
        );
    }

    return order;
}

const { initializePieces } = require("./pieceService");

async function startGame(connection, sessionId) {
    const order = await createRound(connection, sessionId, 1);

    if (order.length === 0) {
        return null;
    }

    const [teams] = await connection.execute(
        `SELECT team_id FROM teams WHERE session_id = ? ORDER BY team_id`,
        [sessionId]
    );
    await initializePieces(connection, sessionId, teams);

    await connection.execute(
        `INSERT INTO game_state (session_id, current_team_id, turn_number, last_action)
         VALUES (?, ?, 1, ?)`,
        [sessionId, order[0].team_id, `Round 1 started. ${order[0].full_name} plays first.`]
    );

    return order[0];
}

// Advances the turn to the next player. Called automatically after a card action.
async function advanceTurn(connection, sessionId, userId, actionSummary = "") {
    const [[round]] = await connection.execute(
        `SELECT MAX(round_number) AS round_number FROM round_turns WHERE session_id = ?`,
        [sessionId]
    );
    const roundNumber = round ? round.round_number : 1;

    const [waiting] = await connection.execute(
        `SELECT rt.round_turn_id, rt.user_id, u.full_name
         FROM round_turns rt
         JOIN users u ON u.user_id = rt.user_id
         WHERE rt.session_id = ? AND rt.round_number = ? AND rt.played_at IS NULL
         ORDER BY rt.turn_order`,
        [sessionId, roundNumber]
    );

    if (waiting.length === 0) return null;

    const current = waiting[0];
    await connection.execute(
        `UPDATE round_turns SET played_at = NOW() WHERE round_turn_id = ?`,
        [current.round_turn_id]
    );

    let next = waiting[1];
    let roundComplete = false;
    let lastActionText;

    if (next) {
        lastActionText = actionSummary
            ? `${actionSummary} ${next.full_name} plays next.`
            : `${current.full_name} ended their turn. ${next.full_name} plays next.`;
    } else {
        roundComplete = true;
        const newOrder = await createRound(connection, sessionId, roundNumber + 1);
        next = newOrder[0];
        lastActionText = `Round ${roundNumber} complete. Round ${roundNumber + 1} starts: ${next.full_name} plays first.`;
    }

    const [[nextTeam]] = await connection.execute(
        `SELECT team_id FROM team_members tm
         WHERE tm.user_id = ? AND tm.team_id IN
               (SELECT team_id FROM teams WHERE session_id = ?)`,
        [next.user_id, sessionId]
    );

    // Preserve metadata if present
    const [states] = await connection.execute(
        `SELECT last_action FROM game_state WHERE session_id = ?`,
        [sessionId]
    );
    let stateMeta = { text: lastActionText, played_cards: {}, current_deal: Math.floor((roundNumber - 1) / 5) + 1 };
    if (states[0] && states[0].last_action) {
        try {
            const parsed = JSON.parse(states[0].last_action);
            if (parsed && typeof parsed === "object") {
                stateMeta = parsed;
                stateMeta.text = lastActionText;
            }
        } catch (e) {
            stateMeta.text = lastActionText;
        }
    }

    await connection.execute(
        `UPDATE game_state
         SET current_team_id = ?, turn_number = turn_number + 1, last_action = ?
         WHERE session_id = ?`,
        [nextTeam.team_id, JSON.stringify(stateMeta), sessionId]
    );

    return {
        round_number: roundComplete ? roundNumber + 1 : roundNumber,
        round_complete: roundComplete,
        next_player: next
    };
}

module.exports = { createRound, startGame, advanceTurn };
