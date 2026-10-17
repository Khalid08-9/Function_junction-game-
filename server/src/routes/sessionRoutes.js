const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../middleware/authMiddleware");
const {
    createSession,
    joinSession,
    startSession,
    finishSession
} = require("../controllers/sessionController");
const { listMySessions, getSession } = require("../controllers/sessionQueryController");

// Lecturer only
router.post("/", requireLogin, requireRole("lecturer"), createSession);
router.post("/:sessionId/start", requireLogin, requireRole("lecturer"), startSession);
router.post("/:sessionId/finish", requireLogin, requireRole("lecturer"), finishSession);

// Lecturer: list my sessions
router.get("/", requireLogin, requireRole("lecturer"), listMySessions);

// Lecturer who owns the session, or a student in it: teams and players
router.get("/:sessionId", requireLogin, getSession);

// Student only
router.post("/join", requireLogin, requireRole("student"), joinSession);

module.exports = router;