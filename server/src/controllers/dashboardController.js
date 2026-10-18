const { getSummaryData } = require("../services/dashboardService");

// GET /api/game/sessions/:sessionId/summary  (lecturer who owns the session)
async function getSummary(req, res) {
    const sessionId = Number(req.params.sessionId);
    const lecturerId = req.session.user.user_id;

    if (!Number.isInteger(sessionId) || sessionId < 1) {
        return res.status(400).json({
            message: "Session ID must be a positive whole number."
        });
    }

    try {
        const data = await getSummaryData(sessionId, lecturerId);

        if (!data) {
            return res.status(404).json({ message: "Session not found." });
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error("Summary failed:", error.code || error.message);

        return res.status(500).json({
            message: "Could not load the summary. Please try again."
        });
    }
}

module.exports = { getSummary };
