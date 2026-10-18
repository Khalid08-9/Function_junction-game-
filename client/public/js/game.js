// The student's game room. It asks the server for the game state every 3 seconds
// (polling) and handles: scan a card -> question with timer -> result -> end turn.
(function () {
    const room = document.querySelector("#game-room");
    const sessionId = Number(room.dataset.sessionId);
    const myTeamId = Number(room.dataset.myTeamId);
    const myUserId = Number(room.dataset.myUserId);
    const POLL_MS = 3000;

    function $(selector) {
        return document.querySelector(selector);
    }

    const panels = {
        idle: $("#panel-idle"),
        scan: $("#panel-scan"),
        question: $("#panel-question"),
        result: $("#panel-result"),
        finished: $("#panel-finished")
    };

    const banner = $("#turn-banner");
    const roundInfo = $("#round-info");
    const gameMessage = $("#game-message");
    const scanButton = $("#scan-button");
    const endTurnButton = $("#end-turn-button");
    const turnHint = $("#turn-hint");
    const orderList = $("#order-list");
    const video = $("#scan-video");
    const canvas = $("#scan-canvas");
    const scanStatus = $("#scan-status");
    const scanError = $("#scan-error");
    const answerForm = $("#answer-form");
    const optionsBox = $("#options");
    const submitButton = $("#submit-answer");

    let lastTurnNumber = null;
    let lastRound = null;
    let question = null;      // the question that is on the screen
    let timerId = null;
    let pollId = null;
    let stream = null;        // the camera
    let scanning = false;
    let finished = false;

    function showPanel(name) {
        Object.keys(panels).forEach(function (key) {
            panels[key].hidden = key !== name;
        });
    }

    function clearMessage() {
        gameMessage.hidden = true;
    }

    /* ---------- Scores, turn and turn order (from the server) ---------- */

    function updateScores(teams) {
        teams.forEach(function (team) {
            const score = document.querySelector(
                '.score-team[data-team-id="' + team.team_id + '"] [data-score]'
            );

            if (score) {
                score.textContent = team.current_score;
            }
        });
    }

    function updateTurn(state) {
        const current = state.current_player;
        const isMyTeam = !!current && current.team_id === myTeamId;
        const isMe = !!current && current.user_id === myUserId;

        roundInfo.textContent = "Round " + state.round_number + " - turn " + state.turn_number;

        if (!current) {
            banner.textContent = "Waiting for the next turn...";
        } else if (isMe) {
            banner.textContent = "Your turn!";
        } else if (isMyTeam) {
            banner.textContent = current.full_name + "'s turn (your team can answer)";
        } else {
            banner.textContent = current.full_name + "'s turn (" + current.team_name + ")";
        }

        banner.classList.toggle("mine", isMyTeam);

        scanButton.disabled = !isMyTeam;
        endTurnButton.hidden = !isMe;
        turnHint.textContent = isMyTeam ? "" : "Waiting for your team's turn.";

        orderList.textContent = "";

        state.order.forEach(function (entry) {
            const item = document.createElement("li");
            const name = document.createElement("span");
            const mark = document.createElement("span");
            const isNow = !entry.played && !!current && entry.user_id === current.user_id;

            item.dataset.colour = String(entry.team_colour).toLowerCase();
            item.classList.toggle("played", entry.played);
            item.classList.toggle("now", isNow);

            name.textContent = entry.full_name + (entry.user_id === myUserId ? " (you)" : "");
            mark.className = "order-mark";
            mark.textContent = entry.played ? "played" : (isNow ? "playing now" : "waiting");

            item.append(name, mark);
            orderList.append(item);
        });

        // Sounds: a new round, or a new turn for my team
        if (lastTurnNumber !== null && state.turn_number !== lastTurnNumber) {
            if (state.round_number !== lastRound) {
                FJ.playSound("round");
            } else if (isMyTeam) {
                FJ.playSound("turn");
            }
        }

        lastTurnNumber = state.turn_number;
        lastRound = state.round_number;
    }

    function showFinished(teams) {
        finished = true;
        clearInterval(pollId);
        stopTimer();
        stopCamera();

        const sorted = teams.slice().sort(function (a, b) {
            return b.current_score - a.current_score;
        });
        const tie = sorted.length > 1 && sorted[0].current_score === sorted[1].current_score;
        const scores = sorted.map(function (team) {
            return team.team_name + ": " + team.current_score;
        }).join("  |  ");

        $("#final-line").textContent =
            (tie ? "It is a tie!" : sorted[0].team_name + " wins!") + "  " + scores;
        banner.textContent = "Game finished";
        banner.classList.remove("mine");
        showPanel("finished");
    }

    async function refresh() {
        if (finished) {
            return;
        }

        const answers = await Promise.all([
            FJ.sendJson("GET", "/api/game/sessions/" + sessionId + "/turn"),
            FJ.sendJson("GET", "/api/sessions/" + sessionId)
        ]);
        const turn = answers[0];
        const info = answers[1];

        if (info.ok) {
            updateScores(info.data.teams);

            if (info.data.session.status === "finished") {
                showFinished(info.data.teams);
                return;
            }
        }

        if (turn.ok) {
            updateTurn(turn.data);
        }
    }

    /* ---------- Scanning a card ---------- */

    function stopCamera() {
        scanning = false;

        if (stream) {
            stream.getTracks().forEach(function (track) {
                track.stop();
            });
            stream = null;
        }
    }

    function scanFrame() {
        if (!scanning) {
            return;
        }

        if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const context = canvas.getContext("2d", { willReadFrequently: true });
            context.drawImage(video, 0, 0, canvas.width, canvas.height);

            const picture = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = window.jsQR(picture.data, picture.width, picture.height);

            if (code && code.data) {
                loadQuestion(code.data);
                return;
            }
        }

        window.requestAnimationFrame(scanFrame);
    }

    async function startCamera() {
        const canUseCamera = navigator.mediaDevices &&
            navigator.mediaDevices.getUserMedia &&
            typeof window.jsQR === "function";

        if (!canUseCamera) {
            scanStatus.textContent =
                "Camera not available here. Type the card code below.";
            return;
        }

        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
                audio: false
            });
            video.srcObject = stream;
            await video.play();
            scanning = true;
            scanStatus.textContent = "Looking for a QR code...";
            window.requestAnimationFrame(scanFrame);
        } catch (error) {
            stopCamera();
            scanStatus.textContent =
                "Could not open the camera. Type the card code below.";
        }
    }

    function openScanner() {
        clearMessage();
        scanError.hidden = true;
        $("#card-code").value = "";
        showPanel("scan");
        startCamera();
    }

    function closeScanner() {
        stopCamera();
        showPanel("idle");
    }

    async function loadQuestion(token) {
        const code = String(token).trim();

        if (!code) {
            FJ.showMessage(scanError, "Scan a card or type its code.", "error");
            return;
        }

        stopCamera();
        scanError.hidden = true;

        const result = await FJ.sendJson(
            "GET",
            "/api/questions/by-token/" + encodeURIComponent(code)
        );

        if (!result.ok) {
            FJ.showMessage(
                scanError,
                (result.data && result.data.message) || "Could not load the question.",
                "error"
            );
            startCamera(); // let the student try again
            return;
        }

        beginQuestion(result.data);
    }

    /* ---------- The question and the timer ---------- */

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const rest = seconds % 60;

        return String(minutes).padStart(2, "0") + ":" + String(rest).padStart(2, "0");
    }

    function secondsLeft() {
        const used = Math.floor((Date.now() - question.startedAt) / 1000);

        return Math.max(0, question.limit - used);
    }

    function stopTimer() {
        clearInterval(timerId);
        timerId = null;
    }

    function tickTimer() {
        if (!question || question.done) {
            return;
        }

        const left = secondsLeft();

        if (left !== question.lastLeft) {
            question.lastLeft = left;
            $("#timer-text").textContent = formatTime(left);
            $("#timer").classList.toggle("warning", left <= 5);

            if (left > 0 && left <= 5) {
                FJ.playSound("tick");
            }
        }

        if (left <= 0) {
            sendAnswer(true);
        }
    }

    function beginQuestion(data) {
        const text = String(data.question.question_text);
        const parts = text.split("\n\n");
        const codeBlock = $("#question-code");

        question = {
            id: data.question.question_id,
            startedAt: Date.now(),
            limit: Number(room.dataset.questionSeconds) || 30,
            lastLeft: null,
            done: false
        };

        $("#card-detected").textContent =
            "Card detected: " + data.card.card_name + " - " + data.card.card_effect;
        $("#question-title").textContent = parts[0];
        codeBlock.textContent = parts.slice(1).join("\n\n");
        codeBlock.hidden = parts.length < 2;

        optionsBox.textContent = "";

        data.question.options.forEach(function (option) {
            const label = document.createElement("label");
            const input = document.createElement("input");
            const badge = document.createElement("span");
            const words = document.createElement("span");

            label.className = "option";
            input.type = "radio";
            input.name = "option";
            input.value = option.option_id;
            badge.className = "option-badge";
            badge.textContent = option.option_label;
            words.className = "option-text";
            words.textContent = option.option_text;

            label.append(input, badge, words);
            optionsBox.append(label);
        });

        submitButton.disabled = true;
        showPanel("question");
        tickTimer();
        timerId = setInterval(tickTimer, 250);
    }

    optionsBox.addEventListener("change", function () {
        submitButton.disabled = false;
    });

    answerForm.addEventListener("submit", function (event) {
        event.preventDefault();
        sendAnswer(false);
    });

    async function sendAnswer(timedOut) {
        if (!question || question.done) {
            return;
        }

        question.done = true;
        stopTimer();
        submitButton.disabled = true;

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
        } else {
            const chosen = answerForm.querySelector('input[name="option"]:checked');
            body.selected_option_id = Number(chosen.value);
        }

        const result = await FJ.sendJson("POST", "/api/game/answers", body);

        question = null;

        if (!result.ok) {
            showPanel("idle");
            FJ.showMessage(
                gameMessage,
                (result.data && result.data.message) || "Could not save the answer.",
                "error"
            );
            refresh();
            return;
        }

        showResult(result.data);
    }

    /* ---------- The result ---------- */

    function showResult(data) {
        const timedOut = data.timed_out === true;
        const correctOption = data.correct_option;
        const answerLine = $("#result-answer");
        const explanation = $("#result-explanation");

        $("#result-icon").src = data.is_correct
            ? "/images/icons/correct.svg"
            : "/images/icons/wrong.svg";
        $("#result-title").textContent = data.is_correct
            ? "Correct!"
            : (timedOut ? "Time is up" : "Not quite");
        $("#result-action").textContent = (data.is_correct
            ? "Full card power unlocked: "
            : "Your strong card becomes a basic move: ") + data.card_action;
        $("#result-points").textContent = data.is_correct
            ? "+" + data.points_awarded + " points"
            : "No points lost";
        $("#result-score").textContent = "Your team score: " + data.team_score;

        answerLine.hidden = data.is_correct || !correctOption;

        if (!answerLine.hidden) {
            answerLine.textContent = "Correct answer: " +
                correctOption.option_label + ") " + correctOption.option_text;
        }

        explanation.hidden = !data.explanation;
        explanation.textContent = data.explanation || "";

        panels.result.classList.toggle("result-correct", data.is_correct);
        panels.result.classList.toggle("result-wrong", !data.is_correct);

        FJ.playSound(data.is_correct ? "correct" : (timedOut ? "timeup" : "wrong"));
        showPanel("result");
        refresh();
    }

    /* ---------- Buttons ---------- */

    scanButton.addEventListener("click", openScanner);
    $("#scan-cancel").addEventListener("click", closeScanner);

    $("#card-form").addEventListener("submit", function (event) {
        event.preventDefault();
        loadQuestion($("#card-code").value);
    });

    $("#continue-button").addEventListener("click", function () {
        clearMessage();
        showPanel("idle");
        refresh();
    });

    endTurnButton.addEventListener("click", async function () {
        endTurnButton.disabled = true;
        clearMessage();

        const result = await FJ.sendJson(
            "POST",
            "/api/game/sessions/" + sessionId + "/turn/end"
        );

        endTurnButton.disabled = false;

        if (!result.ok) {
            FJ.showMessage(
                gameMessage,
                (result.data && result.data.message) || "Could not end the turn.",
                "error"
            );
            refresh();
            return;
        }

        if (result.data.round_complete) {
            FJ.showMessage(
                gameMessage,
                "Round complete. A new round starts with a new order.",
                "success"
            );
        }

        updateTurn(result.data);
        refresh();
    });

    document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
            stopCamera();
        }
    });

    window.addEventListener("pagehide", stopCamera);

    refresh();
    pollId = setInterval(refresh, POLL_MS);
})();