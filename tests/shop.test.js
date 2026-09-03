'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { once } = require('node:events');
const { createCatalogService, validateCatalog } = require('../src/shop/catalog');
const { createShopServer, startShopServer } = require('../src/shop/server');

function fixture() {
    return { schemaVersion: 1, shop: { name: 'Toko Uji', currency: 'IDR', secret: 'not-public' },
        products: [{ id: 'tes-a', name: 'Produk Uji', price: 12000, description: 'Contoh', details: ['Rincian satu'], available: true, privateKey: 'not-public' }] };
}

async function setup(t, options = {}) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'inner-shop-test-'));
    const file = path.join(directory, 'catalog.json');
    const write = async value => {
        await fs.writeFile(file + '.tmp', typeof value === 'string' ? value : JSON.stringify(value));
        await fs.rename(file + '.tmp', file);
    };
    await write(fixture());
    const service = createCatalogService(file);
    const server = createShopServer({ service, ...options });
    t.after(async () => {
        server.closeAllConnections?.();
        await new Promise(resolve => server.close(resolve));
        await fs.rm(directory, { recursive: true, force: true });
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const origin = `http://127.0.0.1:${server.address().port}`;
    const get = route => fetch(origin + route);
    const post = (body, headers = {}) => fetch(origin + '/api/v1/quote', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
    const raw = route => new Promise((resolve, reject) => {
        http.get(origin + '/', { path: route }, res => {
            res.resume(); res.on('end', () => resolve(res.statusCode));
        }).on('error', reject);
    });
    return { service, write, get, post, raw, origin };
}

test('catalog API exposes only allowed fields and quote uses server price', async t => {
    const { get, post } = await setup(t);
    const res = await get('/api/v1/catalog');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const { data } = await res.json();
    assert.equal(data.products[0].price, 12000);
    assert.equal(data.shop.secret, undefined);
    assert.equal(data.products[0].privateKey, undefined);
    const quote = await post({ productId: 'tes-a', quantity: 2 });
    assert.equal(quote.status, 200);
    const body = await quote.json();
    assert.equal(body.data.total, 24000);
    assert.equal(body.data.revision, data.revision);
    assert.match(body.data.notice, /bukan pesanan/);
});

test('catalog hot reload changes quote and recovers after malformed edits', async t => {
    const { post, get, write } = await setup(t);
    const first = (await (await get('/api/v1/catalog')).json()).data;
    const updated = fixture(); updated.products[0].price = 19500;
    await write(updated);
    const second = (await (await post({ productId: 'tes-a' })).json()).data;
    assert.equal(second.total, 19500);
    assert.notEqual(second.revision, first.revision);
    await write('{broken json');
    assert.equal((await post({ productId: 'tes-a' })).status, 503);
    assert.equal((await get('/api/v1/catalog')).status, 503);
    await write(updated);
    assert.equal((await post({ productId: 'tes-a' })).status, 200);
});

test('removed, unavailable and unknown products cannot produce quotes', async t => {
    const { write, post } = await setup(t);
    const data = fixture(); data.products[0].available = false;
    await write(data);
    assert.equal((await post({ productId: 'tes-a' })).status, 409);
    data.products = []; await write(data);
    assert.equal((await post({ productId: 'tes-a' })).status, 404);
    assert.equal((await post({ productId: '__proto__' })).status, 404);
});

test('client prices, malformed selections and invalid quantities are rejected', async t => {
    const { post } = await setup(t);
    for (const body of [null, [], {}, { productId: 'tes-a', price: 1 },
        { productId: 'tes-a', quantity: 0 }, { productId: 'tes-a', quantity: -1 },
        { productId: 'tes-a', quantity: 1.5 }, { productId: 'tes-a', quantity: 101 },
        { productId: 'tes-a', quantity: '2' }, { productId: ['tes-a'] }]) {
        assert.equal((await post(JSON.stringify(body))).status, 400);
    }
    assert.equal((await post({ productId: 'tes-a', quantity: 100 })).status, 200);
});

test('malformed and oversized request bodies fail without killing the server', async t => {
    const { post, get } = await setup(t);
    assert.equal((await post('{')).status, 400);
    assert.equal((await post({ productId: 'tes-a' }, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await post('x'.repeat(5000))).status, 413);
    assert.equal((await get('/api/v1/catalog')).status, 200);
});

test('chunked oversized input and aborted requests leave server usable', async t => {
    const { origin, get } = await setup(t);
    const status = await new Promise((resolve, reject) => {
        const req = http.request(origin + '/api/v1/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => {
            res.resume(); res.on('end', () => resolve(res.statusCode));
        });
        req.on('error', reject);
        req.write('x'.repeat(5000)); req.end();
    });
    assert.equal(status, 413);
    await new Promise(resolve => {
        const req = http.request(origin + '/api/v1/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        req.on('error', () => resolve());
        req.on('socket', socket => socket.once('connect', () => { req.write('{'); req.destroy(); resolve(); }));
    });
    assert.equal((await get('/api/v1/catalog')).status, 200);
});

test('static allowlist blocks auth sessions, source files and traversal', async t => {
    const { get, raw } = await setup(t);
    for (const route of ['/auth_session/creds.json', '/.env', '/package.json', '/src/config.js', '/src/shop/catalog.json', '/index.js', '/src/shop/server.js']) {
        assert.equal((await get(route)).status, 404, route);
    }
    for (const route of ['/../auth_session/creds.json', '/%2e%2e/.env', '/%2e%2e%2fauth_session/creds.json', '/%5cauth_session', '/%00']) {
        assert.equal(await raw(route), 404, route);
    }
    assert.equal(await raw('/%ZZ'), 400);
    const home = await get('/');
    assert.equal(home.status, 200);
    assert.match(await home.text(), /quote-dialog/);
    for (const asset of ['/shop.js', '/shop.css']) assert.equal((await get(asset)).status, 200);
    assert.equal(home.headers.get('x-frame-options'), 'DENY');
    assert.match(home.headers.get('content-security-policy'), /script-src 'self'/);
});

test('HTTP methods and cross-origin requests are restricted', async t => {
    const { get, post, origin } = await setup(t);
    assert.equal((await get('/api/v1/quote')).status, 405);
    assert.equal((await fetch(origin + '/api/v1/catalog', { method: 'DELETE' })).status, 405);
    assert.equal((await fetch(origin + '/', { method: 'POST' })).status, 405);
    assert.equal((await post({ productId: 'tes-a' }, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await post({ productId: 'tes-a' }, { Origin: origin })).status, 200);
    assert.equal((await post({ productId: 'tes-a' }, { Origin: 'null' })).status, 403);
    const head = await fetch(origin + '/', { method: 'HEAD' });
    assert.equal(head.status, 200); assert.equal(await head.text(), '');
});

test('configured public HTTPS origin is accepted behind a proxy', async t => {
    const { post } = await setup(t, { publicOrigin: 'https://shop.example' });
    assert.equal((await post({ productId: 'tes-a' }, { Origin: 'https://shop.example' })).status, 200);
});

test('bounded rate limit cannot be bypassed with forwarded-for headers', async t => {
    const { post } = await setup(t, { rateLimit: 1 });
    assert.equal((await post({ productId: 'tes-a' })).status, 200);
    const blocked = await post({ productId: 'tes-a' }, { 'X-Forwarded-For': '1.2.3.4' });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get('retry-after'), '60');
});

test('invalid catalog schema, duplicate ids, unsafe prices and oversized files fail closed', async t => {
    const { write, get } = await setup(t);
    for (const mutate of [
        d => { d.schemaVersion = 2; }, d => { d.products.push({ ...d.products[0] }); },
        d => { d.products[0].price = -1; }, d => { d.products[0].price = 0.1; },
        d => { d.products[0].price = Number.MAX_SAFE_INTEGER; },
        d => { d.products[0].available = 'yes'; }, d => { d.products[0].id = '../secret'; },
    ]) {
        const data = fixture(); mutate(data); await write(data);
        assert.equal((await get('/api/v1/catalog')).status, 503);
    }
    await write(' '.repeat(256 * 1024 + 1));
    assert.equal((await get('/api/v1/catalog')).status, 503);
    assert.doesNotThrow(() => validateCatalog({ ...fixture(), products: [] }));
});

test('legacy products command uses the shared catalog and keeps aliases', async () => {
    const command = require('../src/commands/products');
    const catalog = await createCatalogService().getCatalog();
    let response;
    assert.equal(await command.execute({ reply: async value => { response = value; } }), true);
    assert.ok(command.aliases.includes('harga'));
    for (const product of catalog.products) assert.ok(response.text.includes(product.name));
    assert.match(response.text, /10[.]000/);
});

test('environment validation, disabled mode, and free catalog items', async () => {
    assert.equal(startShopServer({ SHOP_ENABLED: '0' }), null);
    assert.throws(() => startShopServer({ SHOP_PORT: 'bad' }));
    assert.throws(() => startShopServer({ SHOP_PORT: '70000' }));
    assert.throws(() => startShopServer({ SHOP_RATE_LIMIT: '-1' }));
    assert.throws(() => startShopServer({ SHOP_PUBLIC_URL: 'http://shop.example' }));
    assert.throws(() => startShopServer({ SHOP_PUBLIC_URL: 'https://shop.example/path' }));
    const data = fixture(); data.products[0].price = 0;
    assert.equal(validateCatalog(data).products[0].price, 0);
});
