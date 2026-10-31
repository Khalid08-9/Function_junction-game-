// Local camera decoding only. Printed QR payloads are card tokens, not URLs.
(function () {
    'use strict';
    function cardToken(text) {
        const value = String(text || '').trim();
        return /^FJ-[A-Za-z0-9-]{1,96}$/.test(value) ? value : null;
    }

    function create(elementId, onScan, onStatus) {
        let reader = null;
        let opening = null;
        let generation = 0;
        let handling = false;

        async function stop() {
            generation++;
            const current = reader;
            reader = null;
            if (opening) { try { await opening; } catch (error) { /* Opening failed or was cancelled. */ } }
            if (!current) return;
            try { if (current.isScanning) await current.stop(); } catch (error) { /* Release best-effort. */ }
            try { current.clear(); } catch (error) { /* Already cleared. */ }
        }

        async function start() {
            const requestGeneration = generation + 1;
            await stop();
            if (generation !== requestGeneration) return;
            if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                onStatus('Camera access requires HTTPS or http://localhost:3000 on this device. A plain HTTP network address cannot access the camera.');
                return;
            }
            if (!window.Html5Qrcode) { onStatus('The camera scanner could not load. Refresh the page and try again.'); return; }
            const currentGeneration = ++generation;
            handling = false;
            const current = new window.Html5Qrcode(elementId, {
                formatsToSupport: [window.Html5QrcodeSupportedFormats.QR_CODE], verbose: false
            });
            reader = current;
            onStatus('Allow camera permission, then hold the printed card QR in front of the camera.');
            try {
                const request = current.start({ facingMode: 'environment' }, { fps: 10 }, async function (text) {
                    if (handling || generation !== currentGeneration) return;
                    const token = cardToken(text);
                    if (!token) { onStatus('This is not a rank-only Function Junction label. Use the new labels in docs/qr-codes.'); return; }
                    handling = true;
                    const expectedGeneration = generation + 1;
                    await stop();
                    if (generation !== expectedGeneration) return;
                    try { await onScan(token); } catch (error) { onStatus('Could not play the scanned card. Retry scanning.'); }
                }, function () { /* Normal: most video frames contain no readable QR. */ });
                opening = request;
                await request;
            } catch (error) {
                if (generation !== currentGeneration) return;
                const detail = String(error && (error.name || error.message) || error);
                onStatus(/NotAllowed|Permission|denied/i.test(detail)
                    ? 'Camera permission was denied. Allow camera access in your browser settings and retry.'
                    : /NotFound|DevicesNotFound/i.test(detail)
                        ? 'No camera was found. Connect a webcam or use a device with a camera.'
                        : 'Could not open the camera. Close other apps using it and retry.');
                await stop();
            } finally {
                if (reader === current || reader === null) opening = null;
            }
        }
        return { start, stop };
    }
    window.FJCardScanner = { create, cardToken };
})();
