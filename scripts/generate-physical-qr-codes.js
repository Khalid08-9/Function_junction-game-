require("dotenv").config({ quiet: true });
const fs = require("node:fs/promises");
const path = require("node:path");
const QRCode = require("qrcode");
const { SUITS, CARD_FACES } = require("../server/src/services/cardService");

async function generate(cards, outputDir) {
    const ranks = ["ace", "2", "3", "4", "5", "6", "7", "8", "9", "10", "jack", "queen", "king"];
    const active = cards.filter(card => CARD_FACES.has(card.card_name.toLowerCase()) && card.qr_token);
    if (active.length !== 13 || new Set(active.map(card => card.card_name.toLowerCase())).size !== 13) {
        throw new Error("Expected all 13 active standard ranks with QR tokens.");
    }
    active.sort((a, b) => ranks.indexOf(a.card_name.toLowerCase()) - ranks.indexOf(b.card_name.toLowerCase()));
    const images = path.join(outputDir, "qr-codes");
    await fs.mkdir(images, { recursive: true });
    const labels = [];
    for (const card of active) {
        const rank = card.card_name.toLowerCase();
        for (const suit of SUITS) await fs.rm(path.join(images, `${rank}-${suit}.svg`), { force: true });
        const file = `${rank}.svg`;
        await fs.writeFile(path.join(images, file), await QRCode.toString(card.qr_token, {
            type: "svg", errorCorrectionLevel: "M", margin: 4, width: 300
        }));
        labels.push({ name: card.card_name, payload: card.qr_token, file });
    }
    await fs.writeFile(path.join(outputDir, "physical-card-qr-codes.md"), [
        "# Function Junction — 13 rank-only QR labels", "",
        "Print and attach the same rank QR to real cards of any suit. Labels contain card tokens only, not web addresses.", "",
        "In physical-card mode, click **Scan card** in the game website, allow this device's camera, and show the label. The question opens on the same screen. Camera access requires HTTPS or localhost; no separate phone connection is needed.", "",
        "Print at 100% scale, keep the white border and use at least 30 mm per QR. Test a label before printing all copies. The same rank can be played and scored on later turns; only one answer and move are allowed per turn.", "",
        "| Card rank | Printable QR | Encoded token |", "| --- | --- | --- |",
        ...labels.map(label => `| ${label.name} | ![QR for ${label.name}](qr-codes/${label.file}) | \`${label.payload}\` |`), ""
    ].join("\n"));
    await fs.writeFile(path.join(outputDir, "physical-card-qr-codes.html"),
        `<!doctype html><html lang="en"><meta charset="utf-8"><title>Function Junction QR labels</title>
<style>body{font:14px sans-serif;background:white;color:black;margin:12mm}main{display:grid;grid-template-columns:repeat(4,42mm);gap:5mm}.label{border:1px dashed #aaa;text-align:center;padding:2mm;break-inside:avoid}.label img{width:32mm;height:32mm;display:block;margin:auto}@page{size:A4;margin:12mm}@media print{header{display:none}body{margin:0}}</style>
<header><h1>13 rank-only QR labels</h1><p>Scan using the game website's camera. No IP address or suits are encoded. Print at 100% scale with white borders.</p><button onclick="window.print()">Print labels</button></header><main>
${labels.map(label => `<article class="label"><img src="qr-codes/${label.file}" alt="${label.name}"><strong>${label.name}</strong></article>`).join("\n")}</main></html>`);
    return labels;
}

async function main() {
    const pool = require("../server/src/config/database");
    try {
        const [cards] = await pool.execute("SELECT card_name, qr_token FROM cards WHERE is_active = 1 ORDER BY card_id");
        const labels = await generate(cards, path.join(__dirname, "../docs"));
        console.log(`Generated ${labels.length} labels: docs/physical-card-qr-codes.md and .html`);
    } finally { await pool.end(); }
}
if (require.main === module) main().catch(error => { console.error("QR generation failed:", error.message); process.exitCode = 1; });
module.exports = { generate };
