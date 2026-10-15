const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../middleware/authMiddleware");
const { submitAnswer, getLeaderboard } = require("../controllers/gameController");
const { getTurnState, endTurn } = require("../controllers/turnController");

// Student only
router.post("/answers", requireLogin, requireRole("student"), submitAnswer);

// Lecturer who owns the session, or a student in it
router.get("/sessions/:sessionId/leaderboard", requireLogin, getLeaderboard);

// Turns: who plays now? (lecturer who owns the session, or a student in it)
router.get("/sessions/:sessionId/turn", requireLogin, getTurnState);

// End the current turn (current player, or the lecturer who owns the session)
router.post("/sessions/:sessionId/turn/end", requireLogin, endTurn);

module.exports = router;