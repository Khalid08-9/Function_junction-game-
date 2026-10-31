const test = require("node:test");
const assert = require("node:assert/strict");
const { expireTurn } = require("../src/services/turnService");

test("unexpired, inactive and missing games do not advance", async () => {
    for (const states of [[], [{ status: "finished", expired: 1 }], [{ status: "active", expired: 0 }]]) {
        let calls = 0;
        const connection = {
            async execute(sql, params) {
                calls++;
                assert.match(sql, /FOR UPDATE/);
                assert.match(sql, /INTERVAL 60 SECOND/);
                assert.deepEqual(params, [42]);
                return [states];
            }
        };
        assert.equal(await expireTurn(connection, 42), false);
        assert.equal(calls, 1);
    }
});

test("expired turn advances once, resets the clock and preserves hand metadata", async () => {
    const metadata = { text: "old", played_cards: { 1: [3] }, current_deal: 2 };
    const queries = [];
    const connection = {
        async execute(sql, params) {
            queries.push({ sql, params });
            if (sql.includes("AS expired")) return [[{ status: "active", expired: 1 }]];
            if (sql.includes("MAX(round_number)")) return [[{ round_number: 6 }]];
            if (sql.includes("JOIN users")) return [[
                { round_turn_id: 10, user_id: 1, full_name: "First" },
                { round_turn_id: 11, user_id: 2, full_name: "Next" }
            ]];
            if (sql.includes("SELECT team_id")) return [[{ team_id: 20 }]];
            if (sql.includes("SELECT last_action")) return [[{ last_action: JSON.stringify(metadata) }]];
            return [{ affectedRows: 1 }];
        }
    };
    assert.equal(await expireTurn(connection, 42), true);
    const updates = queries.filter(({ sql }) => sql.includes("UPDATE game_state"));
    assert.equal(updates.length, 1);
    assert.match(updates[0].sql, /turn_started_at = NOW\(\)/);
    const saved = JSON.parse(updates[0].params[1]);
    assert.deepEqual(saved.played_cards, metadata.played_cards);
    assert.equal(saved.current_deal, 2);
    assert.match(saved.text, /Time is up.*Next plays next/);
});
