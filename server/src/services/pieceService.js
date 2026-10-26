const pool = require("../config/database");

const TRACK_SIZE = 52;
// 4 Seats: Seat 0 = Red (Bottom-Right), Seat 1 = Blue (Top-Right), Seat 2 = Green (Top-Left), Seat 3 = Yellow (Bottom-Left)
const SEAT_ENTRY = { 0: 0, 1: 39, 2: 26, 3: 13 };
const SEAT_COLOURS = ["red", "blue", "green", "yellow"];
const PIECES_PER_SEAT = 4;
const QUEUE_SIZE = 4;
const WINNING_PIECES_COUNT = 8;

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

// Identifies all protected track positions:
// 1. A playing piece on its own Base
// 2. In the case of two consecutive playing pieces, the front piece is considered the "Base"
// Protected pieces cannot be bypassed, killed, or swapped.
function getProtectedPositions(allTrackPieces, teams) {
    const protectedIndices = new Set();
    const trackOccupancy = new Map();

    for (const p of allTrackPieces) {
        trackOccupancy.set(p.position_index, p);
        const teamIdx = teams.findIndex(t => t.team_id === p.team_id);
        const seat = getSeatForPiece(p, teamIdx >= 0 ? teamIdx : 0);
        // Piece on its own Base entry
        if (p.position_index === SEAT_ENTRY[seat]) {
            protectedIndices.add(p.position_index);
        }
    }

    // Check for two consecutive pieces (front piece is protected)
    for (const p of allTrackPieces) {
        const behindPos = (p.position_index - 1 + TRACK_SIZE) % TRACK_SIZE;
        if (trackOccupancy.has(behindPos)) {
            // There is a piece immediately behind this one, so this front piece is protected!
            protectedIndices.add(p.position_index);
        }
    }

    return protectedIndices;
}

// Enter a piece from home onto the track at the seat's entry base
// Validates that ONLY Ace or King can exit from home
async function enterPiece(connection, sessionId, teamId, pieceId, cardName = "") {
    if (cardName) {
        const norm = String(cardName).trim().toLowerCase();
        if (!["ace", "king"].includes(norm)) {
            throw new Error("Only Ace or King can exit a marble from the home base!");
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

    // Check occupants at the entry base
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
        // If occupant is on its own base, it cannot be killed
        const occTeamIndex = await getTeamBoardIndex(connection, sessionId, occ.team_id);
        const occSeat = getSeatForPiece(occ, occTeamIndex);
        if (SEAT_ENTRY[occSeat] === entrySpace && occ.piece_id !== pieceId) {
            throw new Error("Your entry base is already occupied by a protected marble.");
        }

        // Return occupant to home
        await connection.execute(
            `UPDATE game_pieces SET position_type = 'home', position_index = 0 WHERE piece_id = ?`,
            [occ.piece_id]
        );
        captured.push(occ.piece_id);
    }

    await connection.execute(
        `UPDATE game_pieces SET position_type = 'track', position_index = ? WHERE piece_id = ?`,
        [entrySpace, pieceId]
    );

    return { success: true, captured, entrySpace, seatIndex };
}

// Move a piece by a number of spaces (forward or backward)
async function movePiece(connection, sessionId, teamId, pieceId, spaces, cardName = "") {
    const norm = String(cardName || "").trim().toLowerCase();
    if (norm === "king") {
        throw new Error("King can only be used to exit a marble from Home to Base!");
    }

    const [[piece]] = await connection.execute(
        `SELECT * FROM game_pieces WHERE piece_id = ? AND session_id = ? AND team_id = ? FOR UPDATE`,
        [pieceId, sessionId, teamId]
    );

    if (!piece) {
        throw new Error("Piece not found.");
    }
    if (piece.position_type !== "track" && piece.position_type !== "queue") {
        throw new Error("Piece must be on the track or safe zone to move.");
    }

    const [teams] = await connection.execute(
        `SELECT team_id FROM teams WHERE session_id = ? ORDER BY team_id`,
        [sessionId]
    );
    const teamIndex = teams.findIndex((t) => t.team_id === teamId);
    const seatIndex = getSeatForPiece(piece, teamIndex >= 0 ? teamIndex : 0);
    const entrySpace = SEAT_ENTRY[seatIndex];
    const preEntrySpace = (entrySpace - 1 + TRACK_SIZE) % TRACK_SIZE;

    let newType = piece.position_type;
    let newIndex = piece.position_index;
    const captured = [];

    if (piece.position_type === "queue") {
        // Moving inside Safe zone (queue slots 1..4)
        const targetSlot = piece.position_index + spaces;
        if (targetSlot < 1 || targetSlot > QUEUE_SIZE) {
            throw new Error("Invalid move inside Safe zone: cannot move past slot 4.");
        }
        newIndex = targetSlot;
    } else if (spaces < 0) {
        // Backward move (Card 4: -4 spaces)
        newIndex = (piece.position_index + spaces + TRACK_SIZE) % TRACK_SIZE;

        // Check if backward move tries to land on a protected Base/consecutive piece
        const [allTrack] = await connection.execute(
            `SELECT gp.* FROM game_pieces gp WHERE gp.session_id = ? AND gp.position_type = 'track'`,
            [sessionId]
        );
        const protectedPos = getProtectedPositions(allTrack, teams);
        if (protectedPos.has(newIndex)) {
            throw new Error("Cannot land on a protected Base spot.");
        }
    } else {
        // Forward move
        // Check for protected spots (Base or consecutive front piece) that CANNOT be bypassed or landed on
        const [allTrack] = await connection.execute(
            `SELECT gp.* FROM game_pieces gp WHERE gp.session_id = ? AND gp.position_type = 'track'`,
            [sessionId]
        );
        const protectedPos = getProtectedPositions(allTrack, teams);

        // Distance to pre-entry space (turning into the inward safe zone)
        const distToPreEntry = (preEntrySpace - piece.position_index + TRACK_SIZE) % TRACK_SIZE;

        // Check if movement turns into Safe zone
        if (spaces > distToPreEntry && distToPreEntry >= 0) {
            const queueSlot = spaces - distToPreEntry;
            if (queueSlot > QUEUE_SIZE) {
                // Rule: To enter Safe zone, card value must allow entering without overshooting!
                throw new Error("Cannot overshoot the Safe zone! Movement must fit within the 4 safe slots.");
            }

            // Verify path up to pre-entry has no bypass blockades
            for (let step = 1; step <= distToPreEntry; step++) {
                const checkPos = (piece.position_index + step) % TRACK_SIZE;
                if (protectedPos.has(checkPos) && checkPos !== piece.position_index) {
                    throw new Error("Movement blocked: A piece on Base or consecutive front piece cannot be bypassed.");
                }
            }

            newType = "queue";
            newIndex = queueSlot;
        } else {
            // Forward movement along perimeter track
            for (let step = 1; step <= spaces; step++) {
                const checkPos = (piece.position_index + step) % TRACK_SIZE;
                if (protectedPos.has(checkPos) && checkPos !== piece.position_index) {
                    throw new Error("Movement blocked: A piece on Base or consecutive front piece cannot be bypassed or killed.");
                }
            }
            newIndex = (piece.position_index + spaces) % TRACK_SIZE;
        }
    }

    // Verify target Safe zone slot is not already occupied by another piece
    if (newType === "queue") {
        const [occQueue] = await connection.execute(
            `SELECT piece_id FROM game_pieces
             WHERE session_id = ? AND team_id = ? AND position_type = 'queue' AND position_index = ? AND piece_id != ?`,
            [sessionId, teamId, newIndex, pieceId]
        );
        if (occQueue.length > 0) {
            throw new Error("Target Safe zone slot is already occupied.");
        }
    }

    // Capture logic when landing on track:
    // "If a playing piece lands on another, it is returned to its Home."
    if (newType === "track") {
        const [occupants] = await connection.execute(
            `SELECT gp.* FROM game_pieces gp
             WHERE gp.session_id = ? AND gp.position_type = 'track' AND gp.position_index = ? AND gp.piece_id != ?
             FOR UPDATE`,
            [sessionId, newIndex, pieceId]
        );

        for (const occ of occupants) {
            const occBoardIndex = await getTeamBoardIndex(connection, sessionId, occ.team_id);
            const occSeat = getSeatForPiece(occ, occBoardIndex);
            if (occ.position_index === SEAT_ENTRY[occSeat]) {
                throw new Error("Target spot is protected by its Base.");
            }

            await connection.execute(
                `UPDATE game_pieces SET position_type = 'home', position_index = 0 WHERE piece_id = ?`,
                [occ.piece_id]
            );
            captured.push(occ.piece_id);
        }
    }

    await connection.execute(
        `UPDATE game_pieces SET position_type = ?, position_index = ? WHERE piece_id = ?`,
        [newType, newIndex, pieceId]
    );

    return { success: true, newType, newIndex, captured };
}

// Swap positions of two pieces on the track (Jack)
// Rule: "Jack: Swaps any opponent's playing piece with another, provided neither piece is in Home, Base, or Safe zones."
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
        throw new Error("Both pieces must be on the track to swap (cannot swap pieces in Home or Safe zone).");
    }
    if (targetPiece.team_id === teamId) {
        throw new Error("Jack can only swap with an opponent's piece.");
    }

    const [teams] = await connection.execute(
        `SELECT team_id FROM teams WHERE session_id = ? ORDER BY team_id`,
        [sessionId]
    );
    const myBoardIndex = teams.findIndex(t => t.team_id === teamId);
    const mySeat = getSeatForPiece(myPiece, myBoardIndex >= 0 ? myBoardIndex : 0);
    const targetBoardIndex = teams.findIndex(t => t.team_id === targetPiece.team_id);
    const targetSeat = getSeatForPiece(targetPiece, targetBoardIndex >= 0 ? targetBoardIndex : 0);

    // Rule: Neither piece can be on its respective Base
    if (myPiece.position_index === SEAT_ENTRY[mySeat]) {
        throw new Error("Cannot swap a piece that is on its entry Base.");
    }
    if (targetPiece.position_index === SEAT_ENTRY[targetSeat]) {
        throw new Error("Cannot swap an opponent piece on its entry Base.");
    }

    // Check consecutive protected front piece
    const [allTrack] = await connection.execute(
        `SELECT gp.* FROM game_pieces gp WHERE gp.session_id = ? AND gp.position_type = 'track'`,
        [sessionId]
    );
    const protectedPos = getProtectedPositions(allTrack, teams);
    if (protectedPos.has(targetPiece.position_index)) {
        throw new Error("Cannot swap this piece: it is protected as Base or consecutive front piece.");
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

// Win check: all 8 pieces in the Safe zone for the team
async function checkWin(db, sessionId, teamId) {
    const [[result]] = await db.execute(
        `SELECT COUNT(*) AS queue_count
         FROM game_pieces
         WHERE session_id = ? AND team_id = ? AND position_type = 'queue'`,
        [sessionId, teamId]
    );
    return Number(result.queue_count) >= WINNING_PIECES_COUNT;
}

module.exports = {
    TRACK_SIZE,
    SEAT_ENTRY,
    SEAT_COLOURS,
    PIECES_PER_SEAT,
    QUEUE_SIZE,
    WINNING_PIECES_COUNT,
    getSeatForPiece,
    initializePieces,
    getPieces,
    getTeamBoardIndex,
    getProtectedPositions,
    enterPiece,
    movePiece,
    swapPieces,
    checkWin
};
