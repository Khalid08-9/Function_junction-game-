const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../middleware/authMiddleware");
const { submitAnswer, getLeaderboard, getLatestAttempt, submitMobileAnswer, getHand } = require("../controllers/gameController");
const { getTurnState, endTurn } = require("../controllers/turnController");
const { getSummary } = require("../controllers/dashboardController");
const { getPieces, movePiece } = require("../controllers/pieceController");
const { playCard, scanCard } = require("../controllers/cardController");

// Student only
router.post("/answers", requireLogin, requireRole("student"), submitAnswer);

// Hand of 5 random cards per round
router.get("/sessions/:sessionId/hand", requireLogin, getHand);
router.post("/sessions/:sessionId/cards/select", requireLogin, requireRole("student"), playCard);
router.post("/sessions/:sessionId/cards/scan", requireLogin, requireRole("student"), scanCard);

// Legacy authenticated answer endpoint; the website camera uses /answers.
router.post("/mobile-answer", requireLogin, requireRole("student"), submitMobileAnswer);

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
