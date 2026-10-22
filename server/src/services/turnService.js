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
// Teammates play AFTER the opposing team.
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

        // Alternate starting team across rounds
        const startWithTeam1 = (roundNumber % 2 !== 0);
        const firstTeam = startWithTeam1 ? team1Players : team2Players;
        const secondTeam = startWithTeam1 ? team2Players : team1Players;

        const maxCount = Math.max(firstTeam.length, secondTeam.length);
        for (let i = 0; i < maxCount; i++) {
            if (firstTeam[i]) order.push(firstTeam[i]);
            if (secondTeam[i]) order.push(secondTeam[i]);
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

// Called when the lecturer starts the session: makes round 1 and the game state.
// Returns the first player, or null if nobody has joined.
async function startGame(connection, sessionId) {
    const order = await createRound(connection, sessionId, 1);

    if (order.length === 0) {
        return null;
    }

    // Initialize pieces for all teams in the session
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

module.exports = { createRound, startGame };