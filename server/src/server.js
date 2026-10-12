require("dotenv").config();

const express = require("express");
const session = require("express-session");
const pool = require("./config/database");

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
    secret: process.env.SESSION_SECRET || "development-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 60 * 60 * 1000
    }
}))

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/sessions", require("./routes/sessionRoutes"));
app.use("/api/questions", require("./routes/questionRoutes"));

app.get("/", (req, res) => {
    res.json({
        message: "Function Junction backend is running"
    });
});


async function startServer() {
    console.log("Starting Function Junction server...");
    console.log("Checking database connection...");

    try {
        await pool.query("SELECT 1");

        console.log("Database connected successfully");

        app.listen(port, () => {
            console.log(`SerstartServerver running at http://localhost:${port}`);
        });
    } catch (error) {
        console.error("Database connection failed:", error.message);
        process.exit(1);
    }
}

startServer();