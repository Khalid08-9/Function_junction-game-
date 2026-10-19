const pool = require("../config/database");

// Card faces that exist in client/public/images/cards
const CARD_FACES = new Set(["ace", "king", "jack", "joker", "10", "4", "5", "7"]);

function cardImage(cardName) {
    const slug = String(cardName).toLowerCase().replace(/[^a-z0-9]+/g, "-");

    return CARD_FACES.has(slug)
        ? "/images/cards/" + slug + ".svg"
        : "/images/cards/card-back.svg";
}

// The cards students can use. The qr_token is NEVER included: it is the secret
// that proves a student really holds the printed card.
async function getActiveCards() {
    const [rows] = await pool.execute(
        `SELECT card_id, card_name, card_effect, difficulty
         FROM cards
         WHERE is_active = 1
         ORDER BY card_id`
    );

    return rows.map((row) => ({ ...row, image: cardImage(row.card_name) }));
}

module.exports = { getActiveCards };
