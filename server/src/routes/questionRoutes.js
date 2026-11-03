const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../middleware/authMiddleware");
const bank = require("../controllers/questionBankController");
const { getQuestionByToken, getQuestionByCardId } = require("../controllers/questionController");

// Correct-answer flags and editing are available to lecturers only.
router.get("/manage", requireLogin, requireRole("lecturer"), bank.list);
router.post("/manage", requireLogin, requireRole("lecturer"), bank.create);
router.put("/manage/:questionId", requireLogin, requireRole("lecturer"), bank.update);
router.patch("/manage/:questionId/status", requireLogin, requireRole("lecturer"), bank.status);
router.delete("/manage/:questionId", requireLogin, requireRole("lecturer"), bank.remove);

// GET /api/questions/by-token/:qrToken -> any logged-in user
router.get("/by-token/:qrToken", requireLogin, getQuestionByToken);

// GET /api/questions/by-card/:cardId -> any logged-in user (in-browser card click)
router.get("/by-card/:cardId", requireLogin, getQuestionByCardId);

module.exports = router;
