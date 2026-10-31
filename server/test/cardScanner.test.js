const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function environment({ secure = true, error = null, gate = null } = {}) {
    const readers = [];
    class Reader {
        constructor() { this.isScanning = false; this.stops = 0; readers.push(this); }
        async start(device, config, callback) {
            this.decode = callback;
            if (gate) await gate;
            if (error) throw error;
            this.isScanning = true;
        }
        async stop() { this.isScanning = false; this.stops++; }
        clear() { this.cleared = true; }
    }
    const window = { isSecureContext: secure, Html5Qrcode: Reader, Html5QrcodeSupportedFormats: { QR_CODE: 0 } };
    vm.runInNewContext(fs.readFileSync('client/public/js/card-scanner.js', 'utf8'), {
        window, navigator: { mediaDevices: { getUserMedia() {} } }
    });
    const tokens = [], statuses = [];
    const scanner = window.FJCardScanner.create('camera', token => tokens.push(token), message => statuses.push(message));
    return { scanner, readers, tokens, statuses, parse: window.FJCardScanner.cardToken };
}

test('scanner accepts rank tokens, not external links or arbitrary QR contents', () => {
    const env = environment();
    assert.equal(env.parse(' FJ-ACE-2M6R5T '), 'FJ-ACE-2M6R5T');
    for (const value of ['https://example.com/q/token?suit=hearts', 'hello', '', null]) assert.equal(env.parse(value), null);
});

test('successful scan releases the camera and only submits once', async () => {
    const env = environment();
    await env.scanner.start();
    const reader = env.readers[0];
    await reader.decode('https://example.com/');
    assert.equal(reader.isScanning, true);
    await reader.decode('FJ-ACE-2M6R5T');
    await reader.decode('FJ-ACE-2M6R5T');
    assert.deepEqual(env.tokens, ['FJ-ACE-2M6R5T']);
    assert.equal(reader.stops, 1);
    assert.equal(reader.isScanning, false);
});

test('insecure contexts and denied permission give actionable camera errors', async () => {
    const insecure = environment({ secure: false });
    await insecure.scanner.start();
    assert.equal(insecure.readers.length, 0);
    assert.match(insecure.statuses.at(-1), /HTTPS.*localhost/);
    const denied = environment({ error: { name: 'NotAllowedError' } });
    await denied.scanner.start();
    assert.match(denied.statuses.at(-1), /permission was denied/);
    assert.equal(denied.tokens.length, 0);
});

test('closing while permission/start is pending still releases the late stream', async () => {
    let resolve;
    const env = environment({ gate: new Promise(done => { resolve = done; }) });
    const start = env.scanner.start();
    await new Promise(setImmediate);
    const stop = env.scanner.stop();
    resolve();
    await Promise.all([start, stop]);
    assert.equal(env.readers[0].isScanning, false);
    assert.equal(env.readers[0].stops, 1);
    assert.equal(env.tokens.length, 0);
});

test('closing immediately after clicking Scan cannot open a camera afterwards', async () => {
    const env = environment();
    await Promise.all([env.scanner.start(), env.scanner.stop()]);
    assert.equal(env.readers.length, 0);
});
