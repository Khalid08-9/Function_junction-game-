const pool = require("../config/database");
const { canViewSession } = require("../utils/sessionAccess");
const pieceService = require("../services/pieceService");

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
async function movePiece(req, res) {
    const sessionId = Number(req.params.sessionId);
    const userId = req.session.user.user_id;
    const { piece_id: pieceId, action, spaces = 0, target_piece_id: targetPieceId } = req.body;

    if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return res.status(400).json({ message: "Invalid session ID." });
    }
    if (!pieceId || !["move", "enter", "swap"].includes(action)) {
        return res.status(400).json({ message: "piece_id and valid action are required." });
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

        const { team_id: teamId, status, current_team_id: currentTeamId } = members[0];

        if (status !== "active") {
            await connection.rollback();
            return res.status(409).json({ message: "This session is not active." });
        }

        if (currentTeamId !== teamId) {
            await connection.rollback();
            return res.status(403).json({ message: "It is not your team's turn." });
        }

        let moveResult;
        let captured = [];

        if (action === "enter") {
            const cardName = req.body.card_name || "";
            moveResult = await pieceService.enterPiece(connection, sessionId, teamId, pieceId, cardName);
            captured = moveResult.captured || [];
        } else if (action === "swap") {
            if (!targetPieceId) {
                await connection.rollback();
                return res.status(400).json({ message: "target_piece_id is required for swap." });
            }
            moveResult = await pieceService.swapPieces(connection, sessionId, teamId, pieceId, targetPieceId);
        } else if (action === "move") {
            const isKing = Number(spaces) === 13;
            const isJoker = Boolean(req.body.is_joker);
            moveResult = await pieceService.movePiece(connection, sessionId, teamId, pieceId, Number(spaces), isKing, isJoker);
            captured = moveResult.captured || [];
        }

        // Check win condition
        const hasWon = await pieceService.checkWin(connection, sessionId, teamId);
        if (hasWon) {
            await connection.execute(
                `UPDATE game_sessions SET status = 'finished', ended_at = NOW() WHERE session_id = ?`,
                [sessionId]
            );
        }

        const pieces = await pieceService.getPieces(sessionId);
        await connection.commit();

        return res.status(200).json({
            success: true,
            pieces,
            captured,
            won: hasWon,
            message: hasWon ? "Your team won the game!" : "Move completed."
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

