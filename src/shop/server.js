'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createCatalogService, ShopError } = require('./catalog');

// Exact allowlist. Never serve the repository root, session files or catalog path.
const ASSETS = new Map([
    ['/', ['index.html', 'text/html; charset=utf-8']],
    ['/index.html', ['index.html', 'text/html; charset=utf-8']],
    ['/shop.css', ['shop.css', 'text/css; charset=utf-8']],
    ['/shop.js', ['shop.js', 'text/javascript; charset=utf-8']],
]);
const PUBLIC_DIR = path.join(__dirname, 'public');
const BODY_LIMIT = 4096;

function json(res, status, value) {
    if (res.destroyed || res.writableEnded) return;
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(value));
}

function readJson(req) {
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
        throw new ShopError(415, 'JSON_REQUIRED', 'Gunakan application/json.');
    }
    if (Number(req.headers['content-length']) > BODY_LIMIT) {
        throw new ShopError(413, 'BODY_TOO_LARGE', 'Permintaan terlalu besar.');
    }
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        const finish = (error, value) => {
            clearTimeout(timer);
            req.removeListener('data', onData);
            req.removeListener('end', onEnd);
            req.removeListener('error', onError);
            req.removeListener('aborted', onAborted);
            if (error) { req.resume(); reject(error); } else resolve(value);
        };
        const onError = () => finish(new ShopError(400, 'BAD_REQUEST', 'Permintaan tidak lengkap.'));
        const onAborted = onError;
        const onData = chunk => {
            size += chunk.length;
            if (size > BODY_LIMIT) return finish(new ShopError(413, 'BODY_TOO_LARGE', 'Permintaan terlalu besar.'));
            chunks.push(chunk);
        };
        const onEnd = () => {
            try { finish(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
            catch (_) { finish(new ShopError(400, 'INVALID_JSON', 'Format permintaan tidak valid.')); }
        };
        const timer = setTimeout(() => finish(new ShopError(408, 'REQUEST_TIMEOUT', 'Permintaan terlalu lama.')), 10_000);
        timer.unref();
        req.on('data', onData).once('end', onEnd).once('error', onError).once('aborted', onAborted);
    });
}

function createShopServer({ service = createCatalogService(), rateLimit = 120, publicOrigin = '' } = {}) {
    const clients = new Map();
    function rateAllowed(address) {
        const now = Date.now();
        let client = clients.get(address);
        if (!client || client.until <= now) {
            if (clients.size >= 2048) {
                for (const [key, item] of clients) if (item.until <= now) clients.delete(key);
                if (clients.size >= 2048 && !clients.has(address)) return false;
            }
            client = { count: 0, until: now + 60_000 };
            clients.set(address, client);
        }
        return ++client.count <= rateLimit;
    }

    const server = http.createServer({ maxHeaderSize: 8192 }, async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
        try {
            // Reject traversal encodings before URL normalization.
            if (!req.url?.startsWith('/') || req.url.startsWith('//') || req.url.length > 2048) {
                throw new ShopError(400, 'BAD_URL', 'Alamat tidak valid.');
            }
            const rawPath = decodeURIComponent(req.url.split('?')[0]);
            if (rawPath.includes('\\') || rawPath.includes('\0') || rawPath.split('/').some(p => p === '..' || p === '.')) {
                throw new ShopError(404, 'NOT_FOUND', 'Halaman tidak ditemukan.');
            }
            const pathname = new URL(req.url, 'http://localhost').pathname;
            const asset = ASSETS.get(pathname);
            if (asset) {
                if (!['GET', 'HEAD'].includes(req.method)) {
                    res.setHeader('Allow', 'GET, HEAD');
                    throw new ShopError(405, 'METHOD_NOT_ALLOWED', 'Metode tidak diizinkan.');
                }
                const content = await fs.readFile(path.join(PUBLIC_DIR, asset[0]));
                res.writeHead(200, { 'Content-Type': asset[1] });
                res.end(req.method === 'HEAD' ? undefined : content);
                return;
            }
            const method = pathname === '/api/v1/catalog' ? 'GET' : pathname === '/api/v1/quote' ? 'POST' : null;
            if (!method) throw new ShopError(404, 'NOT_FOUND', 'Halaman tidak ditemukan.');
            if (req.method !== method) {
                res.setHeader('Allow', method);
                throw new ShopError(405, 'METHOD_NOT_ALLOWED', 'Metode tidak diizinkan.');
            }
            // Ignore X-Forwarded-For: arbitrary callers must not bypass limits.
            if (!rateAllowed(req.socket.remoteAddress || 'unknown')) {
                res.setHeader('Retry-After', '60');
                throw new ShopError(429, 'RATE_LIMIT', 'Terlalu banyak permintaan. Tunggu satu menit.');
            }
            if (req.headers.origin) {
                let origin;
                try { origin = new URL(req.headers.origin); } catch (_) {}
                if (!origin || !['http:', 'https:'].includes(origin.protocol) ||
                    (origin.host !== req.headers.host && origin.origin !== publicOrigin)) {
                    throw new ShopError(403, 'ORIGIN_REJECTED', 'Buka shop dari alamat aslinya.');
                }
            }
            const data = method === 'GET' ? await service.getCatalog() : await service.quote(await readJson(req));
            json(res, 200, { apiVersion: 1, data });
        } catch (error) {
            const known = error instanceof ShopError;
            const badUrl = error instanceof URIError;
            if (!req.complete) res.setHeader('Connection', 'close');
            req.resume();
            json(res, known ? error.status : badUrl ? 400 : 500, {
                apiVersion: 1,
                error: { code: known ? error.code : badUrl ? 'BAD_URL' : 'INTERNAL_ERROR',
                    message: known ? error.message : 'Shop belum dapat memproses permintaan. Coba lagi.' },
            });
        }
    });
    server.headersTimeout = 15_000;
    server.requestTimeout = 20_000;
    server.keepAliveTimeout = 5_000;
    server.setTimeout(25_000, socket => socket.destroy());
    server.maxConnections = 128;
    server.maxRequestsPerSocket = 100;
    server.on('clientError', (_, socket) => {
        if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    });
    return server;
}

function startShopServer(env = process.env) {
    if (env.SHOP_ENABLED === '0') return null;
    const port = Number(env.SHOP_PORT || 3000);
    const rateLimit = Number(env.SHOP_RATE_LIMIT || 120);
    if (!Number.isInteger(port) || port < 1 || port > 65535 || !Number.isInteger(rateLimit) || rateLimit < 1) {
        throw new Error('SHOP_PORT / SHOP_RATE_LIMIT tidak valid.');
    }
    let publicOrigin = '';
    if (env.SHOP_PUBLIC_URL) {
        const url = new URL(env.SHOP_PUBLIC_URL);
        if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
            throw new Error('SHOP_PUBLIC_URL harus berupa origin HTTPS, tanpa path/token.');
        }
        publicOrigin = url.origin;
    }
    const host = env.SHOP_HOST || '127.0.0.1';
    const server = createShopServer({ rateLimit, publicOrigin });
    server.on('error', error => console.error(`[SHOP] Gagal membuka server (${error.code || 'ERROR'}). Periksa port; bot tidak dihentikan.`));
    server.listen(port, host, () => {
        console.log(`[SHOP] Aktif di http://${host}:${port}`);
        if (publicOrigin) console.log(`[SHOP] Alamat pelanggan: ${publicOrigin} (tunnel/proxy harus aktif)`);
    });
    return server;
}

module.exports = { createShopServer, startShopServer };
