(function () {
    const page = document.querySelector("[data-session-id]");
    const sessionId = page ? Number(page.dataset.sessionId) : null;
    const message = document.querySelector("#form-message");
    const endButton = document.querySelector("#end-session");

    if (!sessionId) {
        return;
    }

    // ---------- Sidebar section switching ----------
    const sidebarItems = document.querySelectorAll(".sidebar-item");
    const sections = document.querySelectorAll(".dashboard-section");

    sidebarItems.forEach(function (item) {
        item.addEventListener("click", function () {
            const target = item.dataset.section;

            sidebarItems.forEach(function (i) {
                i.classList.remove("active");
            });
            sections.forEach(function (s) {
                s.classList.remove("active");
            });

            item.classList.add("active");
            const targetSection = document.querySelector(
                ".dashboard-section[data-section='" + target + "']"
            );
            if (targetSection) {
                targetSection.classList.add("active");
            }
        });
    });

    // ---------- Live session timer ----------
    const timerEl = document.querySelector("#live-timer");
    const startedAt = timerEl ? timerEl.dataset.startedAt : "";

    if (timerEl && startedAt) {
        const start = new Date(startedAt).getTime();

        function tick() {
            const now = Date.now();
            let diff = Math.floor((now - start) / 1000);
            if (diff < 0) diff = 0;
            const h = Math.floor(diff / 3600);
            const m = Math.floor((diff % 3600) / 60);
            const s = diff % 60;
            timerEl.textContent =
                String(h).padStart(2, "0") +
                ":" +
                String(m).padStart(2, "0") +
                ":" +
                String(s).padStart(2, "0");
        }

        tick();
        setInterval(tick, 1000);
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
