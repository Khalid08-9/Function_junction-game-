const crypto = require("crypto");
const pool = require("../config/database");

// Card faces that live in client/public/images/cards
const CARD_FACES = new Set(["ace", "king", "jack", "joker", "10", "4", "5", "7"]);

function cardImage(cardName) {
    const slug = String(cardName).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return CARD_FACES.has(slug)
        ? "/images/cards/" + slug + ".svg"
        : "/images/cards/card-back.svg";
}

// Deals 5 random cards deterministically for a player for a given round
// Ensures 5 random cards each round, consistent on reload within the same round,
// and fresh new random cards for each subsequent round.
function dealHand(allCards, sessionId, roundNumber, userId, count = 5) {
    if (!allCards || allCards.length === 0) return [];

    const seedStr = `${sessionId}-${roundNumber}-${userId}-funcjunction-hand`;
    const hash = crypto.createHash("sha256").update(seedStr).digest();

    const hand = [];
    for (let i = 0; i < count; i++) {
        const randVal = hash.readUInt32BE((i * 4) % (hash.length - 4));
        const picked = allCards[randVal % allCards.length];
        hand.push({
            ...picked,
            hand_index: i,
            image: cardImage(picked.card_name)
        });
    }
    return hand;
}

// Retrieves the 5-card random hand for a player in a session's current round
async function getPlayerHand(sessionId, userId) {
    const [[roundInfo]] = await pool.execute(
        `SELECT MAX(round_number) AS round_number FROM round_turns WHERE session_id = ?`,
        [sessionId]
    );
    const roundNumber = (roundInfo && roundInfo.round_number) ? roundInfo.round_number : 1;

    const [allCards] = await pool.execute(
        `SELECT card_id, card_name, card_effect, difficulty
         FROM cards
         WHERE is_active = 1
         ORDER BY card_id`
    );

    return {
        round_number: roundNumber,
        hand: dealHand(allCards, sessionId, roundNumber, userId, 5)
    };
}

module.exports = {
    cardImage,
    dealHand,
    getPlayerHand
};

