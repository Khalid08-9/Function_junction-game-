// Function Junction - Jackaroo Game Room Client Script
// Handles board rendering, marble movements, QR code phone scan, card-based questions, turns, and real-time polling.
(function () {
    'use strict';

    function $(selector) {
        return document.querySelector(selector);
    }

    const room = $('#game-room');
    if (!room) return;

    const sessionId = Number(room.dataset.sessionId);
    const myTeamId = Number(room.dataset.myTeamId);
    const myUserId = Number(room.dataset.myUserId);
    const questionSeconds = Number(room.dataset.questionSeconds) || 30;
    const POLL_MS = 3000;

    // ---------- BOARD GEOMETRY (15x15 grid, indices 0..14) ----------
    // 52 Track positions (CLOCKWISE perimeter loop, matching Image 3)
    const TRACK_COORDS = [
        // Bottom End Cap (Seat 0 Red Base Entry at 0, moving LEFT <-- to [6, 14])
        [8, 14], // 0: Red Base Entry (yellow ring)
        [7, 14], // 1: Bottom center cap (arrow <-- pointing left)
        [6, 14], // 2: Bottom outer left
        // Up bottom arm left column
        [6, 13], // 3
        [6, 12], // 4
        [6, 11], // 5
        [6, 10], // 6
        [6, 9],  // 7: Bottom inner left corner
        // Left arm bottom row moving left
        [5, 8],  // 8: Left inner bottom corner
        [4, 8],  // 9
        [3, 8],  // 10
        [2, 8],  // 11
        [1, 8],  // 12: Pre-entry for Yellow queue
        // Left End Cap (Seat 3 Yellow Base Entry at 13, moving UP ^ to [0, 6])
        [0, 8],  // 13: Yellow Base Entry (yellow ring)
        [0, 7],  // 14: Left center cap (arrow ^ pointing up)
        [0, 6],  // 15: Left outer top
        // Right along left arm top row
        [1, 6],  // 16
        [2, 6],  // 17
        [3, 6],  // 18
        [4, 6],  // 19
        [5, 6],  // 20: Left inner top corner
        // Up top arm left column
        [6, 5],  // 21: Top inner left corner
        [6, 4],  // 22
        [6, 3],  // 23
        [6, 2],  // 24
        [6, 1],  // 25: Pre-entry for Green queue
        // Top End Cap (Seat 2 Green Base Entry at 26, moving RIGHT --> to [8, 0])
        [6, 0],  // 26: Green Base Entry (yellow ring)
        [7, 0],  // 27: Top center cap (arrow --> pointing right)
        [8, 0],  // 28: Top outer right
        // Down top arm right column
        [8, 1],  // 29
        [8, 2],  // 30
        [8, 3],  // 31
        [8, 4],  // 32
        [8, 5],  // 33: Top inner right corner
        // Right along right arm top row
        [9, 6],  // 34: Right inner top corner
        [10, 6], // 35
        [11, 6], // 36
        [12, 6], // 37
        [13, 6], // 38: Pre-entry for Blue queue
        // Right End Cap (Seat 1 Blue Base Entry at 39, moving DOWN to [14, 8])
        [14, 6], // 39: Blue Base Entry (yellow ring)
        [14, 7], // 40: Right center cap (moving down)
        [14, 8], // 41: Right outer bottom
        // Left along right arm bottom row
        [13, 8], // 42
        [12, 8], // 43
        [11, 8], // 44
        [10, 8], // 45
        [9, 8],  // 46: Right inner bottom corner
        // Down bottom arm right column
        [8, 9],  // 47: Bottom inner right corner
        [8, 10], // 48
        [8, 11], // 49
        [8, 12], // 50
        [8, 13]  // 51: Pre-entry for Red queue
    ];

    // 4 Inward Queue Rows (heading straight into center medallion)
    const QUEUE_COORDS = [
        // Seat 0 (Red, bottom arm): heading UP to center
        [[7, 13], [7, 12], [7, 11], [7, 10]],
        // Seat 1 (Blue, right arm): heading LEFT to center (matching Image 3 Blue row)
        [[13, 7], [12, 7], [11, 7], [10, 7]],
        // Seat 2 (Green, top arm): heading DOWN to center
        [[7, 1],  [7, 2],  [7, 3],  [7, 4]],
        // Seat 3 (Yellow, left arm): heading RIGHT to center
        [[1, 7],  [2, 7],  [3, 7],  [4, 7]]
    ];

    // 4 Corner Diamond Bases ("unique squares for each seat")
    const HOME_BASE_AREAS = [
        { centerCol: 11.5, centerRow: 11.5 }, // Seat 0: Red (bottom-right)
        { centerCol: 11.5, centerRow: 2.5 },  // Seat 1: Blue (top-right)
        { centerCol: 2.5,  centerRow: 2.5 },  // Seat 2: Green (top-left)
        { centerCol: 2.5,  centerRow: 11.5 }  // Seat 3: Yellow (bottom-left)
    ];

    // Exact socket coordinates for the 4 balls inside each diamond home base
    const HOME_COORDS = [
        // Seat 0: Red (bottom-right)
        [[11.5, 10.5], [12.5, 11.5], [11.5, 12.5], [10.5, 11.5]],
        // Seat 1: Blue (top-right)
        [[11.5, 1.5],  [12.5, 2.5],  [11.5, 3.5],  [10.5, 2.5]],
        // Seat 2: Green (top-left)
        [[2.5, 1.5],   [3.5, 2.5],   [2.5, 3.5],   [1.5, 2.5]],
        // Seat 3: Yellow (bottom-left)
        [[2.5, 10.5],  [3.5, 11.5],  [2.5, 12.5],  [1.5, 11.5]]
    ];

    // Base Entry Spaces on the 52-space track (Base Protection Spots)
    const SEAT_ENTRY = { 0: 0, 1: 39, 2: 26, 3: 13 };
    const ENTRY_POINTS = [0, 39, 26, 13];

    const TEAM_COLOUR_TEMPLATES = {
        red: 'rgba(229, 57, 53, ALPHA)',
        blue: 'rgba(30, 136, 229, ALPHA)',
        green: 'rgba(67, 160, 71, ALPHA)',
        yellow: 'rgba(253, 216, 53, ALPHA)',
        purple: 'rgba(142, 36, 170, ALPHA)',
        orange: 'rgba(251, 140, 0, ALPHA)'
    };

    function getRgbaColour(colourName, alpha) {
        const key = String(colourName || '').toLowerCase().trim();
        const template = TEAM_COLOUR_TEMPLATES[key] || 'rgba(255, 200, 61, ALPHA)';
        return template.replace('ALPHA', String(alpha));
    }

    function gridToPercent(col, row) {
        return {
            left: ((col / 14) * 100).toFixed(4) + '%',
            top: ((row / 14) * 100).toFixed(4) + '%'
        };
    }

    // ---------- DOM REFERENCES ----------
    const boardEl = $('#jackaroo-board');
    const banner = $('#turn-banner');
    const roundInfo = $('#round-info');
    const gameMessage = $('#game-message');
    const endTurnButton = $('#end-turn-button');
    const turnHint = $('#turn-hint');
    const orderList = $('#order-list');
    const cardButtonsBox = $('#card-buttons');

    const centerCardSlot = $('#center-card-slot');
    const centerCardImg = $('#center-card-img');
    const centerBrand = $('#center-brand');

    const panelCardQr = $('#panel-card-qr');
    const qrCardImg = $('#qr-card-img');
    const qrCardName = $('#qr-card-name');
    const qrCardEffect = $('#qr-card-effect');
    const qrCodeImg = $('#qr-code-img');
    const qrStatusText = $('#qr-status-text');
    const btnAnswerDesktop = $('#btn-answer-desktop');
    const btnCancelQr = $('#btn-cancel-qr');

    const moveChoicesBox = $('#move-choices');
    const moveActionText = $('#move-action-text');
    const cancelMoveChoice = $('#cancel-move-choice');

    const selectMarbleTitle = $('#select-marble-title');
    const selectMarbleHint = $('#select-marble-hint');
    const cancelSelect = $('#cancel-select');

    const cardDetected = $('#card-detected');
    const questionTitle = $('#question-title');
    const timerBox = $('#timer');
    const timerText = $('#timer-text');
    const questionCode = $('#question-code');
    const answerForm = $('#answer-form');
    const optionsBox = $('#options');
    const submitButton = $('#submit-answer');

    const resultIcon = $('#result-icon');
    const resultTitle = $('#result-title');
    const resultAction = $('#result-action');
    const resultPoints = $('#result-points');
    const resultScore = $('#result-score');
    const resultAnswer = $('#result-answer');
    const resultExplanation = $('#result-explanation');
    const moveMarbleBtn = $('#move-marble-btn');
    const skipMoveBtn = $('#skip-move-btn');

    const finalLine = $('#final-line');

    const panels = {
        cards: $('#panel-cards'),
        cardQr: $('#panel-card-qr'),
        moveChoice: $('#panel-move-choice'),
        selectMarble: $('#panel-select-marble'),
        question: $('#panel-question'),
        result: $('#panel-result'),
        finished: $('#panel-finished')
    };

    // ---------- STATE ----------
    let lastTurnNumber = null;
    let lastRound = null;
    let currentHandRound = null;
    let question = null;
    let timerId = null;
    let pollId = null;
    let qrPollId = null;
    let finished = false;
    let currentCard = null;
    let pendingQuestionData = null;
    let lastResult = null;
    let moveMode = null;
    let teamBoardMap = {};
    let piecesData = [];
    let initialAttemptId = 0;

    // Load and render the 5 random cards dealt for the current round
    async function loadPlayerHand(roundNumber) {
        currentHandRound = roundNumber;
        const res = await FJ.sendJson('GET', '/api/game/sessions/' + sessionId + '/hand');
        if (res.ok && res.data && Array.isArray(res.data.hand)) {
            renderPlayerHand(res.data.hand);
        }
    }

    function renderPlayerHand(handCards) {
        if (!cardButtonsBox) return;
        cardButtonsBox.innerHTML = '';

        handCards.forEach(function (card) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'card-pick-btn';
            btn.dataset.cardId = card.card_id;
            btn.dataset.cardName = card.card_name;
            btn.dataset.handIndex = card.hand_index;

            const img = document.createElement('img');
            img.src = card.image || '/images/cards/card-back.svg';
            img.alt = card.card_name;
            img.width = 72;
            img.height = 100;

            const name = document.createElement('span');
            name.className = 'card-pick-name';
            name.textContent = card.card_name;

            const effect = document.createElement('span');
            effect.className = 'card-pick-effect';
            effect.textContent = card.card_effect;

            const scan = document.createElement('span');
            scan.className = 'card-scan-label';
            scan.textContent = 'SCAN TO UNLOCK';

            btn.append(img, name, effect, scan);
            cardButtonsBox.appendChild(btn);
        });
    }

    function showPanel(name) {
        Object.keys(panels).forEach(function (key) {
            if (panels[key]) {
                panels[key].hidden = (key !== name);
            }
        });
    }

    function clearMessage() {
        if (gameMessage) {
            gameMessage.hidden = true;
        }
    }

    // ---------- BOARD RENDERING ----------
    function renderBoard() {
        if (!boardEl) return;
        
        // Remove only spaces, bases, and slots (preserve center medallion)
        const toRemove = boardEl.querySelectorAll('.space, .home-base, .home-slot, .marble');
        toRemove.forEach(function (el) { el.remove(); });

        const defaultColours = ['red', 'blue', 'green', 'yellow'];

        // 1. Home Base Diamonds & Sockets (4 corners)
        for (let t = 0; t < 4; t++) {
            const area = HOME_BASE_AREAS[t];
            const homeBase = document.createElement('div');
            homeBase.className = 'home-base';
            homeBase.dataset.teamIndex = t;
            homeBase.dataset.teamColour = defaultColours[t];
            homeBase.style.left = (area.centerCol / 14 * 100).toFixed(4) + '%';
            homeBase.style.top = (area.centerRow / 14 * 100).toFixed(4) + '%';
            homeBase.style.backgroundColor = getRgbaColour(defaultColours[t], 0.25);
            homeBase.style.borderColor = getRgbaColour(defaultColours[t], 0.6);
            boardEl.appendChild(homeBase);

            // 4 Sockets per corner base (matching Image 1)
            for (let s = 0; s < 4; s++) {
                const coord = HOME_COORDS[t][s];
                const slot = document.createElement('div');
                slot.className = 'home-slot';
                slot.dataset.teamIndex = t;
                slot.dataset.slotIndex = s;
                const pos = gridToPercent(coord[0], coord[1]);
                slot.style.left = pos.left;
                slot.style.top = pos.top;
                boardEl.appendChild(slot);
            }
        }

        // 2. 52 Track Spaces (continuous perimeter loop)
        for (let i = 0; i < 52; i++) {
            const coord = TRACK_COORDS[i];
            const space = document.createElement('div');
            const isEntry = ENTRY_POINTS.includes(i);
            space.className = 'space' + (isEntry ? ' entry-space' : '');
            space.dataset.index = i;

            // Directional indicators on turn caps (matching Image 3)
            if (i === 1) space.title = 'Track: move left <--';
            else if (i === 14) space.title = 'Track: move up ^';
            else if (i === 27) space.title = 'Track: move right -->';
            else if (i === 40) space.title = 'Track: move down v';

            if (isEntry) {
                space.title = 'Protected Base Entry Spot';
            }

            const pos = gridToPercent(coord[0], coord[1]);
            space.style.left = pos.left;
            space.style.top = pos.top;
            boardEl.appendChild(space);
        }

        // 3. Queue Spaces (4 seats x 4 slots, heading inward - matching Image 3)
        for (let t = 0; t < 4; t++) {
            const colour = defaultColours[t];
            for (let q = 0; q < 4; q++) {
                const coord = QUEUE_COORDS[t][q];
                const qSpace = document.createElement('div');
                qSpace.className = 'space queue-space';
                qSpace.dataset.teamIndex = t;
                qSpace.dataset.seatIndex = t;
                qSpace.dataset.team = colour;
                qSpace.dataset.teamColour = colour;
                qSpace.dataset.queueSlot = q + 1;
                const pos = gridToPercent(coord[0], coord[1]);
                qSpace.style.left = pos.left;
                qSpace.style.top = pos.top;
                boardEl.appendChild(qSpace);
            }
        }
    }

    function applyTeamColoursToBoard(teams) {
        // Bases have their authentic distinct colours: Red, Blue, Green, Yellow
    }

    // ---------- POSITION CALCULATIONS ----------
    function getPositionForPiece(piece) {
        const seatIndex = piece.seat_index !== undefined ? piece.seat_index : (teamBoardMap[piece.team_id] ?? 0);
        const pType = String(piece.position_type || '').toLowerCase();

        // 1. In corner diamond base ("square that contains the balls")
        if (pType === 'home') {
            const slotIdx = Math.max(0, Math.min(3, ((Number(piece.piece_number) || 1) - 1) % 4));
            const coord = (HOME_COORDS[seatIndex] && HOME_COORDS[seatIndex][slotIdx]) || HOME_COORDS[0][0];
            return gridToPercent(coord[0], coord[1]);
        }

        // 2. In queue / row heading into center
        if (pType === 'queue') {
            const qSlot = Math.max(0, Math.min(3, (Number(piece.position_index) || 1) - 1));
            const coord = (QUEUE_COORDS[seatIndex] && QUEUE_COORDS[seatIndex][qSlot]) || QUEUE_COORDS[0][0];
            return gridToPercent(coord[0], coord[1]);
        }

        // 3. On 52 track spaces
        const trackIdx = Math.max(0, Number(piece.position_index) || 0) % 52;
        const coord = TRACK_COORDS[trackIdx] || TRACK_COORDS[0];
        return gridToPercent(coord[0], coord[1]);
    }

    // ---------- UPDATING PIECES WITH ANIMATION ----------
    function updatePieces(pieces) {
        if (!Array.isArray(pieces) || !boardEl) return;
        piecesData = pieces;

        const seenIds = new Set();

        pieces.forEach(function (piece) {
            seenIds.add(piece.piece_id);
            let marble = boardEl.querySelector('.marble[data-piece-id="' + piece.piece_id + '"]');
            const colour = String(piece.seat_colour || piece.team_colour || 'red').toLowerCase();

            if (!marble) {
                marble = document.createElement('div');
                marble.className = 'marble';
                marble.dataset.pieceId = piece.piece_id;
                marble.dataset.teamId = piece.team_id;
                marble.dataset.seatIndex = piece.seat_index ?? 0;
                marble.dataset.colour = colour;
                marble.title = (piece.team_name || 'Team') + ' piece #' + piece.piece_number;

                marble.addEventListener('click', function () {
                    onMarbleClick(piece.piece_id);
                });
                boardEl.appendChild(marble);
            } else {
                marble.dataset.colour = colour;
                marble.dataset.teamId = piece.team_id;
                if (piece.seat_index !== undefined) {
                    marble.dataset.seatIndex = piece.seat_index;
                }
            }

            const pos = getPositionForPiece(piece);
            if (pos) {
                marble.style.left = pos.left;
                marble.style.top = pos.top;
            }
        });

        // Clean up removed pieces
        const existingMarbles = boardEl.querySelectorAll('.marble');
        existingMarbles.forEach(function (m) {
            const id = Number(m.dataset.pieceId);
            if (!seenIds.has(id)) {
                m.remove();
            }
        });

        if (moveMode) {
            highlightMarbles(moveMode);
        }
    }

    // ---------- MARBLE HIGHLIGHTING ----------
    function clearHighlights() {
        if (!boardEl) return;
        const marbles = boardEl.querySelectorAll('.marble');
        marbles.forEach(function (m) {
            m.classList.remove('selectable');
        });
    }

    // Check if moving piece's path would cross or land on a protected Base Entry space
    // "when the ball stope in the places that I put arror the player whostoping canot move until put joker or wating for blue to move"
    function isPathBlockedByBaseEntry(piece, spaces, isJoker) {
        if (isJoker || spaces <= 0 || piece.position_type !== 'track') return false;

        const blockedEntries = new Set();
        piecesData.forEach(function (p) {
            if (p.position_type === 'track') {
                const pSeat = p.seat_index ?? 0;
                const baseEntry = SEAT_ENTRY[pSeat];
                if (p.position_index === baseEntry && p.piece_id !== piece.piece_id) {
                    blockedEntries.add(baseEntry);
                }
            }
        });

        for (let s = 1; s <= spaces; s++) {
            const checkIndex = (piece.position_index + s) % 52;
            if (blockedEntries.has(checkIndex)) {
                return true;
            }
        }
        return false;
    }

    function highlightMarbles(mode) {
        clearHighlights();
        if (!mode || !boardEl) return;

        let validPieceIds = [];

        if (mode.action === 'enter') {
            // Own team marbles at home
            validPieceIds = piecesData
                .filter(function (p) {
                    return p.team_id === myTeamId && p.position_type === 'home';
                })
                .map(function (p) { return p.piece_id; });
        } else if (mode.action === 'move') {
            // Own team marbles on track or in queue
            const isJoker = (currentCard && currentCard.name && currentCard.name.toLowerCase() === 'joker');
            validPieceIds = piecesData
                .filter(function (p) {
                    if (p.team_id !== myTeamId) return false;
                    if (p.position_type !== 'track' && p.position_type !== 'queue') return false;
                    if (p.position_type === 'track' && isPathBlockedByBaseEntry(p, mode.spaces, isJoker)) {
                        return false;
                    }
                    return true;
                })
                .map(function (p) { return p.piece_id; });
        } else if (mode.action === 'swap') {
            if (!mode.selectedOwn) {
                validPieceIds = piecesData
                    .filter(function (p) {
                        return p.team_id === myTeamId && p.position_type === 'track';
                    })
                    .map(function (p) { return p.piece_id; });
            } else {
                validPieceIds = piecesData
                    .filter(function (p) {
                        return p.team_id !== myTeamId && p.position_type === 'track';
                    })
                    .map(function (p) { return p.piece_id; });
            }
        }

        validPieceIds.forEach(function (id) {
            const marble = boardEl.querySelector('.marble[data-piece-id="' + id + '"]');
            if (marble) {
                marble.classList.add('selectable');
            }
        });

        if (validPieceIds.length === 0 && selectMarbleHint) {
            selectMarbleHint.textContent = 'No eligible marbles available for this move (or path is blocked by base entry).';
        }
    }

    function highlightOpponentMarbles() {
        clearHighlights();
        if (selectMarbleTitle) selectMarbleTitle.textContent = 'Swap marbles (Step 2/2)';
        if (selectMarbleHint) selectMarbleHint.textContent = 'Now click an opponent track marble to swap with';

        const opponentPieceIds = piecesData
            .filter(function (p) {
                return p.team_id !== myTeamId && p.position_type === 'track';
            })
            .map(function (p) { return p.piece_id; });

        opponentPieceIds.forEach(function (id) {
            const marble = boardEl.querySelector('.marble[data-piece-id="' + id + '"]');
            if (marble) {
                marble.classList.add('selectable');
            }
        });

        if (opponentPieceIds.length === 0 && selectMarbleHint) {
            selectMarbleHint.textContent = 'No opponent marbles on track to swap with.';
        }
    }

    // Auto-discard and pass turn
    async function autoDiscardAndPass(reason) {
        FJ.showMessage(gameMessage, reason, 'info');
        logActivity(reason);
        const firstBtn = cardButtonsBox ? cardButtonsBox.querySelector('.card-pick-btn') : null;
        const cardId = currentCard ? currentCard.id : (firstBtn ? Number(firstBtn.dataset.cardId) : null);
        const cardName = currentCard ? currentCard.name : (firstBtn ? firstBtn.dataset.cardName : "");

        await FJ.sendJson('POST', '/api/game/sessions/' + sessionId + '/pieces/move', {
            action: 'discard',
            card_id: cardId,
            card_name: cardName
        });

        currentCard = null;
        lastResult = null;
        moveMode = null;
        if (centerCardImg) centerCardImg.hidden = true;
        if (centerBrand) centerBrand.hidden = false;
        showPanel('cards');
        refresh();
    }

    // ---------- MOVE FLOW ----------
    function startMoveFlow() {
        clearMessage();
        if (!lastResult) return;

        const cardName = (currentCard && currentCard.name) || (lastResult && lastResult.card_name) || '';
        const norm = cardName.trim().toLowerCase();
        const canExit = ['ace', 'king'].includes(norm);

        const myMarbles = piecesData.filter(function (p) { return p.team_id === myTeamId; });
        const hasTrackOrQueue = myMarbles.some(function (p) { return p.position_type === 'track' || p.position_type === 'queue'; });

        // If all marbles are still in home base, only Ace or King can exit!
        if (!hasTrackOrQueue && !canExit) {
            autoDiscardAndPass('All your marbles are at home! ' + cardName + ' cannot exit from home. Card is discarded and turn passes.');
            return;
        }

        if (!lastResult.is_correct) {
            // Basic move: 1 forward, but CANNOT exit from home
            if (!hasTrackOrQueue) {
                autoDiscardAndPass('Basic move cannot exit from home base. Card is discarded and turn passes.');
                return;
            }
            enterMoveMode('move', 1);
            return;
        }

        // If player has marbles ONLY at home, and has an exit card, automatically enter move mode so home balls glow!
        if (!hasTrackOrQueue && canExit) {
            enterMoveMode('enter', 0);
            return;
        }

        if (norm === 'ace') {
            showMoveChoices([
                { label: 'Enter marble from Home to Base', action: 'enter', spaces: 0 },
                { label: 'Move 1 space forward', action: 'move', spaces: 1 },
                { label: 'Move 11 spaces forward', action: 'move', spaces: 11 }
            ]);
        } else if (norm === 'king') {
            // King: ONLY moves from Home to Base
            enterMoveMode('enter', 0);
        } else if (norm === 'jack') {
            enterSwapMode();
        } else if (norm === '7') {
            showMoveChoices([
                { label: 'Move 7 spaces forward', action: 'move', spaces: 7 },
                { label: 'Split 7: Move 4 forward (Step 1)', action: 'move', spaces: 4 },
                { label: 'Split 7: Move 3 forward (Step 1)', action: 'move', spaces: 3 }
            ]);
        } else if (norm === '4') {
            enterMoveMode('move', -4);
        } else if (norm === 'queen') {
            enterMoveMode('move', 12);
        } else {
            const spaces = Number(norm);
            enterMoveMode('move', !isNaN(spaces) && spaces > 0 ? spaces : 1);
        }
    }

    function showMoveChoices(choices) {
        if (!moveChoicesBox) return;
        moveChoicesBox.innerHTML = '';
        if (moveActionText) {
            moveActionText.textContent = 'Select which action you want to take with your card power:';
        }

        choices.forEach(function (choice) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'move-choice-btn';
            btn.textContent = choice.label;
            btn.addEventListener('click', function () {
                enterMoveMode(choice.action, choice.spaces);
            });
            moveChoicesBox.appendChild(btn);
        });

        showPanel('moveChoice');
    }

    function enterSwapMode() {
        moveMode = { action: 'swap', spaces: 0, selectedOwn: null };
        if (selectMarbleTitle) selectMarbleTitle.textContent = 'Swap marbles (Step 1/2)';
        if (selectMarbleHint) selectMarbleHint.textContent = 'Click one of your own track marbles to swap';
        showPanel('selectMarble');
        highlightMarbles(moveMode);
    }

    function enterMoveMode(action, spaces) {
        moveMode = { action: action, spaces: spaces, selectedOwn: null };

        if (selectMarbleTitle) {
            if (action === 'enter') {
                selectMarbleTitle.textContent = 'Enter marble onto the track';
                if (selectMarbleHint) selectMarbleHint.textContent = 'Click a marble from your home base to place on the entry space';
            } else if (spaces < 0) {
                selectMarbleTitle.textContent = 'Move marble backward ' + Math.abs(spaces) + ' spaces';
                if (selectMarbleHint) selectMarbleHint.textContent = 'Click a marble on the track to move backward';
            } else {
                selectMarbleTitle.textContent = 'Move marble forward ' + spaces + ' space' + (spaces === 1 ? '' : 's');
                if (selectMarbleHint) selectMarbleHint.textContent = 'Click a marble on the track to advance';
            }
        }

        showPanel('selectMarble');
        highlightMarbles(moveMode);
    }

    async function onMarbleClick(pieceId) {
        if (!moveMode) return;

        const piece = piecesData.find(function (p) { return p.piece_id === pieceId; });
        if (!piece) return;

        // If swap, first click selects own, second selects opponent
        if (moveMode.action === 'swap' && !moveMode.selectedOwn) {
            if (piece.team_id !== myTeamId || piece.position_type !== 'track') return;
            moveMode.selectedOwn = pieceId;
            highlightOpponentMarbles();
            return;
        }

        if (moveMode.action === 'swap' && moveMode.selectedOwn) {
            if (piece.team_id === myTeamId || piece.position_type !== 'track') return;
        }

        // Validate own piece for normal enter/move
        if (moveMode.action !== 'swap') {
            if (piece.team_id !== myTeamId) return;
            if (moveMode.action === 'enter' && piece.position_type !== 'home') return;
            if (moveMode.action === 'move' && piece.position_type !== 'track' && piece.position_type !== 'queue') return;

            // Check if path is blocked by an occupied Base Entry
            if (moveMode.action === 'move' && piece.position_type === 'track') {
                const isJoker = (currentCard && currentCard.name && currentCard.name.toLowerCase() === 'joker');
                if (isPathBlockedByBaseEntry(piece, moveMode.spaces, isJoker)) {
                    FJ.showMessage(gameMessage, 'Movement blocked: A marble is protecting its base entry spot. You cannot pass until a Joker is played or that marble moves.', 'error');
                    FJ.playSound('wrong');
                    return;
                }
            }
        }

        const cardName = (currentCard && currentCard.name) || (lastResult && lastResult.card_name) || '';
        const cardId = (currentCard && currentCard.id) || null;
        const body = {
            piece_id: moveMode.action === 'swap' ? moveMode.selectedOwn : pieceId,
            action: moveMode.action,
            spaces: moveMode.spaces || 0,
            card_id: cardId,
            card_name: cardName
        };

        if (moveMode.action === 'swap') {
            body.target_piece_id = pieceId;
        }

        clearHighlights();
        clearMessage();

        const result = await FJ.sendJson('POST', '/api/game/sessions/' + sessionId + '/pieces/move', body);

        if (result.ok) {
            if (result.data && result.data.pieces) {
                updatePieces(result.data.pieces);
            }
            logActivity((piece.team_name || 'Team') + ' moved ' + (moveMode.action === 'enter' ? 'onto board' : moveMode.spaces + ' spaces'));
            if (result.data && result.data.won) {
                const infoRes = await FJ.sendJson('GET', '/api/sessions/' + sessionId);
                showFinished(infoRes.ok && infoRes.data ? infoRes.data.teams : []);
                return;
            }
            FJ.playSound('correct');
            if (result.data && result.data.message) {
                FJ.showMessage(gameMessage, result.data.message, 'success');
            }
        } else {
            FJ.showMessage(gameMessage, (result.data && result.data.message) || 'Move failed', 'error');
            FJ.playSound('wrong');
        }

        currentCard = null;
        lastResult = null;
        moveMode = null;
        if (centerCardImg) centerCardImg.hidden = true;
        if (centerBrand) centerBrand.hidden = false;
        showPanel('cards');
        refresh();
    }

    // ---------- CARD SELECTION & QR CODE FLOW ----------
    async function onCardSelected(cardId, cardName) {
        currentCard = { id: cardId, name: cardName };
        clearMessage();

        // 1. Place card face in the center of the Jackaroo board (like physical game)
        const clickedCardBtn = cardButtonsBox ? cardButtonsBox.querySelector('[data-card-id="' + cardId + '"]') : null;
        const cardImg = clickedCardBtn ? clickedCardBtn.querySelector('img') : null;
        if (cardImg && centerCardImg) {
            centerCardImg.src = cardImg.src;
            centerCardImg.hidden = false;
            if (centerBrand) centerBrand.hidden = true;
        }

        if (clickedCardBtn) {
            clickedCardBtn.disabled = true;
            clickedCardBtn.style.opacity = '0.35';
        }

        // 2. Query current latest attempt to prevent triggering on old attempts
        try {
            const prevRes = await FJ.sendJson('GET', '/api/game/sessions/' + sessionId + '/latest-attempt?since=0');
            if (prevRes.ok && prevRes.data && prevRes.data.attempt) {
                initialAttemptId = prevRes.data.attempt.attempt_id;
            } else {
                initialAttemptId = 0;
            }
        } catch (e) {
            initialAttemptId = 0;
        }

        // 3. Fetch QR code from server
        const qrRes = await FJ.sendJson('GET', '/api/game/card-qr/' + cardId + '?session_id=' + sessionId + '&team_id=' + myTeamId);

        // Preload question in case user clicks "Answer on this screen"
        FJ.sendJson('GET', '/api/questions/by-card/' + cardId).then(function (res) {
            if (res.ok) pendingQuestionData = res.data;
        });

        if (qrRes.ok && qrRes.data) {
            if (qrCodeImg) qrCodeImg.src = qrRes.data.qr_data_url;
            if (qrCardName) qrCardName.textContent = qrRes.data.card_name;
            if (qrCardEffect) qrCardEffect.textContent = qrRes.data.card_effect;
            if (qrCardImg && cardImg) qrCardImg.src = cardImg.src;

            showPanel('cardQr');
            startQrPolling();
        } else {
            // Fallback to desktop question if QR fails
            const result = await FJ.sendJson('GET', '/api/questions/by-card/' + cardId);
            if (result.ok) {
                beginQuestion(result.data);
            }
        }
    }

    function stopQrPolling() {
        if (qrPollId !== null) {
            clearInterval(qrPollId);
            qrPollId = null;
        }
    }

    function startQrPolling() {
        stopQrPolling();

        qrPollId = setInterval(async function () {
            const res = await FJ.sendJson('GET', '/api/game/sessions/' + sessionId + '/latest-attempt?since=' + initialAttemptId);
            if (res.ok && res.data && res.data.attempt) {
                const att = res.data.attempt;
                initialAttemptId = att.attempt_id;
                stopQrPolling();
                showResult({
                    is_correct: att.is_correct,
                    points_awarded: att.points_awarded,
                    team_score: att.team_score,
                    card_action: att.card_action,
                    card_name: att.card_name,
                    correct_option: null,
                    explanation: null
                });
            }
        }, 1200);
    }

    // ---------- QUESTION & TIMER (DESKTOP) ----------
    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const rest = seconds % 60;
        return String(minutes).padStart(2, '0') + ':' + String(rest).padStart(2, '0');
    }

    function secondsLeft() {
        const used = Math.floor((Date.now() - question.startedAt) / 1000);
        return Math.max(0, question.limit - used);
    }

    function stopTimer() {
        if (timerId !== null) {
            clearInterval(timerId);
            timerId = null;
        }
    }

    function tickTimer() {
        if (!question || question.done) return;
        const left = secondsLeft();

        if (left !== question.lastLeft) {
            question.lastLeft = left;
            if (timerText) timerText.textContent = formatTime(left);
            if (timerBox) timerBox.classList.toggle('warning', left <= 5);
            if (left > 0 && left <= 5) FJ.playSound('tick');
        }

        if (left <= 0) {
            sendAnswer(true);
        }
    }

    function beginQuestion(data) {
        stopQrPolling();
        const text = String(data.question.question_text || '');
        const parts = text.split('\n\n');

        question = {
            id: data.question.question_id,
            startedAt: Date.now(),
            limit: questionSeconds,
            lastLeft: null,
            done: false
        };

        if (cardDetected) {
            cardDetected.textContent = 'Card: ' + data.card.card_name + ' - ' + data.card.card_effect;
        }
        if (questionTitle) questionTitle.textContent = parts[0];
        if (questionCode) {
            questionCode.textContent = parts.slice(1).join('\n\n');
            questionCode.hidden = parts.length < 2;
        }

        if (optionsBox) {
            optionsBox.innerHTML = '';
            data.question.options.forEach(function (option) {
                const label = document.createElement('label');
                label.className = 'option';
                const input = document.createElement('input');
                input.type = 'radio';
                input.name = 'option';
                input.value = option.option_id;
                const badge = document.createElement('span');
                badge.className = 'option-badge';
                badge.textContent = option.option_label;
                const words = document.createElement('span');
                words.className = 'option-text';
                words.textContent = option.option_text;

                label.append(input, badge, words);
                optionsBox.append(label);
            });
        }

        if (submitButton) submitButton.disabled = true;
        showPanel('question');
        tickTimer();
        timerId = setInterval(tickTimer, 250);
    }

    async function sendAnswer(timedOut) {
        if (!question || question.done) return;
        question.done = true;
        stopTimer();
        if (submitButton) submitButton.disabled = true;

        const body = {
            session_id: sessionId,
            question_id: question.id,
            response_seconds: Math.min(
                question.limit,
                Math.round((Date.now() - question.startedAt) / 1000)
            )
        };

        if (timedOut) {
            body.timed_out = true;
        } else if (answerForm) {
            const chosen = answerForm.querySelector('input[name="option"]:checked');
            body.selected_option_id = chosen ? Number(chosen.value) : null;
        }

        const result = await FJ.sendJson('POST', '/api/game/answers', body);
        question = null;

        if (!result.ok) {
            showPanel('cards');
            FJ.showMessage(gameMessage, (result.data && result.data.message) || 'Could not save the answer.', 'error');
            refresh();
            return;
        }

        showResult(result.data);
    }

    // ---------- RESULT DISPLAY ----------
    function showResult(data) {
        lastResult = data;
        const timedOut = data.timed_out === true;

        if (resultIcon) {
            resultIcon.src = data.is_correct ? '/images/icons/correct.svg' : '/images/icons/wrong.svg';
        }
        if (resultTitle) {
            resultTitle.textContent = data.is_correct ? 'Correct Answer!' : (timedOut ? 'Time is up' : 'Not quite');
        }
        if (resultAction) {
            resultAction.textContent = (data.is_correct
                ? 'Full card power unlocked: '
                : 'Card power reduced to basic move: ') + (data.card_action || 'Advance 1 space');
        }
        if (resultPoints) {
            resultPoints.textContent = data.is_correct ? '+' + data.points_awarded + ' points' : 'No points lost';
        }
        if (resultScore) {
            resultScore.textContent = 'Team score: ' + (data.team_score ?? '');
        }

        if (resultAnswer) {
            resultAnswer.hidden = data.is_correct || !data.correct_option;
            if (!resultAnswer.hidden && data.correct_option) {
                resultAnswer.textContent = 'Correct answer: ' + data.correct_option.option_label + ') ' + data.correct_option.option_text;
            }
        }

        if (resultExplanation) {
            resultExplanation.hidden = !data.explanation;
            resultExplanation.textContent = data.explanation || '';
        }

        if (panels.result) {
            panels.result.classList.toggle('result-correct', data.is_correct);
            panels.result.classList.toggle('result-wrong', !data.is_correct);
        }

        FJ.playSound(data.is_correct ? 'correct' : (timedOut ? 'timeup' : 'wrong'));
        showPanel('result');
        startMoveFlow();
        refresh();
    }

    // ---------- TURNS & LEADERBOARD ----------
    function logActivity(text) {
        const list = $('#activity-list');
        if (!list) return;
        const item = document.createElement('li');
        item.className = 'activity-item';
        item.textContent = text;
        list.prepend(item);
        if (list.children.length > 6) {
            list.lastElementChild.remove();
        }
    }

    function updateScores(teams) {
        if (!Array.isArray(teams)) return;
        teams.forEach(function (team) {
            const scoreEls = document.querySelectorAll('[data-team-id="' + team.team_id + '"] [data-score], .score-team[data-team-id="' + team.team_id + '"] [data-score]');
            scoreEls.forEach(function (el) {
                el.textContent = team.current_score;
            });
        });
    }

    // Check if the current player has any valid moves available
    // Returns true if the player can make at least one move, false otherwise
    function hasValidMoves() {
        const myMarbles = piecesData.filter(function (p) { return p.team_id === myTeamId; });
        
        // Check if any marbles are on track or queue (can move with any card)
        const hasTrackOrQueue = myMarbles.some(function (p) { 
            return p.position_type === 'track' || p.position_type === 'queue'; 
        });
        
        if (hasTrackOrQueue) {
            // Player has marbles on the board - can make moves with any card
            return true;
        }
        
        // All marbles are at home - need Ace or King to exit
        const cardBtns = cardButtonsBox ? cardButtonsBox.querySelectorAll('.card-pick-btn') : [];
        for (let i = 0; i < cardBtns.length; i++) {
            const cardName = (cardBtns[i].dataset.cardName || '').toLowerCase().trim();
            if (cardName === 'ace' || cardName === 'king') {
                return true; // Has an exit card
            }
        }
        
        // No marbles on track/queue and no exit cards - cannot make any valid move
        return false;
    }

    // Auto-skip turn if player cannot make any valid move
    async function checkAndAutoSkipTurn(isMyTurn) {
        if (!isMyTurn) return;
        
        // Wait a brief moment for the UI to settle
        await new Promise(function (resolve) { setTimeout(resolve, 600); });
        
        if (!hasValidMoves()) {
            // Player has no valid moves - auto-discard and pass their turn per Jackaroo rules
            autoDiscardAndPass('No cards in hand can exit from home. Card is discarded and turn passed automatically.');
        }
    }

    function updateTurn(state) {
        const current = state.current_player;
        const isMyTeam = !!current && current.team_id === myTeamId;
        const isMe = !!current && current.user_id === myUserId;

        if (roundInfo) {
            roundInfo.textContent = 'Round ' + state.round_number + ' • Turn ' + state.turn_number;
        }

        // Deal / refresh cards when round or turn changes
        if (state.round_number !== lastRound || state.turn_number !== lastTurnNumber) {
            loadPlayerHand(state.round_number);
        }

        const sidebarPlayer = $('#sidebar-player-name');
        if (sidebarPlayer) {
            if (!current) {
                sidebarPlayer.textContent = 'Waiting...';
            } else {
                sidebarPlayer.textContent = current.full_name + ' • ' + (current.team_name || 'Team');
            }
        }

        if (banner) {
            if (!current) {
                banner.textContent = 'Waiting for the next turn...';
            } else if (isMe) {
                banner.textContent = 'Your turn!';
            } else if (isMyTeam) {
                banner.textContent = current.full_name + '\'s turn (your team)';
            } else {
                banner.textContent = current.full_name + '\'s turn (' + current.team_name + ')';
            }
            banner.classList.toggle('mine', isMe);
        }

        // Enable card buttons ONLY when it is THIS player's turn! (Prevents answering on other players' turns)
        if (cardButtonsBox) {
            const cardBtns = cardButtonsBox.querySelectorAll('.card-pick-btn');
            cardBtns.forEach(function (btn) {
                btn.disabled = !isMe;
            });
        }

        const btnScan = $('#btn-scan-card');
        if (btnScan) {
            btnScan.disabled = !isMe;
        }

        const btnDiscard = $('#btn-discard-card');
        if (btnDiscard) {
            btnDiscard.hidden = !isMe || hasValidMoves();
        }

        if (endTurnButton) {
            endTurnButton.hidden = true; // Turn ends automatically after card play
        }

        if (turnHint) {
            turnHint.textContent = isMe ? 'Choose a card from your hand to play.' : (current ? 'Waiting for ' + current.full_name + ' to play.' : 'Waiting for turn...');
        }

        if (orderList) {
            orderList.innerHTML = '';
            (state.order || []).forEach(function (entry) {
                const item = document.createElement('li');
                const name = document.createElement('span');
                const mark = document.createElement('span');
                const isNow = !entry.played && !!current && entry.user_id === current.user_id;

                item.dataset.colour = String(entry.team_colour).toLowerCase();
                item.classList.toggle('played', entry.played);
                item.classList.toggle('now', isNow);

                name.textContent = entry.full_name + (entry.user_id === myUserId ? ' (you)' : '');
                mark.className = 'order-mark';
                mark.textContent = entry.played ? 'played' : (isNow ? 'playing now' : 'waiting');

                item.append(name, mark);
                orderList.append(item);
            });
        }

        if (lastTurnNumber !== null && state.turn_number !== lastTurnNumber) {
            if (state.round_number !== lastRound) {
                FJ.playSound('round');
            } else if (isMe) {
                FJ.playSound('turn');
            }
        }

        lastTurnNumber = state.turn_number;
        lastRound = state.round_number;
        
        // Auto-skip turn if player has no valid moves (per Jackaroo rules)
        if (isMe) {
            checkAndAutoSkipTurn(true);
        }
    }

    function showFinished(teams) {
        finished = true;
        clearInterval(pollId);
        stopQrPolling();
        stopTimer();

        const sorted = (teams || []).slice().sort(function (a, b) {
            return b.current_score - a.current_score;
        });
        const tie = sorted.length > 1 && sorted[0].current_score === sorted[1].current_score;
        const scores = sorted.map(function (team) {
            return team.team_name + ': ' + team.current_score;
        }).join('  |  ');

        if (finalLine) {
            finalLine.textContent = (tie ? 'It is a tie!' : sorted[0].team_name + ' wins the game!') + '  ' + scores;
        }
        if (banner) {
            banner.textContent = 'Game finished';
            banner.classList.remove('mine');
        }
        showPanel('finished');
    }

    async function refresh() {
        if (finished) return;

        const answers = await Promise.all([
            FJ.sendJson('GET', '/api/game/sessions/' + sessionId + '/turn'),
            FJ.sendJson('GET', '/api/sessions/' + sessionId),
            FJ.sendJson('GET', '/api/game/sessions/' + sessionId + '/pieces')
        ]);

        const turn = answers[0];
        const info = answers[1];
        const pieces = answers[2];

        if (info.ok && info.data) {
            updateScores(info.data.teams);
            (info.data.teams || []).forEach(function (t, i) {
                teamBoardMap[t.team_id] = i;
            });
            applyTeamColoursToBoard(info.data.teams);

            if (info.data.session && info.data.session.status === 'finished') {
                showFinished(info.data.teams);
                return;
            }
        }

        if (turn.ok && turn.data) {
            updateTurn(turn.data);
        }

        if (pieces.ok && pieces.data) {
            updatePieces(pieces.data.pieces || pieces.data);
        }
    }

    // ---------- EVENT LISTENERS ----------
    if (cardButtonsBox) {
        cardButtonsBox.addEventListener('click', function (e) {
            const btn = e.target.closest('.card-pick-btn');
            if (btn && !btn.disabled) {
                const cardId = Number(btn.dataset.cardId);
                const cardName = btn.dataset.cardName;
                onCardSelected(cardId, cardName);
            }
        });
    }

    const btnScanCard = $('#btn-scan-card');
    if (btnScanCard) {
        btnScanCard.addEventListener('click', function () {
            const enabledBtn = cardButtonsBox ? cardButtonsBox.querySelector('.card-pick-btn:not(:disabled)') : null;
            if (enabledBtn) {
                const cardId = Number(enabledBtn.dataset.cardId);
                const cardName = enabledBtn.dataset.cardName;
                onCardSelected(cardId, cardName);
            } else {
                FJ.showMessage(gameMessage, 'Please select a card from your hand or wait for your turn to scan.', 'info');
            }
        });
    }

    if (btnAnswerDesktop) {
        btnAnswerDesktop.addEventListener('click', function () {
            stopQrPolling();
            if (pendingQuestionData) {
                beginQuestion(pendingQuestionData);
            } else if (currentCard) {
                FJ.sendJson('GET', '/api/questions/by-card/' + currentCard.id).then(function (res) {
                    if (res.ok) beginQuestion(res.data);
                });
            }
        });
    }

    if (btnCancelQr) {
        btnCancelQr.addEventListener('click', function () {
            stopQrPolling();
            if (centerCardImg) centerCardImg.hidden = true;
            if (centerBrand) centerBrand.hidden = false;
            showPanel('cards');
            refresh();
        });
    }

    if (optionsBox) {
        optionsBox.addEventListener('change', function () {
            if (submitButton) submitButton.disabled = false;
        });
    }

    if (answerForm) {
        answerForm.addEventListener('submit', function (event) {
            event.preventDefault();
            sendAnswer(false);
        });
    }

    if (moveMarbleBtn) {
        moveMarbleBtn.addEventListener('click', function () {
            startMoveFlow();
        });
    }

    if (skipMoveBtn) {
        skipMoveBtn.addEventListener('click', function () {
            autoDiscardAndPass('Move skipped. Card discarded and turn passed.');
        });
    }

    const btnDiscardCard = $('#btn-discard-card');
    if (btnDiscardCard) {
        btnDiscardCard.addEventListener('click', function () {
            autoDiscardAndPass('Card discarded and turn passed.');
        });
    }

    if (cancelMoveChoice) {
        cancelMoveChoice.addEventListener('click', function () {
            showPanel('result');
        });
    }

    if (cancelSelect) {
        cancelSelect.addEventListener('click', function () {
            clearHighlights();
            moveMode = null;
            showPanel('result');
        });
    }

    if (endTurnButton) {
        endTurnButton.addEventListener('click', async function () {
            endTurnButton.disabled = true;
            clearMessage();
            if (centerCardImg) centerCardImg.hidden = true;
            if (centerBrand) centerBrand.hidden = false;

            const result = await FJ.sendJson('POST', '/api/game/sessions/' + sessionId + '/turn/end');
            endTurnButton.disabled = false;

            if (!result.ok) {
                FJ.showMessage(gameMessage, (result.data && result.data.message) || 'Could not end the turn.', 'error');
                refresh();
                return;
            }

            if (result.data.round_complete) {
                FJ.showMessage(gameMessage, 'Round complete! A new round starts with new turn order.', 'success');
            }

            updateTurn(result.data);
            refresh();
        });
    }

    // ---------- INITIALIZATION ----------
    renderBoard();
    refresh();
    pollId = setInterval(refresh, POLL_MS);
})();