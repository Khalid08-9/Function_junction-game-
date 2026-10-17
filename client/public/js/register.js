(function () {
    const form = document.querySelector("#register-form");
    const message = document.querySelector("#form-message");
    const button = form.querySelector("button[type=submit]");

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        // Read every field of the form by its name
        const body = {};

        for (const field of form.elements) {
            if (field.name) {
                body[field.name] = field.value;
            }
        }

        button.disabled = true;

        const created = await FJ.sendJson("POST", form.dataset.endpoint, body);

        if (!created.ok) {
            FJ.showMessage(
                message,
                (created.data && created.data.message) || "Registration failed.",
                "error"
            );
            button.disabled = false;
            return;
        }

        // Account created: log in straight away
        const login = await FJ.sendJson("POST", "/api/auth/login", {
            email: body.email,
            password: body.password
        });

        if (login.ok) {
            FJ.goTo(FJ.homeFor(login.data.user));
            return;
        }

        FJ.goTo("/login");
    });
})();
