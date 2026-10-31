const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { generate } = require("../../scripts/generate-physical-qr-codes");

test("generator produces 13 rank-only token QR images, Markdown and a printable sheet", async (t) => {
    const output = await fs.mkdtemp("/tmp/opencode/physical-qr-test-");
    t.after(() => fs.rm(output, { recursive: true, force: true }));
    const cards = ["Ace", "King", "Queen", "Jack", "10", "9", "8", "7", "6", "5", "4", "3", "2"]
        .map(name => ({ card_name: name, qr_token: "FJ-" + name }));
    await fs.mkdir(path.join(output, "qr-codes"));
    await fs.writeFile(path.join(output, "qr-codes/2-hearts.svg"), "obsolete generated label");
    await fs.writeFile(path.join(output, "qr-codes/my-notes.txt"), "keep unrelated files");
    const labels = await generate(cards, output);
    assert.equal(labels.length, 13);
    assert.equal(new Set(labels.map(label => label.payload)).size, 13);
    const files = await fs.readdir(path.join(output, "qr-codes"));
    assert.equal(files.filter(file => file.endsWith('.svg')).length, 13);
    assert.ok(files.includes('2.svg'));
    assert.ok(!files.includes('2-hearts.svg'));
    assert.ok(files.includes('my-notes.txt'));
    const markdown = await fs.readFile(path.join(output, "physical-card-qr-codes.md"), "utf8");
    assert.equal((markdown.match(/!\[QR for /g) || []).length, 13);
    const html = await fs.readFile(path.join(output, "physical-card-qr-codes.html"), "utf8");
    assert.equal((html.match(/<article class="label">/g) || []).length, 13);
    for (const label of labels) {
        const svg = await fs.readFile(path.join(output, "qr-codes", label.file), "utf8");
        assert.match(svg, /<svg/);
        assert.ok(markdown.includes(label.payload));
        assert.ok(!label.payload.includes("://"));
        assert.ok(!/hearts|diamonds|clubs|spades/.test(label.file));
    }
    await assert.rejects(generate([], output), /13 active standard ranks/);
});
