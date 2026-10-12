const express = require("express");
const router = express.Router();

const { requireLogin, requireRole } = require("../middleware/authMiddleware");
const { createSession } = require("../controllers/sessionController");

// POST /api/sessions -> only a logged-in lecturer can create a session
router.post("/", requireLogin, requireRole("lecturer"), createSession);

module.exports = router;