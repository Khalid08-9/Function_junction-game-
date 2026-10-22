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
const { getPlayerHand, cardImage } = require("../services/cardService");

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

    const myTeam = teams.find((team) =>
        team.members.some((member) => member.user_id === user.user_id)
    ) || null;

    const { hand } = await getPlayerHand(session.session_id, user.user_id);

    return res.render("game", {
        pageTitle: "Game room - " + session.session_code,
        session,
        teams,
        cards: hand,
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

// Mobile-friendly question answering page (opened when scanning QR code with phone camera)
async function showMobileQuestion(req, res) {
    const qrToken = String(req.params.qrToken || "").trim();
    const sessionId = Number(req.query.session) || null;
    const teamId = Number(req.query.team) || null;

    if (!qrToken) {
        return showNotFound(res);
    }

    const [rows] = await pool.execute(
        `SELECT c.card_id, c.card_name, c.card_effect, c.difficulty,
                q.question_id, q.topic, q.question_text
         FROM cards c
         JOIN questions q ON q.card_id = c.card_id
         WHERE c.qr_token = ? AND c.is_active = 1 AND q.is_active = 1
         ORDER BY RAND()
         LIMIT 1`,
        [qrToken]
    );

    if (rows.length === 0) {
        return res.status(404).render("error", {
            pageTitle: "Card Not Found",
            heading: "Question Not Found",
            text: "No active question found for this card QR code."
        });
    }

    const item = rows[0];

    const [options] = await pool.execute(
        `SELECT option_id, option_label, option_text
         FROM question_options
         WHERE question_id = ?
         ORDER BY option_label`,
        [item.question_id]
    );

    let sessionInfo = null;
    if (sessionId) {
        const [[s]] = await pool.execute(
            `SELECT session_id, session_code, status FROM game_sessions WHERE session_id = ?`,
            [sessionId]
        );
        sessionInfo = s || null;
    }

    return res.render("mobile-question", {
        pageTitle: "Answer Question - " + item.card_name,
        card: {
            card_id: item.card_id,
            card_name: item.card_name,
            card_effect: item.card_effect,
            difficulty: item.difficulty,
            image: cardImage(item.card_name)
        },
        question: {
            question_id: item.question_id,
            topic: item.topic,
            question_text: item.question_text,
            options
        },
        sessionId,
        teamId,
        session: sessionInfo
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
    showDashboard,
    showMobileQuestion
};
