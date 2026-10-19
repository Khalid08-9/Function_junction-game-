const express = require("express");
const router = express.Router();

const { requireLogin } = require("../middleware/authMiddleware");
const { getQuestionByToken, getQuestionByCardId } = require("../controllers/questionController");

// GET /api/questions/by-token/:qrToken -> any logged-in user
router.get("/by-token/:qrToken", requireLogin, getQuestionByToken);

// GET /api/questions/by-card/:cardId -> any logged-in user (in-browser card click)
router.get("/by-card/:cardId", requireLogin, getQuestionByCardId);

module.exports = router;