const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../middleware/authMiddleware");
const { submitAnswer, getLeaderboard } = require("../controllers/gameController");


router.post("/answers", requireLogin, requireRole("student"), submitAnswer);

router.get("/sessions/:sessionId/leaderboard", requireLogin, getLeaderboard);

module.exports = router;