require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");
const pool = require("./config/database");

const app = express();
const port = Number(process.env.PORT) || 3000;

// Pug pages live in client/src/views, CSS and browser JavaScript in client/public
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "../../client/src/views"));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "../../client/public")));

app.use(session({
    secret: process.env.SESSION_SECRET || "development-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 1000
    }
}));

// Every Pug page can read "currentUser"
app.use((req, res, next) => {
    res.locals.currentUser = req.session.user || null;
    next();
});

// JSON API
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/auth", require("./routes/accountRoutes"));
app.use("/api/sessions", require("./routes/sessionRoutes"));
app.use("/api/questions", require("./routes/questionRoutes"));
app.use("/api/game", require("./routes/gameRoutes"));

// Simple check that the backend is running (it used to be "/")
app.get("/health", (req, res) => {
    res.json({
        message: "Function Junction backend is running"
    });
});

// Pug pages
app.use("/", require("./routes/pageRoutes"));

// Unknown URL
app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({ message: "Not found." });
    }

    return res.status(404).render("error", {
        pageTitle: "Not found",
        heading: "Page not found",
        text: "This page does not exist."
    });
});

// Unexpected error: log it, but never show details to the user
app.use((error, req, res, next) => {
    console.error("Unexpected error:", error.code || error.message);

    if (res.headersSent) {
        return next(error);
    }

    if (req.path.startsWith("/api/")) {
        return res.status(500).json({ message: "Something went wrong." });
    }

    return res.status(500).render("error", {
        pageTitle: "Error",
        heading: "Something went wrong",
        text: "Please try again in a moment."
    });
});

async function startServer() {
    console.log("Starting Function Junction server...");
    console.log("Checking database connection...");

    try {
        await pool.query("SELECT 1");

        console.log("Database connected successfully");
        require("./services/turnTimerService").startTurnTimer();

        app.listen(port, () => {
            console.log(`Server running at http://localhost:${port}`);
        });
    } catch (error) {
        console.error("Database connection failed:", error.message);
        process.exit(1);
    }
}

startServer();
