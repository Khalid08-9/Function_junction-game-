require("dotenv").config({ quiet: true });
const fs = require("node:fs/promises");
const path = require("node:path");
const mysql = require("mysql2/promise");
const databaseOptions = require("../server/src/config/databaseOptions");

// One-time conversion of the old combined setup into two portable SQL files.
async function splitLegacyFiles() {
    const filename = path.join(__dirname, "../database/schema.sql");
    const original = await fs.readFile(filename, "utf8");
    const marker = original.indexOf("START TRANSACTION;");
    if (marker < 0) return;
    const seed = "-- Shareable starter data only: no real student accounts or game history.\n" +
        "-- Import once after schema.sql into a fresh database. Register your own lecturer account.\nUSE function_junction;\n\n" + original.slice(marker);
    await fs.writeFile(path.join(__dirname, "../database/seed.sql"), seed, { flag: "wx" });
    const structure = original.slice(0, marker).replace(/^-- Fresh installation:.*\n-- Existing databases:.*\n/,
        "-- Fresh installation: table definitions only. Import seed.sql afterwards.\n-- Existing databases: back up first, then run npm run db:upgrade with an administrator account.\n");
    await fs.writeFile(filename, structure);
    console.log("Created database/schema.sql (structure) and database/seed.sql (starter data).");
}

async function upgradeDatabase() {
    const options = databaseOptions();
    if (process.env.DB_ADMIN_USER) options.user = process.env.DB_ADMIN_USER;
    if (process.env.DB_ADMIN_PASSWORD !== undefined) options.password = process.env.DB_ADMIN_PASSWORD;
    const connection = await mysql.createConnection(options);
    try {
        const schema = await fs.readFile(path.join(__dirname, "../database/schema.sql"), "utf8");
        const [tables] = await connection.query("SHOW TABLES");
        const names = new Set(tables.map(row => Object.values(row)[0]));
        if (!names.has("users")) throw new Error("This is not an existing installation. Import schema.sql and seed.sql for a fresh setup.");
        for (const sql of schema.split(/;\s*(?:\n|$)/)) {
            const match = sql.match(/CREATE TABLE\s+(\w+)/i);
            if (match && !names.has(match[1])) {
                await connection.query(sql); names.add(match[1]);
            }
        }
        async function column(table, name, definition) {
            const [found] = await connection.execute(
                "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?", [table, name]
            );
            if (!found.length) await connection.query(`ALTER TABLE ${mysql.escapeId(table)} ADD COLUMN ${mysql.escapeId(name)} ${definition}`);
        }
        await column("cards", "move_spaces", "INT NULL");
        await column("game_state", "turn_started_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
        await column("attempts", "round_turn_id", "INT UNSIGNED NULL");
        const [indexes] = await connection.query("SHOW INDEX FROM attempts");
        const indexNames = new Set(indexes.map(index => index.Key_name));
        if (!indexNames.has("uq_round_turn_attempt")) await connection.query("ALTER TABLE attempts ADD CONSTRAINT uq_round_turn_attempt UNIQUE (round_turn_id)");
        if (indexNames.has("uq_team_question")) await connection.query("ALTER TABLE attempts DROP INDEX uq_team_question");
        const [fk] = await connection.query("SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'attempts' AND CONSTRAINT_NAME = 'fk_attempt_round_turn'");
        if (!fk.length) await connection.query("ALTER TABLE attempts ADD CONSTRAINT fk_attempt_round_turn FOREIGN KEY (round_turn_id) REFERENCES round_turns(round_turn_id)");
        console.log("Database structure upgraded. Existing users, questions and game history were preserved.");
    } finally { await connection.end(); }
}

if (require.main === module) (process.argv.includes("--split-files") ? splitLegacyFiles() : upgradeDatabase())
    .catch(error => { console.error("Database preparation failed:", error.code || error.message); console.error("Upgrades need an administrator with ALTER/CREATE permission. Do not re-import the fresh schema over existing data."); process.exitCode = 1; });

module.exports = { upgradeDatabase };
