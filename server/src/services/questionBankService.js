const pool = require("../config/database");
const { parseGameStateMeta } = require("./cardService");
const LABELS = ["A", "B", "C", "D"];

function problem(message, status = 400) {
    return Object.assign(new Error(message), { status });
}

function validateQuestion(body = {}) {
    function text(value, name, max, optional = false) {
        if (optional && (value === undefined || value === null || (typeof value === "string" && !value.trim()))) return "";
        if (typeof value !== "string" || !value.trim() || value.length > max) throw problem(`${name} must contain 1–${max} characters.`);
        return value.trim();
    }
    const cardId = Number(body.card_id);
    if (!Number.isInteger(cardId) || cardId < 1) throw problem("Choose a card.");
    if (!Array.isArray(body.options) || body.options.length !== 4) throw problem("Provide exactly four options (A–D).");
    const options = LABELS.map(label => {
        const matches = body.options.filter(option => option && option.option_label === label);
        if (matches.length !== 1 || typeof matches[0].is_correct !== "boolean") throw problem("Provide A, B, C and D with one correct answer.");
        return { option_label: label, option_text: text(matches[0].option_text, `Option ${label}`, 1000), is_correct: matches[0].is_correct };
    });
    if (options.filter(option => option.is_correct).length !== 1) throw problem("Choose exactly one correct answer.");
    return { card_id: cardId, topic: text(body.topic, "Topic", 100),
        question_text: text(body.question_text, "Question", 6000),
        explanation: text(body.explanation, "Explanation", 3000, true), options };
}

async function listQuestionBank(cardId) {
    const params = cardId ? [cardId] : [];
    const [questions] = await pool.execute(
        `SELECT q.question_id, q.card_id, q.topic, q.question_text, q.explanation,
                q.is_active, q.created_at, c.card_name, u.full_name AS author
         FROM questions q JOIN cards c ON c.card_id = q.card_id
         JOIN users u ON u.user_id = q.created_by
         ${cardId ? "WHERE q.card_id = ?" : ""}
         ORDER BY q.is_active DESC, q.question_id DESC`, params
    );
    const [options] = await pool.execute(
        `SELECT o.option_id, o.question_id, o.option_label, o.option_text, o.is_correct
         FROM question_options o JOIN questions q ON q.question_id = o.question_id
         ${cardId ? "WHERE q.card_id = ?" : ""} ORDER BY o.question_id, o.option_label`, params
    );
    const grouped = new Map();
    for (const option of options) {
        if (!grouped.has(option.question_id)) grouped.set(option.question_id, []);
        grouped.get(option.question_id).push({ ...option, is_correct: !!option.is_correct });
    }
    return questions.map(question => ({ ...question, is_active: !!question.is_active, options: grouped.get(question.question_id) || [] }));
}

async function saveQuestion(body, lecturerId, previousId = null) {
    const data = validateQuestion(body);
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [[card]] = await connection.execute("SELECT card_id FROM cards WHERE card_id = ? AND is_active = 1", [data.card_id]);
        if (!card) throw problem("Choose an active card.");
        if (previousId) {
            const [[previous]] = await connection.execute("SELECT is_active FROM questions WHERE question_id = ? FOR UPDATE", [previousId]);
            if (!previous) throw problem("Question not found.", 404);
            if (!previous.is_active) throw problem("This question was archived or changed. Reload the bank before editing.", 409);
            await connection.execute("UPDATE questions SET is_active = 0 WHERE question_id = ?", [previousId]);
        }
        // Never overwrite old option text/correctness: attempts reference it.
        const [saved] = await connection.execute(
            `INSERT INTO questions (card_id, created_by, topic, question_text, explanation)
             VALUES (?, ?, ?, ?, ?)`, [data.card_id, lecturerId, data.topic, data.question_text, data.explanation || null]
        );
        for (const option of data.options) {
            await connection.execute(
                "INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES (?, ?, ?, ?)",
                [saved.insertId, option.option_label, option.option_text, option.is_correct ? 1 : 0]
            );
        }
        await connection.commit();
        return saved.insertId;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally { connection.release(); }
}

async function setQuestionStatus(questionId, isActive) {
    if (typeof isActive !== "boolean") throw problem("is_active must be true or false.");
    const [result] = await pool.execute("UPDATE questions SET is_active = ? WHERE question_id = ?", [isActive ? 1 : 0, questionId]);
    if (!result.affectedRows) throw problem("Question not found.", 404);
}

async function deleteQuestion(questionId) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        // Card selection holds this lock too: do not delete a question while
        // another transaction is binding it to an open turn.
        const [states] = await connection.execute("SELECT turn_number, last_action FROM game_state ORDER BY state_id FOR UPDATE");
        const [[question]] = await connection.execute("SELECT question_id FROM questions WHERE question_id = ? FOR UPDATE", [questionId]);
        if (!question) throw problem("Question not found.", 404);
        const inUse = states.some(state => {
            const active = parseGameStateMeta(state.last_action).active_card;
            return active && Number(active.question_id) === questionId && Number(active.turn_number) === Number(state.turn_number);
        });
        if (inUse) throw problem("This question is used by an open turn. Archive it instead, or wait until the turn ends.", 409);
        const [[attempt]] = await connection.execute("SELECT attempt_id FROM attempts WHERE question_id = ? LIMIT 1", [questionId]);
        if (attempt) throw problem("This question has recorded answers and cannot be deleted. Archive it instead to preserve game history.", 409);
        await connection.execute("DELETE FROM question_options WHERE question_id = ?", [questionId]);
        await connection.execute("DELETE FROM questions WHERE question_id = ?", [questionId]);
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        if (error.code === "ER_ROW_IS_REFERENCED_2") throw problem("This question is used by game history. Archive it instead.", 409);
        throw error;
    } finally { connection.release(); }
}

module.exports = { validateQuestion, listQuestionBank, saveQuestion, setQuestionStatus, deleteQuestion };
