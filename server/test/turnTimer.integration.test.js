// Opt in with TEST_DB_SOCKET pointing at a DISPOSABLE local MariaDB instance.
// Import database/schema.sql there first. Never point this at a live database.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

test("turn deadlines and seed data (disposable database)", {
    skip: !process.env.TEST_DB_SOCKET
}, async (t) => {
    process.env.DB_SOCKET = process.env.TEST_DB_SOCKET;
    process.env.DB_USER = "root";
    process.env.DB_PASSWORD = "";
    process.env.DB_NAME = "function_junction";
    const pool = require("../src/config/database");
    const { startGame, expireTurn, advanceTurn } = require("../src/services/turnService");
    const { expireSessionTurn } = require("../src/services/turnTimerService");
    const connection = await pool.getConnection();
    t.after(async () => { connection.release(); await pool.end(); });

    const [[counts]] = await connection.query(`SELECT
        (SELECT COUNT(*) FROM cards) AS cards,
        (SELECT COUNT(*) FROM questions) AS questions,
        (SELECT COUNT(*) FROM question_options) AS options`);
    assert.deepEqual(counts, { cards: 14, questions: 30, options: 120 });

    const players = [];
    for (let i = 0; i < 4; i++) {
        const [user] = await connection.execute(
            `INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, '!')`,
            [`Timer Player ${i}`, `${crypto.randomUUID()}@example.invalid`]
        );
        players.push(user.insertId);
    }
    const [[lecturer]] = await connection.query("SELECT user_id FROM users WHERE role = 'lecturer' LIMIT 1");
    const [session] = await connection.execute(
        `INSERT INTO game_sessions (lecturer_id, session_code, status) VALUES (?, ?, 'active')`,
        [lecturer.user_id, crypto.randomBytes(6).toString("hex")]
    );
    const sessionId = session.insertId;
    for (let teamIndex = 0; teamIndex < 2; teamIndex++) {
        const [team] = await connection.execute(
            `INSERT INTO teams (session_id, team_name, team_colour) VALUES (?, ?, ?)`,
            [sessionId, `Team ${teamIndex}`, teamIndex ? "blue" : "red"]
        );
        for (let seat = 0; seat < 2; seat++) {
            await connection.execute(
                `INSERT INTO team_members (team_id, user_id, seat_number) VALUES (?, ?, ?)`,
                [team.insertId, players[teamIndex * 2 + seat], seat + 1]
            );
        }
    }
    await connection.beginTransaction();
    await startGame(connection, sessionId);
    await connection.commit();

    async function readState() {
        const [[state]] = await connection.execute(
            `SELECT turn_number, TIMESTAMPDIFF(SECOND, turn_started_at, NOW()) AS age
             FROM game_state WHERE session_id = ?`, [sessionId]
        );
        return state;
    }

    await t.test("59 seconds does not expire; exactly 60 seconds does", async () => {
        await connection.beginTransaction();
        await connection.execute(
            `UPDATE game_state SET turn_started_at = NOW() - INTERVAL 59 SECOND WHERE session_id = ?`, [sessionId]
        );
        assert.equal(await expireTurn(connection, sessionId), false);
        await connection.execute(
            `UPDATE game_state SET turn_started_at = NOW() - INTERVAL 60 SECOND WHERE session_id = ?`, [sessionId]
        );
        assert.equal(await expireTurn(connection, sessionId), true);
        assert.equal(await expireTurn(connection, sessionId), false);
        await connection.commit();
        assert.equal((await readState()).turn_number, 2);
        assert.ok((await readState()).age < 2);
    });

    await t.test("concurrent timers cannot skip two players", async () => {
        await connection.execute(
            `UPDATE game_state SET turn_started_at = NOW() - INTERVAL 60 SECOND WHERE session_id = ?`, [sessionId]
        );
        await Promise.all([expireSessionTurn(sessionId), expireSessionTurn(sessionId)]);
        assert.equal((await readState()).turn_number, 3);
    });

    await t.test("normal handoff and timeout across a round boundary reset the deadline", async () => {
        await connection.beginTransaction();
        await advanceTurn(connection, sessionId, null);
        await connection.execute(
            `UPDATE game_state SET turn_started_at = NOW() - INTERVAL 60 SECOND WHERE session_id = ?`, [sessionId]
        );
        assert.equal(await expireTurn(connection, sessionId), true);
        await connection.commit();
        const [[round]] = await connection.execute(
            `SELECT MAX(round_number) AS number FROM round_turns WHERE session_id = ?`, [sessionId]
        );
        assert.equal(round.number, 2);
        assert.equal((await readState()).turn_number, 5);
        assert.ok((await readState()).age < 2);
    });

    await t.test("finished games never expire", async () => {
        await connection.execute("UPDATE game_sessions SET status = 'finished' WHERE session_id = ?", [sessionId]);
        await connection.execute(
            `UPDATE game_state SET turn_started_at = NOW() - INTERVAL 60 SECOND WHERE session_id = ?`, [sessionId]
        );
        await expireSessionTurn(sessionId);
        assert.equal((await readState()).turn_number, 5);
    });

    await t.test("background timer advances without a browser request", async () => {
        await connection.execute("UPDATE game_sessions SET status = 'active' WHERE session_id = ?", [sessionId]);
        const { startTurnTimer } = require("../src/services/turnTimerService");
        const timer = startTurnTimer();
        try {
            await new Promise(resolve => setTimeout(resolve, 1200));
            assert.equal((await readState()).turn_number, 6);
        } finally {
            clearInterval(timer);
        }
    });

    await t.test("card selection and answers are single-use across desktop and mobile", async () => {
        const { playCard } = require("../src/controllers/cardController");
        const { submitAnswer, submitMobileAnswer } = require("../src/controllers/gameController");
        const { movePiece } = require("../src/controllers/pieceController");
        const { getPlayerHand } = require("../src/services/cardService");
        const [[current]] = await connection.execute(
            `SELECT user_id, team_id FROM round_turns WHERE session_id = ? AND played_at IS NULL
             ORDER BY round_number DESC, turn_order LIMIT 1`, [sessionId]
        );
        const turn = (await readState()).turn_number;
        const initial = await getPlayerHand(sessionId, current.user_id);
        const card = initial.hand[0];
        const selection = { card_id: card.card_id, card_key: card.card_key, turn_number: turn };
        async function request(handler, body, mobile = false) {
            const response = {
                code: 200,
                status(code) { this.code = code; return this; },
                json(data) { this.data = data; return this; }
            };
            await handler({ params: { sessionId }, body,
                session: { user: { user_id: current.user_id } } }, response);
            return response;
        }
        const selections = await Promise.all([request(playCard, selection), request(playCard, selection)]);
        assert.ok(selections.every(result => result.code === 200));
        assert.equal((await getPlayerHand(sessionId, current.user_id)).hand.length, 4);
        assert.equal((await request(playCard, { ...selection,
            card_id: initial.hand[1].card_id, card_key: initial.hand[1].card_key })).code, 409);

        const [[question]] = await connection.execute(
            "SELECT question_id FROM questions WHERE card_id = ? LIMIT 1", [card.card_id]
        );
        const [[wrong]] = await connection.execute(
            "SELECT option_id FROM question_options WHERE question_id = ? AND is_correct = 0 LIMIT 1", [question.question_id]
        );
        const answer = { session_id: sessionId, question_id: question.question_id,
            selected_option_id: wrong.option_id, response_seconds: 1, turn_number: turn };
        const answers = await Promise.all([
            request(submitAnswer, answer), request(submitMobileAnswer, answer, true)
        ]);
        assert.deepEqual(answers.map(result => result.code).sort(), [201, 409]);
        const [[attempts]] = await connection.execute(
            "SELECT COUNT(*) AS count FROM attempts WHERE session_id = ?", [sessionId]
        );
        assert.equal(attempts.count, 1);
        assert.equal((await getPlayerHand(sessionId, current.user_id)).hand.length, 4);

        const move = { ...selection, action: "move", spaces: 11 };
        const [[piece]] = await connection.execute(
            "SELECT piece_id FROM game_pieces WHERE session_id = ? AND team_id = ? LIMIT 1", [sessionId, current.team_id]
        );
        move.piece_id = piece.piece_id;
        assert.equal((await request(movePiece, move)).code, 400);
        await connection.execute(
            "UPDATE game_pieces SET position_type = 'track', position_index = 1 WHERE piece_id = ?", [piece.piece_id]
        );
        move.spaces = 1;
        const moves = await Promise.all([request(movePiece, move), request(movePiece, move)]);
        assert.deepEqual(moves.map(result => result.code).sort(), [200, 403]);
        assert.equal((await readState()).turn_number, turn + 1);
        assert.equal((await getPlayerHand(sessionId, current.user_id)).hand.length, 4);
    });

    await t.test("rank scans return same-screen questions and repeated questions score once on each later turn", async () => {
        const { createSession, startSession } = require("../src/controllers/sessionController");
        const { scanCard, playCard } = require("../src/controllers/cardController");
        const { submitAnswer } = require("../src/controllers/gameController");
        const { getSessionWithTeams } = require("../src/services/sessionService");
        function response() {
            return { code: 200, status(code) { this.code = code; return this; },
                json(data) { this.data = data; return this; },
                render(view, data) { this.view = view; this.data = data; return this; } };
        }
        const created = response();
        await createSession({ body: { card_mode: "physical" }, session: { user: { user_id: lecturer.user_id } } }, created);
        assert.equal(created.code, 201);
        const id = created.data.session.session_id;
        const waiting = await getSessionWithTeams(id);
        assert.equal(waiting.session.card_mode, "physical");
        for (let teamIndex = 0; teamIndex < 2; teamIndex++) {
            for (let seat = 0; seat < 2; seat++) {
                await connection.execute("INSERT INTO team_members (team_id, user_id, seat_number) VALUES (?, ?, ?)",
                    [waiting.teams[teamIndex].team_id, players[teamIndex * 2 + seat], seat + 1]);
            }
        }
        const started = response();
        await startSession({ params: { sessionId: id }, session: { user: { user_id: lecturer.user_id } } }, started);
        assert.equal(started.code, 200);
        assert.equal((await getSessionWithTeams(id)).session.card_mode, "physical");
        // Rank 2 has one question, so a later scan necessarily repeats it.
        const [[card]] = await connection.execute("SELECT card_id, qr_token FROM cards WHERE card_name = '2' LIMIT 1");
        const user = { user_id: players[0], role: "student" };
        const [[before]] = await connection.execute("SELECT last_action FROM game_state WHERE session_id = ?", [id]);
        assert.deepEqual(JSON.parse(before.last_action).played_cards, {});
        const digital = response();
        await playCard({ params: { sessionId: id }, session: { user },
            body: { card_id: 1, card_key: "1-hearts", turn_number: 1 } }, digital);
        assert.equal(digital.code, 409);
        const selected = response();
        await scanCard({ params: { sessionId: id }, session: { user },
            body: { qr_token: card.qr_token, turn_number: 1 } }, selected);
        assert.equal(selected.code, 200);
        assert.deepEqual(selected.data.hand, []);
        assert.equal(selected.data.remaining_count, 4);
        const question = selected.data.active_card.question_data.question;
        assert.equal(question.options.length, 4);
        assert.ok(question.options.every(option => !("is_correct" in option)));
        const [[correct]] = await connection.execute("SELECT option_id FROM question_options WHERE question_id = ? AND is_correct = 1", [question.question_id]);
        const answer = { session_id: id, question_id: question.question_id,
            selected_option_id: correct.option_id, response_seconds: 1, turn_number: 1 };
        const first = response();
        await submitAnswer({ body: answer, session: { user } }, first);
        assert.equal(first.code, 201);
        assert.equal(first.data.points_awarded, 5);
        const duplicate = response();
        await submitAnswer({ body: answer, session: { user } }, duplicate);
        assert.equal(duplicate.code, 409);
        await connection.beginTransaction();
        for (let i = 0; i < 7; i++) await advanceTurn(connection, id, null);
        await connection.commit();
        const later = response();
        await scanCard({ params: { sessionId: id }, session: { user },
            body: { qr_token: card.qr_token, turn_number: 8 } }, later);
        assert.equal(later.code, 200);
        assert.equal(later.data.active_card.question_data.question.question_id, question.question_id);
        assert.equal(later.data.remaining_count, 3);
        const second = response();
        await submitAnswer({ body: { ...answer, turn_number: 8 }, session: { user } }, second);
        assert.equal(second.code, 201);
        assert.equal(second.data.points_awarded, 5);
        assert.equal(second.data.team_score, 10);
        const [[count]] = await connection.execute("SELECT COUNT(*) AS count FROM attempts WHERE session_id = ? AND question_id = ?", [id, question.question_id]);
        assert.equal(count.count, 2);
    });
});
