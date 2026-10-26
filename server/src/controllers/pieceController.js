const pool = require("../config/database");
const { canViewSession } = require("../utils/sessionAccess");
const pieceService = require("../services/pieceService");
const cardService = require("../services/cardService");
const turnService = require("../services/turnService");

// GET /api/game/sessions/:sessionId/pieces
async function getPieces(req, res) {
    const sessionId = Number(req.params.sessionId);
    const userId = req.session.user.user_id;

    if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return res.status(400).json({ message: "Invalid session ID." });
    }

    try {
        if (!(await canViewSession(sessionId, userId))) {
            return res.status(404).json({ message: "Session not found." });
        }

        const pieces = await pieceService.getPieces(sessionId);
        return res.status(200).json({ pieces });
    } catch (error) {
        console.error("Get pieces failed:", error.code || error.message);
        return res.status(500).json({ message: "Could not load pieces." });
    }
}

// POST /api/game/sessions/:sessionId/pieces/move
// Executes a marble action (enter, move, swap, or discard) and automatically advances turn
async function movePiece(req, res) {
    const sessionId = Number(req.params.sessionId);
    const userId = req.session.user.user_id;
    const {
        piece_id: pieceId,
        action,
        spaces = 0,
        target_piece_id: targetPieceId,
        card_id: cardId,
        card_name: cardName
    } = req.body;

    if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return res.status(400).json({ message: "Invalid session ID." });
    }
    if (!["move", "enter", "swap", "discard"].includes(action)) {
        return res.status(400).json({ message: "Valid action is required." });
    }
    if (action !== "discard" && !pieceId) {
        return res.status(400).json({ message: "piece_id is required." });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Check if user is in a team for this session and session is active
        const [members] = await connection.execute(
            `SELECT tm.team_id, gs.status, st.current_team_id
             FROM team_members tm
             JOIN teams t ON t.team_id = tm.team_id
             JOIN game_sessions gs ON gs.session_id = t.session_id
             LEFT JOIN game_state st ON st.session_id = t.session_id
             WHERE t.session_id = ? AND tm.user_id = ?
             FOR UPDATE`,
            [sessionId, userId]
        );

        if (members.length === 0) {
            await connection.rollback();
            return res.status(403).json({ message: "You are not a member of this session." });
        }

        const { team_id: teamId, status } = members[0];

        if (status !== "active") {
            await connection.rollback();
            return res.status(409).json({ message: "This session is not active." });
        }

        // Verify that it is specifically THIS player's turn (players cannot play on other players' turns!)
        const [[roundInfo]] = await connection.execute(
            `SELECT MAX(round_number) AS round_number FROM round_turns WHERE session_id = ?`,
            [sessionId]
        );
        const roundNumber = roundInfo ? roundInfo.round_number : 1;

        const [waiting] = await connection.execute(
            `SELECT rt.user_id, u.full_name
             FROM round_turns rt
             JOIN users u ON u.user_id = rt.user_id
             WHERE rt.session_id = ? AND rt.round_number = ? AND rt.played_at IS NULL
             ORDER BY rt.turn_order`,
            [sessionId, roundNumber]
        );

        if (waiting.length === 0 || waiting[0].user_id !== userId) {
            await connection.rollback();
            return res.status(403).json({
                message: `It is not your turn to play! Waiting for ${waiting[0] ? waiting[0].full_name : "another player"}.`
            });
        }

        let moveResult = { captured: [] };
        let actionDesc = "";

        if (action === "enter") {
            moveResult = await pieceService.enterPiece(connection, sessionId, teamId, pieceId, cardName || "");
            actionDesc = `${waiting[0].full_name} moved a marble onto the board.`;
        } else if (action === "swap") {
            if (!targetPieceId) {
                await connection.rollback();
                return res.status(400).json({ message: "target_piece_id is required for swap." });
            }
            moveResult = await pieceService.swapPieces(connection, sessionId, teamId, pieceId, targetPieceId);
            actionDesc = `${waiting[0].full_name} swapped marbles with an opponent.`;
        } else if (action === "move") {
            moveResult = await pieceService.movePiece(connection, sessionId, teamId, pieceId, Number(spaces), cardName || "");
            actionDesc = `${waiting[0].full_name} moved a marble ${spaces} space(s).`;
        } else if (action === "discard") {
            actionDesc = `${waiting[0].full_name} discarded a card (no valid moves).`;
        }

        // Record the card as played in this deal (removes it from player's hand)
        if (cardId || cardName) {
            await cardService.recordCardPlayed(connection, sessionId, userId, cardId, cardName);
        }

        // Check win condition (all 8 pieces in Safe zone)
        const hasWon = await pieceService.checkWin(connection, sessionId, teamId);
        if (hasWon) {
            await connection.execute(
                `UPDATE game_sessions SET status = 'finished', ended_at = NOW() WHERE session_id = ?`,
                [sessionId]
            );
        } else {
            // Automatically advance turn to the next player!
            await turnService.advanceTurn(connection, sessionId, userId, actionDesc);
        }

        const pieces = await pieceService.getPieces(sessionId);
        await connection.commit();

        return res.status(200).json({
            success: true,
            pieces,
            captured: moveResult.captured || [],
            won: hasWon,
            message: hasWon ? "Your team won the game!" : actionDesc
        });
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error("Move piece failed:", error.message);
        return res.status(400).json({ message: error.message || "Could not complete move." });
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

module.exports = { getPieces, movePiece };
