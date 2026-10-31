const crypto = require("crypto");
const pool = require("../config/database");

// Standard Jackaroo 52-card deck card faces (no Jokers)
const CARD_FACES = new Set(["ace", "king", "queen", "jack", "10", "9", "8", "7", "6", "5", "4", "3", "2"]);
const SUITS = ["hearts", "diamonds", "clubs", "spades"];
const CARDS_PER_DEAL = 5;

function cardImage(cardName) {
    const slug = String(cardName).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return CARD_FACES.has(slug)
        ? "/images/cards/" + slug + ".svg"
        : "/images/cards/card-back.svg";
}

// Generate the standard 52-card deck from active card definitions (4 suits per rank)
function buildDeck52(activeCards) {
    const deck = [];
    for (const card of activeCards) {
        for (let s = 0; s < SUITS.length; s++) {
            deck.push({
                ...card,
                suit: SUITS[s],
                card_key: `${card.card_id}-${SUITS[s]}`,
                image: cardImage(card.card_name)
            });
        }
    }
    return deck;
}

// Deterministic PRNG shuffle using SHA-256 seed
function shuffleDeck(deck, seed) {
    const list = [...deck];
    const hash = crypto.createHash("sha256").update(seed).digest();
    for (let i = list.length - 1; i > 0; i--) {
        const randVal = hash.readUInt32BE((i * 4) % (hash.length - 4));
        const j = randVal % (i + 1);
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

// Reads metadata from game_state.last_action (parses JSON or falls back to text)
function parseGameStateMeta(lastActionText) {
    if (!lastActionText) return { text: "", played_cards: {}, current_deal: 1 };
    try {
        const parsed = JSON.parse(lastActionText);
        if (parsed && typeof parsed === "object") {
            return {
                ...parsed,
                text: parsed.text || "",
                played_cards: parsed.played_cards || {},
                current_deal: parsed.current_deal || 1
            };
        }
    } catch (e) {
        // Plain text
    }
    return { text: String(lastActionText), played_cards: {}, current_deal: 1 };
}

// Retrieves the player's current hand of cards for the active deal
// Deals 5 distinct cards per player from the 52-card deck (no duplicate cards between players).
// As cards are played in turns, played cards are removed from the hand.
// When all players play 5 cards, cards change (a new deal begins).
async function getPlayerHand(sessionId, userId, db = pool) {
    const [[roundInfo]] = await db.execute(
        `SELECT MAX(round_number) AS round_number FROM round_turns WHERE session_id = ?`,
        [sessionId]
    );
    const roundNumber = (roundInfo && roundInfo.round_number) ? Number(roundInfo.round_number) : 1;
    const dealNumber = Math.floor((roundNumber - 1) / CARDS_PER_DEAL) + 1;

    // Fetch active card definitions from DB (13 ranks, no Jokers)
    const [allCards] = await db.execute(
        `SELECT card_id, card_name, card_effect, difficulty, power_level, move_spaces
         FROM cards
         WHERE is_active = 1
         ORDER BY card_id`
    );

    // Get all players in the session ordered by seat
    const [players] = await db.execute(
        `SELECT tm.user_id, tm.team_id
         FROM team_members tm
         JOIN teams t ON t.team_id = tm.team_id
         WHERE t.session_id = ?
         ORDER BY tm.team_id, tm.user_id`,
        [sessionId]
    );

    let seatIndex = players.findIndex(p => p.user_id === userId);
    if (seatIndex < 0) throw cardError("You are not a player in this session.", 403);

    // Build and shuffle standard 52-card deck for this deal
    const deck = buildDeck52(allCards);
    const seed = `${sessionId}-jackaroo-deal-${dealNumber}`;
    const shuffled = shuffleDeck(deck, seed);

    // Give each seat 5 distinct cards from the deck
    const startIndex = (seatIndex * CARDS_PER_DEAL) % shuffled.length;
    const initialHand = shuffled.slice(startIndex, startIndex + CARDS_PER_DEAL);

    // Check which cards have already been played in the current deal
    const [states] = await db.execute(
        `SELECT last_action, turn_number FROM game_state WHERE session_id = ?`,
        [sessionId]
    );
    const meta = parseGameStateMeta(states[0] ? states[0].last_action : "");
    const userPlayedKeys = new Set(Number(meta.current_deal) === dealNumber ? meta.played_cards[userId] || [] : []);

    // Filter out played cards so hand shrinks as turns are taken
    const remainingHand = initialHand
        .filter(card => !userPlayedKeys.has(card.card_key))
        .map((card, idx) => ({
            ...card,
            hand_index: idx
        }));

    return {
        round_number: roundNumber,
        deal_number: dealNumber,
        active_card: meta.active_card && meta.active_card.user_id === userId &&
            meta.active_card.turn_number === states[0].turn_number ? meta.active_card : null,
        hand: remainingHand
    };
}

// Records a card as played by a user in the current deal
async function recordCardPlayed(connection, sessionId, userId, cardId, cardKey) {
    const [[roundInfo]] = await connection.execute(
        `SELECT MAX(round_number) AS round_number FROM round_turns WHERE session_id = ?`,
        [sessionId]
    );
    const roundNumber = (roundInfo && roundInfo.round_number) ? Number(roundInfo.round_number) : 1;
    const dealNumber = Math.floor((roundNumber - 1) / CARDS_PER_DEAL) + 1;

    const [states] = await connection.execute(
        `SELECT last_action FROM game_state WHERE session_id = ? FOR UPDATE`,
        [sessionId]
    );
    const meta = parseGameStateMeta(states[0] ? states[0].last_action : "");

    // If deal changed, reset played_cards for the fresh deal
    if (Number(meta.current_deal) !== dealNumber) {
        meta.played_cards = {};
        meta.current_deal = dealNumber;
    }

    if (!meta.played_cards[userId]) {
        meta.played_cards[userId] = [];
    }

    // Find the matching card in user's initial hand to get its card_key
    const [allCards] = await connection.execute(
        `SELECT card_id, card_name, card_effect, difficulty, power_level, move_spaces
         FROM cards WHERE is_active = 1 ORDER BY card_id`
    );
    const [players] = await connection.execute(
        `SELECT tm.user_id, tm.team_id FROM team_members tm
         JOIN teams t ON t.team_id = tm.team_id WHERE t.session_id = ?
         ORDER BY tm.team_id, tm.user_id`,
        [sessionId]
    );
    let seatIndex = players.findIndex(p => p.user_id === userId);
    if (seatIndex < 0) throw cardError("You are not a player in this session.", 403);

    const deck = buildDeck52(allCards);
    const shuffled = shuffleDeck(deck, `${sessionId}-jackaroo-deal-${dealNumber}`);
    const initialHand = shuffled.slice(seatIndex * CARDS_PER_DEAL, (seatIndex + 1) * CARDS_PER_DEAL);

    const alreadyPlayed = new Set(meta.played_cards[userId]);
    const matched = initialHand.find(c =>
        !alreadyPlayed.has(c.card_key) &&
        Number(c.card_id) === Number(cardId) && c.card_key === cardKey
    );

    if (!matched) throw cardError("This card has already been used or is not in your hand.");
    meta.played_cards[userId].push(matched.card_key);

    const updatedJson = JSON.stringify(meta);
    await connection.execute(
        `UPDATE game_state SET last_action = ? WHERE session_id = ?`,
        [updatedJson, sessionId]
    );
    return matched;
}

function cardError(message, status = 409) {
    return Object.assign(new Error(message), { status });
}

async function loadCardState(connection, sessionId) {
    const [[state]] = await connection.execute(
        `SELECT turn_number, last_action FROM game_state WHERE session_id = ? FOR UPDATE`, [sessionId]
    );
    if (!state) throw cardError("The game has not started.");
    return { state, meta: parseGameStateMeta(state.last_action) };
}

async function saveCardMeta(connection, sessionId, meta) {
    await connection.execute(`UPDATE game_state SET last_action = ? WHERE session_id = ?`,
        [JSON.stringify(meta), sessionId]);
}

// Caller holds the game-state lock and has verified the current player.
async function selectCard(connection, sessionId, userId, cardId, cardKey, turnNumber) {
    let { state, meta } = await loadCardState(connection, sessionId);
    if (state.turn_number !== Number(turnNumber)) throw cardError("This turn has ended.");
    if (meta.active_card) {
        if (meta.active_card.user_id === userId && meta.active_card.card_key === cardKey &&
            meta.active_card.card_id === Number(cardId) && meta.active_card.turn_number === state.turn_number) return meta.active_card;
        throw cardError("You have already selected a card for this turn.");
    }
    const card = await recordCardPlayed(connection, sessionId, userId, cardId, cardKey);
    ({ meta } = await loadCardState(connection, sessionId));
    meta.active_card = { ...card, user_id: userId, turn_number: state.turn_number, result: null };
    await saveCardMeta(connection, sessionId, meta);
    return meta.active_card;
}

async function assertCardAnswerAllowed(connection, sessionId, userId, questionId, turnNumber) {
    const { state, meta } = await loadCardState(connection, sessionId);
    if (turnNumber !== undefined && state.turn_number !== Number(turnNumber)) throw cardError("This turn has ended.");
    const active = meta.active_card;
    if (!active || active.user_id !== userId || active.turn_number !== state.turn_number) {
        throw cardError("Select a card from your hand before answering.");
    }
    if (active.result) throw cardError("You have already answered for this turn.");
    const [[question]] = await connection.execute(
        `SELECT card_id FROM questions WHERE question_id = ? AND is_active = 1`, [questionId]
    );
    if (!question || question.card_id !== active.card_id) throw cardError("This question does not match your selected card.");
    return meta;
}

async function saveCardAnswer(connection, sessionId, userId, questionId, result) {
    const meta = await assertCardAnswerAllowed(connection, sessionId, userId, questionId);
    meta.active_card.result = result;
    await saveCardMeta(connection, sessionId, meta);
}

async function validateCardMove(connection, sessionId, userId, body) {
    const { state, meta } = await loadCardState(connection, sessionId);
    if (state.turn_number !== Number(body.turn_number)) throw cardError("This turn has ended.");
    const active = meta.active_card;
    if (!active) {
        if (body.action !== "discard") throw cardError("Select and answer a card before moving.");
        return recordCardPlayed(connection, sessionId, userId, body.card_id, body.card_key);
    }
    if (active.user_id !== userId || active.turn_number !== state.turn_number ||
        active.card_key !== body.card_key || active.card_id !== Number(body.card_id)) {
        throw cardError("This is not the selected card for this turn.");
    }
    if (body.action === "discard") return active;
    if (!active.result) throw cardError("Answer the question before moving.");
    const spaces = Number(body.spaces || 0);
    if (!active.result.is_correct) {
        if (body.action !== "move" || spaces !== 1) throw cardError("A wrong answer only allows a basic move of 1 space.");
        return active;
    }
    const rank = active.card_name.toLowerCase();
    const valid = rank === "ace" ? body.action === "enter" || (body.action === "move" && [1, 11].includes(spaces)) :
        rank === "king" ? body.action === "enter" :
        rank === "jack" ? body.action === "swap" :
        body.action === "move" && (rank === "7" ? [3, 4, 7].includes(spaces) :
            spaces === (rank === "queen" ? 12 : rank === "4" ? -4 : Number(rank)));
    if (!valid) throw cardError("This move is not allowed by your selected card.");
    return active;
}

// Fallback export for dealHand
function dealHand(allCards, sessionId, roundNumber, userId, count = 5) {
    const deck = buildDeck52(allCards.filter(c => c.is_active !== 0));
    const dealNumber = Math.floor((roundNumber - 1) / CARDS_PER_DEAL) + 1;
    const shuffled = shuffleDeck(deck, `${sessionId}-jackaroo-deal-${dealNumber}`);
    return shuffled.slice(0, count);
}

module.exports = {
    CARD_FACES,
    CARDS_PER_DEAL,
    cardImage,
    dealHand,
    getPlayerHand,
    recordCardPlayed,
    selectCard,
    saveCardAnswer,
    assertCardAnswerAllowed,
    validateCardMove,
    parseGameStateMeta
};
