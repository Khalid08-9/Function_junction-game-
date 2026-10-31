const express = require("express");
const router = express.Router();

const { asyncHandler } = require("../utils/asyncHandler");
const {
    requirePageLogin,
    requirePageRole,
    redirectIfLoggedIn
} = require("../middleware/pageAuth");
const pages = require("../controllers/pageController");

router.get("/", pages.showHome);

// Public pages
router.get("/login", redirectIfLoggedIn, pages.showLogin);
router.get("/register", redirectIfLoggedIn, pages.showRegister);
router.get("/register-lecturer", redirectIfLoggedIn, pages.showRegisterLecturer);
router.get("/how-to-play", pages.showHowToPlay);
router.get("/leaderboard", pages.showLeaderboardPage);

// Student
router.get("/play", requirePageLogin, requirePageRole("student"),
    asyncHandler(pages.showStudentHome));

// Lecturer
router.get("/lecturer", requirePageLogin, requirePageRole("lecturer"),
    asyncHandler(pages.showLecturerHome));

// Lecturer who owns the session, or a student in it
router.get("/sessions/:sessionId", requirePageLogin,
    asyncHandler(pages.showSession));

// The game room (only while the session is active)
router.get("/sessions/:sessionId/game", requirePageLogin,
    asyncHandler(pages.showGame));

// The lecturer dashboard for one session (owner only)
router.get("/lecturer/sessions/:sessionId/dashboard", requirePageLogin,
    requirePageRole("lecturer"),
    asyncHandler(pages.showDashboard));

module.exports = router;
