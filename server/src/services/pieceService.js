const pool = require("../config/database");

const TRACK_SIZE = 52;
const TEAM_ENTRY = [0, 13, 26, 39]; // Entry spaces for 4 teams
const PIECES_PER_TEAM = 4;
const QUEUE_SIZE = 4;

// Initialize 4 pieces per team for a newly started session
async function initializePieces(connection, sessionId, teams) {
    for (const team of teams) {
        for (let i = 1; i <= PIECES_PER_TEAM; i++) {
            await connection.execute(
                `INSERT IGNORE INTO game_pieces
                    (session_id, team_id, piece_number, position_type, position_index)
                 VALUES (?, ?, ?, 'home', 0)`,
                [sessionId, team.team_id, i]
            );
        }
    }
}

// Get all pieces for a session with team info (auto-initializes 4 pieces in home per team if needed)
async function getPieces(sessionId) {
    let [pieces] = await pool.execute(
        `SELECT gp.piece_id, gp.session_id, gp.team_id, gp.piece_number,
                gp.position_type, gp.position_index,
                t.team_name, t.team_colour
         FROM game_pieces gp
         JOIN teams t ON t.team_id = gp.team_id
         WHERE gp.session_id = ?
         ORDER BY gp.team_id, gp.piece_number`,
        [sessionId]
    );

    if (pieces.length === 0) {
        const [teams] = await pool.execute(
            `SELECT team_id FROM teams WHERE session_id = ? ORDER BY team_id`,
            [sessionId]
        );
        if (teams.length > 0) {
            await initializePieces(pool, sessionId, teams);
            [pieces] = await pool.execute(
                `SELECT gp.piece_id, gp.session_id, gp.team_id, gp.piece_number,
                        gp.position_type, gp.position_index,
                        t.team_name, t.team_colour
                 FROM game_pieces gp
                 JOIN teams t ON t.team_id = gp.team_id
                 WHERE gp.session_id = ?
                 ORDER BY gp.team_id, gp.piece_number`,
                [sessionId]
            );
        }
    }

    return pieces;
}

// Determine board index (0..3) for a team in the session
async function getTeamBoardIndex(db, sessionId, teamId) {
    const [teams] = await db.execute(
        `SELECT team_id FROM teams WHERE session_id = ? ORDER BY team_id`,
        [sessionId]
    );
    const index = teams.findIndex((t) => t.team_id === teamId);
    return index >= 0 ? index : 0;
}

// Enter a piece from home onto the track at the team's entry space
async function enterPiece(connection, sessionId, teamId, pieceId) {
    const [[piece]] = await connection.execute(
        `SELECT * FROM game_pieces WHERE piece_id = ? AND session_id = ? AND team_id = ? FOR UPDATE`,
        [pieceId, sessionId, teamId]
    );

    if (!piece) {
        throw new Error("Piece not found.");
    }
    if (piece.position_type !== "home") {
        throw new Error("Piece is already out of home.");
    }

    const boardIndex = await getTeamBoardIndex(connection, sessionId, teamId);
    const entrySpace = TEAM_ENTRY[boardIndex];

    // Check if an opponent piece is sitting at the entry space
    const [occupants] = await connection.execute(
        `SELECT gp.*, t.team_id AS occ_team_id
         FROM game_pieces gp
         JOIN teams t ON t.team_id = gp.team_id
         WHERE gp.session_id = ? AND gp.position_type = 'track' AND gp.position_index = ?
         FOR UPDATE`,
        [sessionId, entrySpace]
    );

    const captured = [];
    for (const occ of occupants) {
        if (occ.team_id !== teamId) {
            // Check if occupant is on their own safe base entry
            const occBoardIndex = await getTeamBoardIndex(connection, sessionId, occ.team_id);
            if (TEAM_ENTRY[occBoardIndex] !== entrySpace) {
                // Send back to home
                await connection.execute(
                    `UPDATE game_pieces SET position_type = 'home', position_index = 0 WHERE piece_id = ?`,
                    [occ.piece_id]
                );
                captured.push(occ.piece_id);
            }
        }
    }

    await connection.execute(
        `UPDATE game_pieces SET position_type = 'track', position_index = ? WHERE piece_id = ?`,
        [entrySpace, pieceId]
    );

    return { success: true, captured, entrySpace };
}

// Move a piece by a number of spaces (forward or backward)
async function movePiece(connection, sessionId, teamId, pieceId, spaces, isKing = false) {
    const [[piece]] = await connection.execute(
        `SELECT * FROM game_pieces WHERE piece_id = ? AND session_id = ? AND team_id = ? FOR UPDATE`,
        [pieceId, sessionId, teamId]
    );

    if (!piece) {
        throw new Error("Piece not found.");
    }
    if (piece.position_type !== "track" && piece.position_type !== "queue") {
        throw new Error("Piece must be on the track or queue to move.");
    }

    const boardIndex = await getTeamBoardIndex(connection, sessionId, teamId);
    const entrySpace = TEAM_ENTRY[boardIndex];
    const preEntrySpace = (entrySpace - 1 + TRACK_SIZE) % TRACK_SIZE;

    let newType = piece.position_type;
    let newIndex = piece.position_index;
    const captured = [];

    if (piece.position_type === "queue") {
        // Moving inside queue
        const targetSlot = piece.position_index + spaces;
        if (targetSlot < 1 || targetSlot > QUEUE_SIZE) {
            throw new Error("Invalid move inside queue.");
        }
        newIndex = targetSlot;
    } else if (spaces < 0) {
        // Backward move (e.g. Card 4)
        newIndex = (piece.position_index + spaces + TRACK_SIZE) % TRACK_SIZE;
    } else {
        // Forward move
        // Distance to pre-entry space
        const distToPreEntry = (preEntrySpace - piece.position_index + TRACK_SIZE) % TRACK_SIZE;

        if (spaces > distToPreEntry && distToPreEntry >= 0) {
            // Enters queue!
            const queueSlot = spaces - distToPreEntry;
            if (queueSlot >= 1 && queueSlot <= QUEUE_SIZE) {
                newType = "queue";
                newIndex = queueSlot;
            } else {
                // Cannot overshoot queue
                newIndex = (piece.position_index + spaces) % TRACK_SIZE;
            }
        } else {
            newIndex = (piece.position_index + spaces) % TRACK_SIZE;
        }
    }

    // Verify queue slot is not already occupied by another piece
    if (newType === "queue") {
        const [occQueue] = await connection.execute(
            `SELECT piece_id FROM game_pieces
             WHERE session_id = ? AND team_id = ? AND position_type = 'queue' AND position_index = ? AND piece_id != ?`,
            [sessionId, teamId, newIndex, pieceId]
        );
        if (occQueue.length > 0) {
            throw new Error("Target queue space is already occupied.");
        }
    }

    // Capture logic if landing on track
    if (newType === "track") {
        if (isKing) {
            // King captures all pieces passed or landed on
            const [allOccupants] = await connection.execute(
                `SELECT gp.* FROM game_pieces gp
                 WHERE gp.session_id = ? AND gp.position_type = 'track' AND gp.team_id != ?
                 FOR UPDATE`,
                [sessionId, teamId]
            );

            for (const occ of allOccupants) {
                const occBoardIndex = await getTeamBoardIndex(connection, sessionId, occ.team_id);
                // Cannot capture on opponent's safe entry space
                if (occ.position_index === TEAM_ENTRY[occBoardIndex]) continue;

                const dist = (occ.position_index - piece.position_index + TRACK_SIZE) % TRACK_SIZE;
                if (dist > 0 && dist <= spaces) {
                    await connection.execute(
                        `UPDATE game_pieces SET position_type = 'home', position_index = 0 WHERE piece_id = ?`,
                        [occ.piece_id]
                    );
                    captured.push(occ.piece_id);
                }
            }
        } else {
            // Normal landing capture
            const [occupants] = await connection.execute(
                `SELECT gp.* FROM game_pieces gp
                 WHERE gp.session_id = ? AND gp.position_type = 'track' AND gp.position_index = ? AND gp.team_id != ?
                 FOR UPDATE`,
                [sessionId, newIndex, teamId]
            );

            for (const occ of occupants) {
                const occBoardIndex = await getTeamBoardIndex(connection, sessionId, occ.team_id);
                if (occ.position_index !== TEAM_ENTRY[occBoardIndex]) {
                    await connection.execute(
                        `UPDATE game_pieces SET position_type = 'home', position_index = 0 WHERE piece_id = ?`,
                        [occ.piece_id]
                    );
                    captured.push(occ.piece_id);
                }
            }
        }
    }

    await connection.execute(
        `UPDATE game_pieces SET position_type = ?, position_index = ? WHERE piece_id = ?`,
        [newType, newIndex, pieceId]
    );

    return { success: true, newType, newIndex, captured };
}

// Swap positions of two pieces on the track (Jack)
async function swapPieces(connection, sessionId, teamId, pieceId, targetPieceId) {
    const [[myPiece]] = await connection.execute(
        `SELECT * FROM game_pieces WHERE piece_id = ? AND session_id = ? AND team_id = ? FOR UPDATE`,
        [pieceId, sessionId, teamId]
    );
    const [[targetPiece]] = await connection.execute(
        `SELECT * FROM game_pieces WHERE piece_id = ? AND session_id = ? FOR UPDATE`,
        [targetPieceId, sessionId]
    );

    if (!myPiece || !targetPiece) {
        throw new Error("One or both pieces not found.");
    }
    if (myPiece.position_type !== "track" || targetPiece.position_type !== "track") {
        throw new Error("Both pieces must be on the track to swap.");
    }
    if (targetPiece.team_id === teamId) {
        throw new Error("Cannot swap with your own piece.");
    }

    // Safety checks: neither can be on their respective entry spaces
    const myBoardIndex = await getTeamBoardIndex(connection, sessionId, teamId);
    const targetBoardIndex = await getTeamBoardIndex(connection, sessionId, targetPiece.team_id);

    if (myPiece.position_index === TEAM_ENTRY[myBoardIndex]) {
        throw new Error("Cannot swap a piece that is on its entry base.");
    }
    if (targetPiece.position_index === TEAM_ENTRY[targetBoardIndex]) {
        throw new Error("Cannot swap an opponent piece on its entry base.");
    }

    // Perform swap
    const tempIndex = myPiece.position_index;
    await connection.execute(
        `UPDATE game_pieces SET position_index = ? WHERE piece_id = ?`,
        [targetPiece.position_index, myPiece.piece_id]
    );
    await connection.execute(
        `UPDATE game_pieces SET position_index = ? WHERE piece_id = ?`,
        [tempIndex, targetPiece.piece_id]
    );

    return { success: true };
}

// Win check: all 4 pieces are in the queue
async function checkWin(db, sessionId, teamId) {
    const [[result]] = await db.execute(
        `SELECT COUNT(*) AS queue_count
         FROM game_pieces
         WHERE session_id = ? AND team_id = ? AND position_type = 'queue'`,
        [sessionId, teamId]
    );
    return Number(result.queue_count) >= PIECES_PER_TEAM;
}

module.exports = {
    TRACK_SIZE,
    TEAM_ENTRY,
    PIECES_PER_TEAM,
    QUEUE_SIZE,
    initializePieces,
    getPieces,
    getTeamBoardIndex,
    enterPiece,
    movePiece,
    swapPieces,
    checkWin
};

