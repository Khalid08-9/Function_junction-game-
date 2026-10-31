const test = require("node:test");
const assert = require("node:assert/strict");
const cards = require("../src/services/cardService");

function fakeGame() {
    const game = {
        round: 1, turn: 1,
        meta: { text: "Started", played_cards: {}, current_deal: 1 },
        questionCardId: null
    };
    const definitions = ["Ace", "King", "Queen", "Jack", "10", "9", "8", "7", "6", "5", "4", "3", "2"]
        .map((name, index) => ({ card_id: index + 1, card_name: name }));
    game.execute = async (sql, params) => {
        if (sql.includes("MAX(round_number)")) return [[{ round_number: game.round }]];
        if (sql.includes("FROM cards")) return [sql.includes("qr_token = ?") ? [definitions[0]] : definitions];
        if (sql.includes("FROM team_members")) return [[{ user_id: 7, team_id: 10 }]];
        if (sql.includes("FROM questions")) return [[{ card_id: game.questionCardId }]];
        if (sql.includes("UPDATE game_state")) {
            game.meta = JSON.parse(params[0]);
            return [{ affectedRows: 1 }];
        }
        if (sql.includes("FROM game_state")) return [[{ last_action: JSON.stringify(game.meta), turn_number: game.turn }]];
        throw new Error(`Unexpected query: ${sql}`);
    };
    return game;
}

test("selection removes exactly one card, survives reload and cannot select a second card", async () => {
    const game = fakeGame();
    const initial = await cards.getPlayerHand(42, 7, game);
    assert.equal(initial.hand.length, 5);
    const selected = initial.hand[0];
    const active = await cards.selectCard(game, 42, 7, selected.card_id, selected.card_key, 1);
    assert.equal(active.card_key, selected.card_key);
    const after = await cards.getPlayerHand(42, 7, game);
    assert.equal(after.hand.length, 4);
    assert.ok(after.hand.every(card => card.card_key !== selected.card_key));
    assert.equal(after.active_card.card_key, selected.card_key);
    // Retrying/resuming the same selection must not consume another suit.
    await cards.selectCard(game, 42, 7, selected.card_id, selected.card_key, 1);
    assert.equal((await cards.getPlayerHand(42, 7, game)).hand.length, 4);
    await assert.rejects(cards.selectCard(game, 42, 7, after.hand[0].card_id, after.hand[0].card_key, 1), /already selected/);
});

test("used and fabricated card keys are rejected instead of creating fake played keys", async () => {
    const game = fakeGame();
    const { hand } = await cards.getPlayerHand(42, 7, game);
    await cards.recordCardPlayed(game, 42, 7, hand[0].card_id, hand[0].card_key);
    await assert.rejects(cards.recordCardPlayed(game, 42, 7, hand[0].card_id, hand[0].card_key), /already been used/);
    await assert.rejects(cards.recordCardPlayed(game, 42, 7, hand[1].card_id, "fake-card-key"), /not in your hand/);
    assert.deepEqual(game.meta.played_cards[7], [hand[0].card_key]);
});

test("two cards of the same rank are separate cards; selection removes only the chosen suit", async () => {
    const game = fakeGame();
    let found;
    for (let sessionId = 1; sessionId <= 100 && !found; sessionId++) {
        const { hand } = await cards.getPlayerHand(sessionId, 7, game);
        const selected = hand.find(card => hand.some(other => other.card_id === card.card_id && other.card_key !== card.card_key));
        if (selected) found = { sessionId, hand, selected };
    }
    assert.ok(found, "Expected a hand with two different suits of the same rank");
    const other = found.hand.find(card => card.card_id === found.selected.card_id && card.card_key !== found.selected.card_key);
    await cards.selectCard(game, found.sessionId, 7, found.selected.card_id, found.selected.card_key, 1);
    const after = await cards.getPlayerHand(found.sessionId, 7, game);
    assert.equal(after.hand.length, 4);
    assert.ok(after.hand.some(card => card.card_key === other.card_key));
    assert.ok(after.hand.every(card => card.card_key !== found.selected.card_key));
});

test("one answer per selected card, including wrong answers and question timeouts", async () => {
    for (const result of [{ is_correct: false }, { is_correct: false, timed_out: true }, { is_correct: true }]) {
        const game = fakeGame();
        const { hand } = await cards.getPlayerHand(42, 7, game);
        const selected = hand[0];
        game.questionCardId = selected.card_id;
        await cards.selectCard(game, 42, 7, selected.card_id, selected.card_key, 1);
        await cards.saveCardAnswer(game, 42, 7, 123, result);
        await assert.rejects(cards.saveCardAnswer(game, 42, 7, 124, { is_correct: true }), /already answered/);
        assert.equal((await cards.getPlayerHand(42, 7, game)).hand.length, 4);
        assert.deepEqual(game.meta.active_card.result, result);
    }
});

test("cannot answer for an unselected, mismatched or previous-turn card", async () => {
    const game = fakeGame();
    await assert.rejects(cards.saveCardAnswer(game, 42, 7, 1, {}), /Select a card/);
    const { hand } = await cards.getPlayerHand(42, 7, game);
    await cards.selectCard(game, 42, 7, hand[0].card_id, hand[0].card_key, 1);
    game.questionCardId = -1;
    await assert.rejects(cards.saveCardAnswer(game, 42, 7, 1, {}), /does not match/);
    await assert.rejects(cards.assertCardAnswerAllowed(game, 42, 7, 1, 0), /turn has ended/);
});

test("a wrong answer cannot unlock a full-power move or switch to another card", async () => {
    const game = fakeGame();
    const { hand } = await cards.getPlayerHand(42, 7, game);
    const selected = hand[0];
    game.questionCardId = selected.card_id;
    await cards.selectCard(game, 42, 7, selected.card_id, selected.card_key, 1);
    const body = { card_id: selected.card_id, card_key: selected.card_key, turn_number: 1, action: "move", spaces: 1 };
    await assert.rejects(cards.validateCardMove(game, 42, 7, body), /Answer the question/);
    await cards.saveCardAnswer(game, 42, 7, 123, { is_correct: false });
    await cards.validateCardMove(game, 42, 7, body);
    await assert.rejects(cards.validateCardMove(game, 42, 7, { ...body, spaces: 11 }), /basic move/);
    await assert.rejects(cards.validateCardMove(game, 42, 7, { ...body, action: "enter" }), /basic move/);
    await assert.rejects(cards.validateCardMove(game, 42, 7, { ...body, card_key: hand[1].card_key }), /not the selected card/);
    game.turn++;
    await assert.rejects(cards.validateCardMove(game, 42, 7, body), /turn has ended/);
});

test("a new deal ignores the previous deal's consumed keys", async () => {
    const game = fakeGame();
    game.round = 6;
    const initial = await cards.getPlayerHand(42, 7, game);
    // Simulate the same physical keys having been consumed in an earlier deal.
    game.meta.played_cards[7] = initial.hand.map(card => card.card_key);
    assert.equal((await cards.getPlayerHand(42, 7, game)).hand.length, 5);
    const selected = initial.hand[0];
    await cards.selectCard(game, 42, 7, selected.card_id, selected.card_key, 1);
    assert.equal(game.meta.current_deal, 2);
    assert.equal((await cards.getPlayerHand(42, 7, game)).hand.length, 4);
});

test("discard consumes the exact card even if no question was opened", async () => {
    const game = fakeGame();
    const { hand } = await cards.getPlayerHand(42, 7, game);
    const selected = hand[0];
    await cards.validateCardMove(game, 42, 7, {
        action: "discard", turn_number: 1, card_id: selected.card_id, card_key: selected.card_key
    });
    assert.equal((await cards.getPlayerHand(42, 7, game)).hand.length, 4);
});

test("physical mode accepts real dealt cards without a virtual hand and keeps the single-use rules", async () => {
    const game = fakeGame();
    game.meta.card_mode = "physical";
    const hand = await cards.getPlayerHand(42, 7, game);
    assert.deepEqual(hand.hand, []);
    assert.equal(hand.remaining_count, 5);
    await assert.rejects(cards.selectCard(game, 42, 7, 1, "1-hearts", 1), /physical cards/);
    const selected = await cards.selectPhysicalCard(game, 42, 7, "token", 1);
    assert.equal(selected.card_key, "1-physical-1");
    assert.equal((await cards.getPlayerHand(42, 7, game)).remaining_count, 4);
    await cards.selectPhysicalCard(game, 42, 7, "token", 1);
    assert.equal((await cards.getPlayerHand(42, 7, game)).remaining_count, 4);
    game.questionCardId = 1;
    await cards.saveCardAnswer(game, 42, 7, 123, { is_correct: true });
    await assert.rejects(cards.saveCardAnswer(game, 42, 7, 123, {}), /already answered/);
    delete game.meta.active_card;
    game.turn++;
    const repeated = await cards.selectPhysicalCard(game, 42, 7, "token", 2);
    assert.equal(repeated.card_key, "1-physical-2");
    assert.equal((await cards.getPlayerHand(42, 7, game)).remaining_count, 3);
    await assert.rejects(cards.selectPhysicalCard(game, 42, 7, "token", 1), /turn has ended/);
    delete game.meta.active_card;
    game.turn++;
    game.round = 6;
    await cards.selectPhysicalCard(game, 42, 7, "token", 3);
    assert.equal(game.meta.current_deal, 2);
});

test("physical scans cannot be used in a digital game", async () => {
    const game = fakeGame();
    await assert.rejects(cards.selectPhysicalCard(game, 42, 7, "token", 1), /digital cards/);
});
