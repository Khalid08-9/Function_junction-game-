(function () {
    const button = document.querySelector("#create-session");
    const message = document.querySelector("#form-message");

    button.addEventListener("click", async function () {
        button.disabled = true;

        const result = await FJ.sendJson("POST", "/api/sessions");

        if (result.ok) {
            FJ.goTo("/sessions/" + result.data.session.session_id);
            return;
        }

        FJ.showMessage(
            message,
            (result.data && result.data.message) || "Could not create the session.",
            "error"
        );
        button.disabled = false;
    });
})();
