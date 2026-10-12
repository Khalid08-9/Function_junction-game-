const express = require("express");
const router = express.Router();

const { requireLogin } = require("../middleware/authMiddleware");
const { getQuestionByToken } = require("../controllers/questionController");

// GET /api/questions/by-token/:qrToken -> any logged-in user
router.get("/by-token/:qrToken", requireLogin, getQuestionByToken);

module.exports = router;