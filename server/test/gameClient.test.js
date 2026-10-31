const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

// A minimal DOM harness exercises the real browser functions without a browser
// dependency. Production code is unchanged; the test exposes its closure locally.
function client(mode) {
    class Element {
        constructor() { this.children = []; this.dataset = {}; this.style = {}; this.hidden = false; this.className = ""; }
        set innerHTML(value) { this.children = []; }
        append(...children) { this.children.push(...children); }
        appendChild(child) { this.children.push(child); }
        addEventListener() {}
        querySelectorAll(selector) {
            return this.children.filter(child => selector === "button" || child.className === "card-pick-btn");
        }
        querySelector() { return null; }
    }
    const room = new Element();
    room.dataset = { sessionId: "42", myTeamId: "10", myUserId: "7", questionSeconds: "30", cardMode: mode };
    const elements = new Map([["#game-room", room], ...["#card-buttons", "#panel-question", "#panel-cards", "#physical-card-status", "#panel-select-marble", "#panel-scanner", "#camera-status"]
        .map(selector => [selector, new Element()])]);
    const cards = ["Ace", "King", "Jack", "4", "5"].map((name, index) => ({
        card_id: index + 1, card_name: name, card_key: `${index + 1}-hearts`, suit: "hearts", image: "card.svg"
    }));
    const calls = [];
    let active = null;
    const camera = { starts: 0, stops: 0, callback: null };
    const sandbox = {
        document: { querySelector: selector => elements.get(selector) || null, querySelectorAll: () => [], createElement: () => new Element() },
        Date, console, setInterval: () => 1, clearInterval() {}, setTimeout() {},
        window: { addEventListener() {}, FJCardScanner: { create(id, callback) {
            camera.callback = callback;
            return { async start() { camera.starts++; }, async stop() { camera.stops++; } };
        } } },
        FJ: {
            playSound() {}, showMessage() {},
            async sendJson(method, url, body) {
                calls.push({ method, url, body });
                if (url.endsWith("/cards/select")) active = { ...cards[0], user_id: 7, turn_number: 1, result: null };
                if (url.endsWith("/cards/scan")) active = { ...cards[0], suit: undefined, card_key: '1-physical-1', user_id: 7, turn_number: 1, result: null,
                    question_data: { card: cards[0], question: { question_id: 100, question_text: 'Which keyword defines a function?', options: [] } } };
                if (url.endsWith("/hand") || url.endsWith("/cards/select") || url.endsWith('/cards/scan')) return { ok: true, data: {
                    hand: mode === "physical" ? [] : active ? cards.slice(1) : cards,
                    remaining_count: active ? 4 : 5, active_card: active
                } };
                if (url.startsWith("/api/questions/by-card/")) return { ok: true, data: {
                    card: cards[0], question: { question_id: 100, question_text: "Which keyword defines a function?", options: [] }
                } };
                return { ok: false };
            }
        }
    };
    const source = fs.readFileSync("client/public/js/game.js", "utf8");
    const initialization = source.indexOf("    // ---------- INITIALIZATION ----------");
    vm.runInNewContext(source.slice(0, initialization) +
        "globalThis.game = { updateTurn, onCardSelected, loadPlayerHand, openPhysicalCamera };\n})();", sandbox);
    return { game: sandbox.game, elements, calls, camera, setActive(value) { active = value; }, cards };
}

const turn = { current_player: { user_id: 7, team_id: 10 }, round_number: 1, turn_number: 1, turn_seconds_remaining: 60, order: [] };

test("digital card selection opens the question directly and polling cannot re-enable the other cards", async () => {
    const browser = client("digital");
    browser.game.updateTurn(turn);
    await Promise.resolve();
    await browser.game.onCardSelected(1, "Ace", "1-hearts");
    assert.ok(browser.calls.some(call => call.url === "/api/questions/by-card/1"));
    assert.ok(browser.calls.every(call => !call.url.includes("card-qr")));
    const buttons = browser.elements.get("#card-buttons").querySelectorAll(".card-pick-btn");
    assert.equal(buttons.length, 4);
    browser.game.updateTurn(turn);
    assert.ok(buttons.every(button => button.disabled));
    assert.equal(browser.elements.get("#panel-question").hidden, false);
});

test("physical mode shows scan status, not a virtual hand, and restores a saved result", async () => {
    const browser = client("physical");
    browser.game.updateTurn(turn);
    await Promise.resolve();
    assert.equal(browser.elements.get("#card-buttons").querySelectorAll(".card-pick-btn").length, 0);
    browser.setActive({ ...browser.cards[0], user_id: 7, turn_number: 1, result: { is_correct: true, card_name: "Ace", card_action: "Enter" } });
    await browser.game.loadPlayerHand(1, 1);
    assert.match(browser.elements.get("#physical-card-status").textContent, /Answer received/);
    assert.equal(browser.elements.get("#panel-select-marble").hidden, false);
    assert.ok(browser.calls.every(call => !call.url.includes("/cards/select") && !call.url.includes("card-qr")));
});

test('website Scan card opens this device camera and shows the scanned question on the same screen', async () => {
    const browser = client('physical');
    browser.game.updateTurn(turn);
    await Promise.resolve();
    await browser.game.openPhysicalCamera();
    assert.equal(browser.camera.starts, 1);
    assert.equal(browser.elements.get('#panel-scanner').hidden, false);
    await browser.camera.callback('FJ-ACE-test');
    assert.ok(browser.calls.some(call => call.url.endsWith('/cards/scan') && call.body.qr_token === 'FJ-ACE-test' && !('suit' in call.body)));
    assert.equal(browser.elements.get('#panel-question').hidden, false);
    assert.equal(browser.elements.get('#panel-scanner').hidden, true);
    assert.ok(browser.camera.stops > 0);
    const stops = browser.camera.stops;
    browser.game.updateTurn({ ...turn, turn_number: 2, current_player: { user_id: 8, team_id: 20 } });
    assert.ok(browser.camera.stops > stops);
});
