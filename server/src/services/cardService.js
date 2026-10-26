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
async function getPlayerHand(sessionId, userId) {
    const [[roundInfo]] = await pool.execute(
        `SELECT MAX(round_number) AS round_number FROM round_turns WHERE session_id = ?`,
        [sessionId]
    );
    const roundNumber = (roundInfo && roundInfo.round_number) ? Number(roundInfo.round_number) : 1;
    const dealNumber = Math.floor((roundNumber - 1) / CARDS_PER_DEAL) + 1;

    // Fetch active card definitions from DB (13 ranks, no Jokers)
    const [allCards] = await pool.execute(
        `SELECT card_id, card_name, card_effect, difficulty, power_level, move_spaces
         FROM cards
         WHERE is_active = 1
         ORDER BY card_id`
    );

    // Get all players in the session ordered by seat
    const [players] = await pool.execute(
        `SELECT tm.user_id, tm.team_id
         FROM team_members tm
         JOIN teams t ON t.team_id = tm.team_id
         WHERE t.session_id = ?
         ORDER BY tm.team_id, tm.user_id`,
        [sessionId]
    );

    let seatIndex = players.findIndex(p => p.user_id === userId);
    if (seatIndex < 0) seatIndex = 0;

    // Build and shuffle standard 52-card deck for this deal
    const deck = buildDeck52(allCards);
    const seed = `${sessionId}-jackaroo-deal-${dealNumber}`;
    const shuffled = shuffleDeck(deck, seed);

    // Give each seat 5 distinct cards from the deck
    const startIndex = (seatIndex * CARDS_PER_DEAL) % shuffled.length;
    const initialHand = shuffled.slice(startIndex, startIndex + CARDS_PER_DEAL);

    // Check which cards have already been played in the current deal
    const [states] = await pool.execute(
        `SELECT last_action FROM game_state WHERE session_id = ?`,
        [sessionId]
    );
    const meta = parseGameStateMeta(states[0] ? states[0].last_action : "");
    const userPlayedKeys = new Set(meta.played_cards[userId] || []);

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
        hand: remainingHand
    };
}

// Records a card as played by a user in the current deal
async function recordCardPlayed(connection, sessionId, userId, cardId, cardName) {
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
    if (meta.current_deal !== dealNumber) {
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
    if (seatIndex < 0) seatIndex = 0;

    const deck = buildDeck52(allCards);
    const shuffled = shuffleDeck(deck, `${sessionId}-jackaroo-deal-${dealNumber}`);
    const initialHand = shuffled.slice(seatIndex * CARDS_PER_DEAL, (seatIndex + 1) * CARDS_PER_DEAL);

    const alreadyPlayed = new Set(meta.played_cards[userId]);
    const matched = initialHand.find(c =>
        !alreadyPlayed.has(c.card_key) &&
        (Number(c.card_id) === Number(cardId) || String(c.card_name).toLowerCase() === String(cardName).toLowerCase())
    );

    if (matched) {
        meta.played_cards[userId].push(matched.card_key);
    } else {
        meta.played_cards[userId].push(`${cardId}-played-${Date.now()}`);
    }

    const updatedJson = JSON.stringify(meta);
    await connection.execute(
        `UPDATE game_state SET last_action = ? WHERE session_id = ?`,
        [updatedJson, sessionId]
    );
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
    parseGameStateMeta
};
