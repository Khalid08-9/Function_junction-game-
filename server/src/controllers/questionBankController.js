const pool = require("../config/database");
const bank = require("../services/questionBankService");

function id(value) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1) throw Object.assign(new Error("A positive whole-number ID is required."), { status: 400 });
    return number;
}

function handler(action) {
    return async (req, res) => {
        try { return await action(req, res); }
        catch (error) {
            console.error("Question bank:", error.code || error.message);
            return res.status(error.status || 500).json({ message: error.status ? error.message : "Could not update the question bank. Please try again." });
        }
    };
}

const list = handler(async (req, res) => {
    const [cards] = await pool.execute("SELECT card_id, card_name, difficulty, is_active FROM cards ORDER BY card_id");
    const questions = await bank.listQuestionBank(req.query.card_id ? id(req.query.card_id) : null);
    return res.json({ cards, questions });
});
const create = handler(async (req, res) => {
    const questionId = await bank.saveQuestion(req.body, req.session.user.user_id);
    return res.status(201).json({ message: "Question added. It is now available in the quiz.", question_id: questionId });
});
const update = handler(async (req, res) => {
    const questionId = await bank.saveQuestion(req.body, req.session.user.user_id, id(req.params.questionId));
    return res.json({ message: "Question updated. The previous version was archived to preserve game history.", question_id: questionId });
});
const status = handler(async (req, res) => {
    await bank.setQuestionStatus(id(req.params.questionId), req.body.is_active);
    return res.json({ message: req.body.is_active ? "Question activated." : "Question archived. It will not be chosen for new turns." });
});

const remove = handler(async (req, res) => {
    await bank.deleteQuestion(id(req.params.questionId));
    return res.json({ message: "Question and its answer options permanently deleted." });
});

module.exports = { list, create, update, status, remove };
