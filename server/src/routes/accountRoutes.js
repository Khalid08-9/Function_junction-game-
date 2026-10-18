const express = require("express");
const router = express.Router();

const { requireLogin } = require("../middleware/authMiddleware");
const { registerLecturer, getMe } = require("../controllers/accountController");

router.post("/register-lecturer", registerLecturer);
router.get("/me", requireLogin, getMe);

module.exports = router;