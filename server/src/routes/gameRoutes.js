const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../middleware/authMiddleware");
const { submitAnswer, getLeaderboard, getCardQr, getLatestAttempt, submitMobileAnswer, getHand } = require("../controllers/gameController");
const { getTurnState, endTurn } = require("../controllers/turnController");
const { getSummary } = require("../controllers/dashboardController");
const { getPieces, movePiece } = require("../controllers/pieceController");

// Student only
router.post("/answers", requireLogin, requireRole("student"), submitAnswer);

// Hand of 5 random cards per round
router.get("/sessions/:sessionId/hand", requireLogin, getHand);

// Mobile answer (called from scanned phone)
router.post("/mobile-answer", submitMobileAnswer);

// Generate QR code for a card to be scanned by phone
router.get("/card-qr/:cardId", getCardQr);

// Polling for latest submitted answer (used while QR is shown)
router.get("/sessions/:sessionId/latest-attempt", getLatestAttempt);

// Lecturer who owns the session, or a student in it
router.get("/sessions/:sessionId/leaderboard", requireLogin, getLeaderboard);

// Lecturer dashboard (lecturer who owns the session)
router.get("/sessions/:sessionId/summary", requireLogin, requireRole("lecturer"), getSummary);

// Turns: who plays now? (lecturer who owns the session, or a student in it)
router.get("/sessions/:sessionId/turn", requireLogin, getTurnState);

// End the current turn (current player, or the lecturer who owns the session)
router.post("/sessions/:sessionId/turn/end", requireLogin, endTurn);

// Pieces (Jackaroo board marbles)
router.get("/sessions/:sessionId/pieces", requireLogin, getPieces);
router.post("/sessions/:sessionId/pieces/move", requireLogin, movePiece);

module.exports = router;