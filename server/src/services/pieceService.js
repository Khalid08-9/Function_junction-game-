const pool = require("../config/database");

const TRACK_SIZE = 52;
// 4 Seats: Seat 0 = Red (Bottom-Right), Seat 1 = Blue (Top-Right), Seat 2 = Green (Top-Left), Seat 3 = Yellow (Bottom-Left)
const SEAT_ENTRY = { 0: 0, 1: 39, 2: 26, 3: 13 };
const SEAT_COLOURS = ["red", "blue", "green", "yellow"];
const PIECES_PER_SEAT = 4;
const QUEUE_SIZE = 4;

// Determine seat (0..3) for a given piece and team index
// Team 1 (index 0) gets Seat 0 (Red) and Seat 2 (Green)
// Team 2 (index 1) gets Seat 1 (Blue) and Seat 3 (Yellow)
function getSeatForPiece(piece, teamIndex) {
    if (teamIndex === 0) {
        return piece.piece_number <= 4 ? 0 : 2;
    } else {
        return piece.piece_number <= 4 ? 1 : 3;
    }
}

// Initialize 8 pieces per team (4 per corner base, total 16 pieces across 4 corners)
async function initializePieces(connection, sessionId, teams) {
    for (const team of teams) {
        for (let i = 1; i <= 8; i++) {
            await connection.execute(
                `INSERT IGNORE INTO game_pieces
                    (session_id, team_id, piece_number, position_type, position_index)
                 VALUES (?, ?, ?, 'home', 0)`,
                [sessionId, team.team_id, i]
            );
        }
    }
}

// Determine board index (0..1) for a team in the session
async function getTeamBoardIndex(db, sessionId, teamId) {
    const [teams] = await db.execute(
        `SELECT team_id FROM teams WHERE session_id = ? ORDER BY team_id`,
        [sessionId]
    );
    const index = teams.findIndex((t) => t.team_id === teamId);
    return index >= 0 ? index : 0;
}

// Get all pieces for a session with seat info (auto-initializes 16 pieces in 4 corner bases)
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

    const [teams] = await pool.execute(
        `SELECT team_id FROM teams WHERE session_id = ? ORDER BY team_id`,
        [sessionId]
    );

    if (pieces.length === 0 || pieces.length < 16) {
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

    // Decorate each piece with its dedicated corner seat and seat colour
    return pieces.map(piece => {
        const teamIndex = teams.findIndex(t => t.team_id === piece.team_id);
        const seatIndex = getSeatForPiece(piece, teamIndex >= 0 ? teamIndex : 0);
        return {
            ...piece,
            seat_index: seatIndex,
            seat_colour: SEAT_COLOURS[seatIndex]
        };
    });
}

// Enter a piece from home onto the track at the seat's entry space
// Validates that only Ace, King, or Joker can exit from home
async function enterPiece(connection, sessionId, teamId, pieceId, cardName = "") {
    if (cardName) {
        const norm = String(cardName).trim().toLowerCase();
        if (!["ace", "king", "joker"].includes(norm)) {
            throw new Error("Only Ace, King, or Joker can exit a marble from the home base!");
        }
    }

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

    const teamIndex = await getTeamBoardIndex(connection, sessionId, teamId);
    const seatIndex = getSeatForPiece(piece, teamIndex);
    const entrySpace = SEAT_ENTRY[seatIndex];

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
            const occTeamIndex = await getTeamBoardIndex(connection, sessionId, occ.team_id);
            const occSeat = getSeatForPiece(occ, occTeamIndex);
            if (SEAT_ENTRY[occSeat] !== entrySpace) {
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

    return { success: true, captured, entrySpace, seatIndex };
}

// Move a piece by a number of spaces (forward or backward) with Base Entry Blockade support
async function movePiece(connection, sessionId, teamId, pieceId, spaces, isKing = false, isJoker = false) {
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

    const teamIndex = await getTeamBoardIndex(connection, sessionId, teamId);
    const seatIndex = getSeatForPiece(piece, teamIndex);
    const entrySpace = SEAT_ENTRY[seatIndex];
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
        // Check for Base Entry Blockades:
        // "when the ball stope in the places that I put arror the player whostoping canot move until put joker or wating for blue to move"
        if (!isJoker) {
            const [allPieces] = await connection.execute(
                `SELECT gp.*, t.team_id AS p_team_id
                 FROM game_pieces gp
                 JOIN teams t ON t.team_id = gp.team_id
                 WHERE gp.session_id = ? AND gp.position_type = 'track'`,
                [sessionId]
            );

            // Collect any base entry space occupied by its owning seat's marble
            const blockedEntries = new Set();
            for (const p of allPieces) {
                const pTeamIdx = await getTeamBoardIndex(connection, sessionId, p.team_id);
                const pSeat = getSeatForPiece(p, pTeamIdx);
                const baseEntry = SEAT_ENTRY[pSeat];
                if (p.position_index === baseEntry && p.piece_id !== pieceId) {
                    blockedEntries.add(baseEntry);
                }
            }

            // Check if any step in this move passes through or lands on a blocked base entry
            for (let step = 1; step <= spaces; step++) {
                const checkPos = (piece.position_index + step) % TRACK_SIZE;
                if (blockedEntries.has(checkPos)) {
                    throw new Error("Movement blocked: A marble is protecting its base entry spot. You cannot pass until a Joker is played or that marble moves.");
                }
            }
        }

        // Distance to pre-entry space (turning into the inward queue)
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
            // King captures all pieces passed or landed on (except safe base entries)
            const [allOccupants] = await connection.execute(
                `SELECT gp.* FROM game_pieces gp
                 WHERE gp.session_id = ? AND gp.position_type = 'track' AND gp.team_id != ?
                 FOR UPDATE`,
                [sessionId, teamId]
            );

            for (const occ of allOccupants) {
                const occBoardIndex = await getTeamBoardIndex(connection, sessionId, occ.team_id);
                const occSeat = getSeatForPiece(occ, occBoardIndex);
                if (occ.position_index === SEAT_ENTRY[occSeat]) continue; // safe on base

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
                const occSeat = getSeatForPiece(occ, occBoardIndex);
                if (occ.position_index !== SEAT_ENTRY[occSeat]) {
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

    // Safety checks: neither piece can be on its respective entry space
    const myBoardIndex = await getTeamBoardIndex(connection, sessionId, teamId);
    const mySeat = getSeatForPiece(myPiece, myBoardIndex);
    const targetBoardIndex = await getTeamBoardIndex(connection, sessionId, targetPiece.team_id);
    const targetSeat = getSeatForPiece(targetPiece, targetBoardIndex);

    if (myPiece.position_index === SEAT_ENTRY[mySeat]) {
        throw new Error("Cannot swap a piece that is on its entry base.");
    }
    if (targetPiece.position_index === SEAT_ENTRY[targetSeat]) {
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

// Win check: at least 4 pieces in the queue for the team
async function checkWin(db, sessionId, teamId) {
    const [[result]] = await db.execute(
        `SELECT COUNT(*) AS queue_count
         FROM game_pieces
         WHERE session_id = ? AND team_id = ? AND position_type = 'queue'`,
        [sessionId, teamId]
    );
    return Number(result.queue_count) >= PIECES_PER_SEAT;
}

module.exports = {
    TRACK_SIZE,
    SEAT_ENTRY,
    SEAT_COLOURS,
    PIECES_PER_SEAT,
    QUEUE_SIZE,
    getSeatForPiece,
    initializePieces,
    getPieces,
    getTeamBoardIndex,
    enterPiece,
    movePiece,
    swapPieces,
    checkWin
};
