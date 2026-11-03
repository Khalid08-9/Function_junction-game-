require("dotenv").config({ quiet: true });
const fs = require("node:fs/promises");
const path = require("node:path");
const mysql = require("mysql2/promise");
const databaseOptions = require("../server/src/config/databaseOptions");

async function backupDatabase(directory = path.join(__dirname, "../backups")) {
    const connection = await mysql.createConnection({ ...databaseOptions(), dateStrings: true, supportBigNumbers: true, bigNumberStrings: true });
    let file;
    let filename;
    const counts = {};
    try {
        await fs.mkdir(directory, { recursive: true, mode: 0o700 });
        filename = path.join(directory, `function-junction-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`);
        file = await fs.open(filename, "wx", 0o600);
        await connection.query("SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ");
        await connection.query("START TRANSACTION WITH CONSISTENT SNAPSHOT");
        await file.write("-- PRIVATE full database backup: contains personal data and password hashes.\n" +
            "-- Restore ONLY into a new empty database. Do not import seed.sql as well.\n" +
            `-- Created: ${new Date().toISOString()}\n` +
            "SET NAMES utf8mb4;\nSET @OLD_SQL_MODE=@@SQL_MODE;\nSET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';\n" +
            "SET FOREIGN_KEY_CHECKS=0;\n");
        const [tables] = await connection.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
        for (const row of tables) {
            const table = Object.values(row)[0];
            const name = mysql.escapeId(table);
            const [[ddl]] = await connection.query(`SHOW CREATE TABLE ${name}`);
            await file.write(`\n${ddl['Create Table']};\n`);
            const [keys] = await connection.query(`SHOW INDEX FROM ${name} WHERE Key_name = 'PRIMARY'`);
            const order = keys.length ? ' ORDER BY ' + keys.sort((a, b) => a.Seq_in_index - b.Seq_in_index)
                .map(key => mysql.escapeId(key.Column_name)).join(', ') : '';
            counts[table] = 0;
            for (let offset = 0; ; offset += 500) {
                const [rows] = await connection.query(`SELECT * FROM ${name}${order} LIMIT 500 OFFSET ${offset}`);
                if (!rows.length) break;
                const columns = Object.keys(rows[0]);
                const values = rows.map(record => '(' + columns.map(column => {
                    const value = record[column];
                    return mysql.escape(value && typeof value === 'object' && !Buffer.isBuffer(value) ? JSON.stringify(value) : value);
                }).join(', ') + ')').join(',\n');
                await file.write(`INSERT INTO ${name} (${columns.map(column => mysql.escapeId(column)).join(', ')}) VALUES\n${values};\n`);
                counts[table] += rows.length;
            }
        }
        await file.write("\nSET FOREIGN_KEY_CHECKS=1;\nSET SQL_MODE=@OLD_SQL_MODE;\n");
        await connection.commit();
        await file.close(); file = null;
        await fs.writeFile(filename + ".json", JSON.stringify({ created_at: new Date().toISOString(), file: path.basename(filename), tables: counts }, null, 2), { mode: 0o600 });
        return { filename, counts };
    } catch (error) {
        await connection.rollback();
        if (file) await file.close();
        if (filename) await fs.rm(filename, { force: true });
        throw error;
    } finally { await connection.end(); }
}

if (require.main === module) backupDatabase().then(({ filename, counts }) => {
    console.log("Private backup saved:", filename);
    console.log("Table row counts:", counts);
    console.log("Keep this file private; it is excluded from Git. Share it with your lecturer only through a trusted channel.");
}).catch(error => { console.error("Backup failed:", error.code || error.message); process.exitCode = 1; });

module.exports = { backupDatabase };
