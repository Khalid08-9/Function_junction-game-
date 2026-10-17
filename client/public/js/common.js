// Small helpers used by every page. They live in one object called FJ.
(function () {
    // Sends a request to our JSON API and always returns { ok, status, data }
    async function sendJson(method, url, body) {
        const response = await fetch(url, {
            method: method,
            headers: { "Content-Type": "application/json" },
            body: body === undefined ? undefined : JSON.stringify(body),
            credentials: "same-origin"
        });

        let data = null;

        try {
            data = await response.json();
        } catch (error) {
            // The answer had no JSON body. That is fine.
        }

        return { ok: response.ok, status: response.status, data: data };
    }

    // textContent (not innerHTML), so text from the server can never run as code
    function showMessage(element, text, kind) {
        element.textContent = text;
        element.className = "message " + kind;
        element.hidden = false;
    }

    function goTo(url) {
        window.location.assign(url);
    }

    function homeFor(user) {
        return user.role === "lecturer" ? "/lecturer" : "/play";
    }

    // ---------- Sounds (files are in /sounds). The choice is remembered. ----------
    let muted = false;

    try {
        muted = window.localStorage.getItem("fj-muted") === "1";
    } catch (error) {
        // Storage is not available. We simply do not remember the choice.
    }

    const players = {};

    // Example: FJ.playSound("correct")  ->  plays /sounds/correct.wav
    function playSound(name) {
        if (muted) {
            return;
        }

        if (!players[name]) {
            players[name] = new Audio("/sounds/" + name + ".wav");
        }

        const audio = players[name];
        audio.currentTime = 0;

        const attempt = audio.play();

        if (attempt && attempt.catch) {
            attempt.catch(function () {
                // The browser blocked the sound (no click yet). That is fine.
            });
        }
    }

    window.FJ = {
        sendJson: sendJson,
        showMessage: showMessage,
        goTo: goTo,
        homeFor: homeFor,
        playSound: playSound
    };

    const soundToggle = document.querySelector("#sound-toggle");

    function drawSoundToggle() {
        if (!soundToggle) {
            return;
        }

        soundToggle.querySelector("img").src =
            muted ? "/images/icons/sound-off.svg" : "/images/icons/sound-on.svg";
        soundToggle.setAttribute("aria-label", muted ? "Turn sound on" : "Turn sound off");
    }

    if (soundToggle) {
        drawSoundToggle();

        soundToggle.addEventListener("click", function () {
            muted = !muted;

            try {
                window.localStorage.setItem("fj-muted", muted ? "1" : "0");
            } catch (error) {
                // Not remembered, but the button still works for this page.
            }

            drawSoundToggle();
        });
    }

    const logoutButton = document.querySelector("#logout-button");

    if (logoutButton) {
        logoutButton.addEventListener("click", async function () {
            await sendJson("POST", "/api/auth/logout");
            goTo("/login");
        });
    }
})();
