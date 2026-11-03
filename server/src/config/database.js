const mysql = require("mysql2/promise");
const databaseOptions = require("./databaseOptions");

const poolConfig = {
    ...databaseOptions(),
    waitForConnections: true,
    connectionLimit: 10
};

const pool = mysql.createPool(poolConfig);

module.exports = pool;
