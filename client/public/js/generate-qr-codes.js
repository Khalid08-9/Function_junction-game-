// Makes one QR code image per active card, from the card's qr_token.
//
// Run it from the PROJECT ROOT (the folder with your .env):
//     npm install qrcode
//     node server/scripts/generate-qr-codes.js
//
// The images are saved in the "qr-codes" folder in the project root.
// That folder is NOT served by the website on purpose: a QR code is the secret
// that proves a student really holds the printed card.

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const pool = require("../src/config/database");

async function main() {
    const outputDir = path.join(__dirname, "..", "..", "qr-codes");
    fs.mkdirSync(outputDir, { recursive: true });

    const [cards] = await pool.query(
        `SELECT card_id, card_name, qr_token
         FROM cards
         WHERE is_active = 1 AND qr_token IS NOT NULL
         ORDER BY card_id`
    );

    if (cards.length === 0) {
        console.log("No active cards with a qr_token were found.");
    }

    for (const card of cards) {
        const fileName = card.card_name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

        await QRCode.toFile(path.join(outputDir, fileName + ".png"), card.qr_token, {
            width: 600,
            margin: 2
        });

        fs.writeFileSync(
            path.join(outputDir, fileName + ".svg"),
            await QRCode.toString(card.qr_token, { type: "svg", margin: 2 })
        );

        console.log(card.card_name + " -> qr-codes/" + fileName + ".png and .svg");
    }

    await pool.end();
}

main().catch((error) => {
    console.error("Could not make the QR codes:", error.message);
    process.exit(1);
});
