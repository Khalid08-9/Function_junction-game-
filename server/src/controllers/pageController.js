const path = require("path");
const pool = require("../config/database");

const { canViewSession } = require("../utils/sessionAccess");
const {
    getLecturerSessions,
    getStudentSessions,
    getSessionWithTeams
} = require("../services/sessionService");
const { getSummaryData } = require("../services/dashboardService");
const { homeFor } = require("../middleware/pageAuth");

// Card faces that live in client/public/images/cards
const CARD_FACES = new Set(["ace", "king", "jack", "joker"]);

function cardImage(cardName) {
    const slug = String(cardName).toLowerCase().replace(/[^a-z0-9]+/g, "-");

    return CARD_FACES.has(slug)
        ? "/images/cards/" + slug + ".svg"
        : "/images/cards/card-back.svg";
}

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

// The student's game room. Only reachable while the session is active,
// and only by the lecturer who owns it or by a player in it.
async function showGame(req, res) {
    const sessionId = Number(req.params.sessionId);
    const user = req.session.user;

    if (!Number.isInteger(sessionId) || sessionId < 1) {
        return showNotFound(res);
    }

    if (!(await canViewSession(sessionId, user.user_id))) {
        return showNotFound(res);
    }

    const { session, teams } = await getSessionWithTeams(sessionId);

    if (!session || session.status !== "active") {
        return showNotFound(res);
    }

    const [cards] = await pool.execute(
        `SELECT card_id, card_name, card_effect, difficulty
         FROM cards
         WHERE is_active = 1
         ORDER BY card_id`
    );

    const myTeam = teams.find((team) =>
        team.members.some((member) => member.user_id === user.user_id)
    ) || null;

    return res.render("game", {
        pageTitle: "Game room - " + session.session_code,
        session,
        teams,
        cards: cards.map(function (card) {
            return { ...card, image: cardImage(card.card_name) };
        }),
        questionSeconds: Number(process.env.QUESTION_SECONDS) || 30,
        myTeam: myTeam || null,
        currentUser: user
    });
}

// The lecturer's dashboard for one session. Only the lecturer who owns
// the session may open it.
async function showDashboard(req, res) {
    const sessionId = Number(req.params.sessionId);
    const user = req.session.user;

    if (!Number.isInteger(sessionId) || sessionId < 1) {
        return showNotFound(res);
    }

    const data = await getSummaryData(sessionId, user.user_id);

    if (!data) {
        return showNotFound(res);
    }

    return res.render("dashboard", {
        pageTitle: "Dashboard - " + data.session.session_code,
        session: data.session,
        summary: data
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
    showSession,
    showGame,
    showDashboard
};
