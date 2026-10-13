const pool = require("../config/database");

// A student scans a card. We find one active question for that card.
// IMPORTANT: we never send is_correct or explanation here.
async function getQuestionByToken(req, res) {
    const qrToken = req.params.qrToken;

    if (typeof qrToken !== "string" || !qrToken.trim() || qrToken.length > 100) {
        return res.status(400).json({ message: "A valid QR token is required." });
    }

    try {
        const [rows] = await pool.execute(
            `SELECT c.card_id, c.card_name, c.card_effect,
                    q.question_id, q.topic, q.question_text
             FROM cards c
             JOIN questions q ON q.card_id = c.card_id
             WHERE c.qr_token = ?
               AND c.is_active = 1
               AND q.is_active = 1
             ORDER BY RAND()
             LIMIT 1`,
            [qrToken.trim()]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                message: "No question found for this card."
            });
        }

        const question = rows[0];

        const [options] = await pool.execute(
            `SELECT option_id, option_label, option_text
             FROM question_options
             WHERE question_id = ?
             ORDER BY option_label`,
            [question.question_id]
        );

        return res.status(200).json({
            card: {
                card_id: question.card_id,
                card_name: question.card_name,
                card_effect: question.card_effect
            },
            question: {
                question_id: question.question_id,
                topic: question.topic,
                question_text: question.question_text,
                options
            }
        });
    } catch (error) {
        console.error("Get question failed:", error.code || error.message);

        return res.status(500).json({
            message: "Could not load the question. Please try again."
        });
    }
}

module.exports = { getQuestionByToken };