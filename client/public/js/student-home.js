(function () {
    const form = document.querySelector("#join-form");
    const message = document.querySelector("#form-message");
    const button = form.querySelector("button[type=submit]");

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const code = form.elements.session_code.value.trim().toUpperCase();

        const chosenTeam = form.querySelector('input[name="team_number"]:checked');

        if (!code) {
            FJ.showMessage(message, "Enter the session code.", "error");
            return;
        }

        if (!chosenTeam) {
            FJ.showMessage(message, "Choose Team 1 or Team 2.", "error");
            return;
        }

        button.disabled = true;

        const result = await FJ.sendJson("POST", "/api/sessions/join", {
            session_code: code,
            team_number: Number(chosenTeam.value)
        });

        if (result.ok) {
            FJ.goTo("/sessions/" + result.data.session_id);
            return;
        }

        FJ.showMessage(
            message,
            (result.data && result.data.message) || "Could not join the session.",
            "error"
        );
        button.disabled = false;
    });
})();