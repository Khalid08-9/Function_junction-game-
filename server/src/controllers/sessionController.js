const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../middleware/authMiddleware");
const {
    createSession,
    joinSession,
    startSession,
    finishSession
} = require("../controllers/sessionController");

// Lecturer only
router.post("/", requireLogin, requireRole("lecturer"), createSession);
router.post("/:sessionId/start", requireLogin, requireRole("lecturer"), startSession);
router.post("/:sessionId/finish", requireLogin, requireRole("lecturer"), finishSession);

// Student only
router.post("/join", requireLogin, requireRole("student"), joinSession);

module.exports = router;