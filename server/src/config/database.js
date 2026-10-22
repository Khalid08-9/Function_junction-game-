const mysql = require("mysql2/promise");
const fs = require("fs");

const socketPath = process.env.DB_SOCKET || (fs.existsSync("/var/lib/mysql/mysql.sock") ? "/var/lib/mysql/mysql.sock" : undefined);

const poolConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
};

if (socketPath) {
    poolConfig.socketPath = socketPath;
} else {
    poolConfig.host = process.env.DB_HOST;
    poolConfig.port = Number(process.env.DB_PORT);
}

const pool = mysql.createPool(poolConfig);

module.exports = pool;
