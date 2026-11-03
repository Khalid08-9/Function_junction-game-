function databaseOptions() {
    const options = {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || "function_junction",
        charset: "utf8mb4",
        connectTimeout: 10000
    };
    if (process.env.DB_SOCKET) options.socketPath = process.env.DB_SOCKET;
    else {
        // TCP defaults work on Windows, macOS and Linux; no machine-specific socket.
        options.host = process.env.DB_HOST === "localhost" ? "127.0.0.1" : process.env.DB_HOST || "127.0.0.1";
        options.port = Number(process.env.DB_PORT) || 3306;
    }
    return options;
}
module.exports = databaseOptions;
