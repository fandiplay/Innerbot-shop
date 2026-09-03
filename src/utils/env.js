'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

const ENV_FILE = path.resolve(__dirname, '..', '..', '.env');
const ALLOWED_KEYS = [
    'ADMIN_NUMBERS', 'SHOP_WEB_ENABLED', 'SHOP_ENABLED', 'SHOP_HOST', 'SHOP_PORT',
    'SHOP_PUBLIC_URL', 'SHOP_RATE_LIMIT',
];

function loadEnv({ file = ENV_FILE, env = process.env } = {}) {
    let content;
    try {
        const stat = fs.statSync(file);
        if (!stat.isFile() || stat.size > 64 * 1024) throw new Error('invalid env file');
        content = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    } catch (error) {
        if (error.code === 'ENOENT') return false;
        throw new Error('File .env tidak dapat dibaca. Gunakan file teks UTF-8, maksimal 64 KiB.');
    }
    if (typeof parseEnv !== 'function') {
        throw new Error('Pembacaan .env membutuhkan Node 20.12+ atau 22+. Periksa node -v dan perbarui Node.');
    }
    if (content.includes('\0') || Buffer.byteLength(content, 'utf8') > 64 * 1024) {
        throw new Error('Simpan .env sebagai teks UTF-8, bukan UTF-16; maksimal 64 KiB.');
    }
    let values;
    try { values = parseEnv(content); }
    catch (_) { throw new Error('Format .env tidak valid. Gunakan KEY=VALUE.'); }
    // Only application settings. Never import NODE_OPTIONS, PATH or unrelated keys.
    // Explicit shell variables take precedence over values in the file.
    for (const key of ALLOWED_KEYS) {
        if (Object.hasOwn(values, key) && !Object.hasOwn(env, key)) env[key] = values[key];
    }
    return true;
}

module.exports = { loadEnv };
