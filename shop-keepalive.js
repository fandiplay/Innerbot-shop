'use strict';

// Optional, dependency-free supervisor for the standalone HTTP shop.
// Android killing Termux itself is outside the protection of this process.
const { spawn } = require('node:child_process');
const path = require('node:path');
require('./src/utils/env').loadEnv();
let child;
let timer;
let stopping = false;
let attempts = 0;

function start() {
    if (stopping) return;
    const started = Date.now();
    child = spawn(process.execPath, [path.join(__dirname, 'shop.js')], {
        cwd: __dirname, stdio: 'inherit', env: process.env,
    });
    child.on('error', error => console.error('[SHOP RUNNER]', error.message));
    child.once('close', code => {
        child = null;
        if (stopping) return;
        if (Date.now() - started > 120_000) attempts = 0;
        const delay = Math.min(2000 * 2 ** Math.min(attempts++, 5), 60_000);
        console.error(`[SHOP RUNNER] Shop berhenti (${code}). Mulai lagi dalam ${delay / 1000} detik.`);
        timer = setTimeout(start, delay);
    });
}

function stop(signal) {
    if (stopping) return;
    stopping = true;
    clearTimeout(timer);
    if (child) {
        const active = child;
        active.kill(signal);
        const force = setTimeout(() => active.kill('SIGKILL'), 4000);
        force.unref();
        active.once('close', () => clearTimeout(force));
    }
}
process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));
if (process.env.SHOP_ENABLED === '0') {
    console.error('[SHOP RUNNER] SHOP_ENABLED=0; shop tidak dijalankan.');
} else {
    start();
}
