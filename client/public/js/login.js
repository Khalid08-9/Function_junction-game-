(function () {
    const form = document.querySelector("#login-form");
    const message = document.querySelector("#form-message");
    const button = form.querySelector("button[type=submit]");

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = form.elements.email.value.trim();
        const password = form.elements.password.value;

        if (!email || !password) {
            FJ.showMessage(message, "Enter your email and password.", "error");
            return;
        }

        button.disabled = true;

        const result = await FJ.sendJson("POST", "/api/auth/login", {
            email: email,
            password: password
        });

        if (result.ok) {
            FJ.goTo(FJ.homeFor(result.data.user));
            return;
        }

        FJ.showMessage(
            message,
            (result.data && result.data.message) || "Login failed. Please try again.",
            "error"
        );
        button.disabled = false;
    });
})();
