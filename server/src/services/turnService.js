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

// Saves a new random order of ALL players of the session for one round.
// Returns the players in their new order.
async function createRound(connection, sessionId, roundNumber) {
    const [players] = await connection.execute(
        `SELECT tm.user_id, tm.team_id, u.full_name
         FROM team_members tm
         JOIN teams t ON t.team_id = tm.team_id
         JOIN users u ON u.user_id = tm.user_id
         WHERE t.session_id = ?`,
        [sessionId]
    );

    const order = shuffle(players);

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

// Called when the lecturer starts the session: makes round 1 and the game state.
// Returns the first player, or null if nobody has joined.
async function startGame(connection, sessionId) {
    const order = await createRound(connection, sessionId, 1);

    if (order.length === 0) {
        return null;
    }

    await connection.execute(
        `INSERT INTO game_state (session_id, current_team_id, turn_number, last_action)
         VALUES (?, ?, 1, ?)`,
        [sessionId, order[0].team_id, `Round 1 started. ${order[0].full_name} plays first.`]
    );

    return order[0];
}

module.exports = { createRound, startGame };