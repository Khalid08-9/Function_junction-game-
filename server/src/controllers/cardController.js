const pool = require("../config/database");
const { expireTurn } = require("../services/turnService");
const { selectCard, getPlayerHand } = require("../services/cardService");

async function playCard(req, res) {
    const sessionId = Number(req.params.sessionId);
    const userId = req.session.user.user_id;
    if (!Number.isInteger(sessionId) || sessionId <= 0 || typeof req.body.card_key !== "string") {
        return res.status(400).json({ message: "A session and a card from your hand are required." });
    }
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        if (await expireTurn(connection, sessionId)) {
            await connection.commit();
            return res.status(409).json({ message: "Time is up. The next player's turn has started." });
        }
        const [[current]] = await connection.execute(
            `SELECT rt.user_id, gs.status FROM round_turns rt
             JOIN game_sessions gs ON gs.session_id = rt.session_id
             WHERE rt.session_id = ? AND rt.played_at IS NULL
               AND rt.round_number = (SELECT MAX(round_number) FROM round_turns WHERE session_id = ?)
             ORDER BY rt.turn_order LIMIT 1`, [sessionId, sessionId]
        );
        if (!current || current.status !== "active" || current.user_id !== userId) {
            await connection.rollback();
            return res.status(403).json({ message: "Only the current player can select a card." });
        }
        const active = await selectCard(connection, sessionId, userId, req.body.card_id,
            req.body.card_key, req.body.turn_number);
        const hand = await getPlayerHand(sessionId, userId, connection);
        await connection.commit();
        return res.json({ ...hand, active_card: active });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Select card failed:", error.code || error.message);
        return res.status(error.status || 500).json({ message: error.status ? error.message : "Could not select the card." });
    } finally {
        if (connection) connection.release();
    }
}

module.exports = { playCard };
