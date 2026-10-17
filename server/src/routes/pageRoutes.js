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

// Student
router.get("/play", requirePageLogin, requirePageRole("student"),
    asyncHandler(pages.showStudentHome));

// Lecturer
router.get("/lecturer", requirePageLogin, requirePageRole("lecturer"),
    asyncHandler(pages.showLecturerHome));

// Lecturer who owns the session, or a student in it
router.get("/sessions/:sessionId", requirePageLogin,
    asyncHandler(pages.showSession));

module.exports = router;
