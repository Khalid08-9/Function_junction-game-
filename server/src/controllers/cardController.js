const pool = require("../config/database");
const { expireTurn } = require("../services/turnService");
const { selectCard, selectPhysicalCard, preparePhysicalQuestion, getPlayerHand } = require("../services/cardService");

async function selectPlayerCard(req, res, physical) {
    const sessionId = Number(req.params.sessionId);
    const userId = req.session.user.user_id;
    if (!Number.isInteger(sessionId) || sessionId <= 0 ||
        (physical ? typeof req.body.qr_token !== "string" || req.body.qr_token.length > 100 : typeof req.body.card_key !== "string")) {
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
        const active = physical
            ? await selectPhysicalCard(connection, sessionId, userId, req.body.qr_token, req.body.turn_number)
            : await selectCard(connection, sessionId, userId, req.body.card_id, req.body.card_key, req.body.turn_number);
        if (physical) await preparePhysicalQuestion(connection, sessionId, userId);
        const hand = await getPlayerHand(sessionId, userId, connection);
        await connection.commit();
        return res.json({ ...hand, active_card: physical ? hand.active_card : active });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Select card failed:", error.code || error.message);
        return res.status(error.status || 500).json({ message: error.status ? error.message : "Could not select the card." });
    } finally {
        if (connection) connection.release();
    }
}

const playCard = (req, res) => selectPlayerCard(req, res, false);
const scanCard = (req, res) => selectPlayerCard(req, res, true);

module.exports = { playCard, scanCard };
