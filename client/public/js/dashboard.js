(function () {
    const page = document.querySelector("[data-session-id]");
    const sessionId = page ? Number(page.dataset.sessionId) : null;
    const message = document.querySelector("#form-message");
    const endButton = document.querySelector("#end-session");

    if (!sessionId) {
        return;
    }

    // ---------- End session (lecturer only) ----------

    if (endButton) {
        endButton.addEventListener("click", async function () {
            if (!window.confirm("End this session for everyone? The game will stop.")) {
                return;
            }

            endButton.disabled = true;

            const result = await FJ.sendJson(
                "POST",
                "/api/sessions/" + sessionId + "/finish"
            );

            endButton.disabled = false;

            if (result.ok) {
                FJ.showMessage(message, "Session ended.", "success");
                setTimeout(function () {
                    FJ.goTo("/lecturer");
                }, 900);
                return;
            }

            FJ.showMessage(
                message,
                (result.data && result.data.message) || "Could not end the session.",
                "error"
            );
        });
    }

})();
