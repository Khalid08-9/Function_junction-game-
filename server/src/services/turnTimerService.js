const pool = require("../config/database");
const { expireTurn } = require("./turnService");

async function expireSessionTurn(sessionId) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        await expireTurn(connection, sessionId);
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

function startTurnTimer() {
    let running = false;
    async function tick() {
        if (running) return;
        running = true;
        try {
            const [sessions] = await pool.execute(
                `SELECT st.session_id FROM game_state st
                 JOIN game_sessions gs ON gs.session_id = st.session_id
                 WHERE gs.status = 'active'
                   AND st.turn_started_at <= NOW() - INTERVAL 60 SECOND`
            );
            for (const session of sessions) await expireSessionTurn(session.session_id);
        } catch (error) {
            console.error("Turn timer failed:", error.code || error.message);
        } finally {
            running = false;
        }
    }
    const timer = setInterval(tick, 1000);
    timer.unref();
    tick();
    return timer;
}

module.exports = { expireSessionTurn, startTurnTimer };
