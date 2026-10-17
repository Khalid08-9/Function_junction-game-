(function () {
    const page = document.querySelector("#session-page");
    const message = document.querySelector("#form-message");
    const sessionId = page.dataset.sessionId;

    // Start / Finish buttons (only the lecturer sees them)
    document.querySelectorAll("[data-action]").forEach(function (button) {
        button.addEventListener("click", async function () {
            const action = button.dataset.action;

            if (action === "finish" && !window.confirm("Finish this game for everyone?")) {
                return;
            }

            button.disabled = true;

            const result = await FJ.sendJson("POST", "/api/sessions/" + sessionId + "/" + action);

            if (result.ok) {
                window.location.reload();
                return;
            }

            FJ.showMessage(
                message,
                (result.data && result.data.message) || "Something went wrong.",
                "error"
            );
            button.disabled = false;
        });
    });

    // Every 3 seconds: ask the server if anything changed. If yes, reload the
    // page, so the Pug template draws the new teams and status.
    async function checkForChanges() {
        const result = await FJ.sendJson("GET", "/api/sessions/" + sessionId);

        if (!result.ok) {
            return;
        }

        const players = result.data.teams.reduce(function (sum, team) {
            return sum + team.members.length;
        }, 0);

        if (result.data.session.status + ":" + players !== page.dataset.signature) {
            window.location.reload();
        }
    }

    if (page.dataset.status !== "finished") {
        setInterval(checkForChanges, 3000);
    }
})();
