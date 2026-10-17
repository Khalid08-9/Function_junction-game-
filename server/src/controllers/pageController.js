const { canViewSession } = require("../utils/sessionAccess");
const {
    getLecturerSessions,
    getStudentSessions,
    getSessionWithTeams
} = require("../services/sessionService");
const { homeFor } = require("../middleware/pageAuth");

function showNotFound(res) {
    return res.status(404).render("error", {
        pageTitle: "Not found",
        heading: "Page not found",
        text: "This page does not exist, or you cannot open it."
    });
}

function showHome(req, res) {
    const user = req.session.user;

    return res.redirect(user ? homeFor(user) : "/login");
}

function showLogin(req, res) {
    return res.render("login", { pageTitle: "Sign in" });
}

function showRegister(req, res) {
    return res.render("register", {
        pageTitle: "Create an account",
        isLecturer: false,
        endpoint: "/api/auth/register"
    });
}

function showRegisterLecturer(req, res) {
    return res.render("register", {
        pageTitle: "Lecturer sign-up",
        isLecturer: true,
        endpoint: "/api/auth/register-lecturer"
    });
}

async function showStudentHome(req, res) {
    const sessions = await getStudentSessions(req.session.user.user_id);

    return res.render("student-home", { pageTitle: "Join a game", sessions });
}

async function showLecturerHome(req, res) {
    const sessions = await getLecturerSessions(req.session.user.user_id);

    return res.render("lecturer-home", { pageTitle: "Your sessions", sessions });
}

async function showSession(req, res) {
    const sessionId = Number(req.params.sessionId);
    const user = req.session.user;

    if (!Number.isInteger(sessionId) || sessionId < 1) {
        return showNotFound(res);
    }

    if (!(await canViewSession(sessionId, user.user_id))) {
        return showNotFound(res);
    }

    const { session, teams } = await getSessionWithTeams(sessionId);
    const totalPlayers = teams.reduce((sum, team) => sum + team.members.length, 0);

    return res.render("session", {
        pageTitle: "Session " + session.session_code,
        session,
        teams,
        totalPlayers,
        isOwner: session.lecturer_id === user.user_id
    });
}

module.exports = {
    showNotFound,
    showHome,
    showLogin,
    showRegister,
    showRegisterLecturer,
    showStudentHome,
    showLecturerHome,
    showSession
};
