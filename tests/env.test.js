'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { loadEnv } = require('../src/utils/env');

async function fixture(t, content) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'inner-shop-env-'));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const file = path.join(directory, '.env');
    if (content !== undefined) await fs.writeFile(file, content);
    return { directory, file };
}

test('.env is optional and never grants implicit administrator access', async t => {
    const { file } = await fixture(t);
    const env = {};
    assert.equal(loadEnv({ file, env }), false);
    assert.deepEqual(env, {});
    const result = execFileSync(process.execPath, ['-e',
        "process.stdout.write(JSON.stringify(require('./src/config').adminNumbers))"], {
        cwd: path.join(__dirname, '..'), encoding: 'utf8', env: { ...process.env, ADMIN_NUMBERS: '' },
    });
    assert.deepEqual(JSON.parse(result), []);
});

test('comments, quoted values, CRLF and UTF-8 BOM parse without shell evaluation', async t => {
    const { file } = await fixture(t, '\uFEFF# example\r\nADMIN_NUMBERS=""\r\nSHOP_PORT=3456 # comment\r\nSHOP_HOST="127.0.0.1"\r\nSHOP_PUBLIC_URL="https://shop.example"\r\n');
    const env = {};
    assert.equal(loadEnv({ file, env }), true);
    assert.equal(env.SHOP_PORT, '3456');
    assert.equal(env.SHOP_HOST, '127.0.0.1');
    assert.equal(env.ADMIN_NUMBERS, '');
    assert.equal(env.SHOP_PUBLIC_URL, 'https://shop.example');
});

test('existing shell variables win; unrelated environment keys are ignored', async t => {
    const { file } = await fixture(t, 'SHOP_PORT=3456\nADMIN_NUMBERS=\nNODE_OPTIONS=--inspect\nPATH=/untrusted\n');
    const env = { SHOP_PORT: '4567' };
    loadEnv({ file, env });
    assert.equal(env.SHOP_PORT, '4567');
    assert.equal(env.NODE_OPTIONS, undefined);
    assert.equal(env.PATH, undefined);
});

test('loader uses repo root rather than the current working directory', async t => {
    const { directory } = await fixture(t, 'SHOP_PORT=4321\n');
    const utils = path.join(directory, 'src', 'utils');
    await fs.mkdir(utils, { recursive: true });
    await fs.copyFile(path.join(__dirname, '..', 'src', 'utils', 'env.js'), path.join(utils, 'env.js'));
    const script = `delete process.env.SHOP_PORT; require(${JSON.stringify(path.join(utils, 'env.js'))}).loadEnv(); process.stdout.write(process.env.SHOP_PORT);`;
    const result = execFileSync(process.execPath, ['-e', script], { cwd: os.tmpdir(), encoding: 'utf8' });
    assert.equal(result, '4321');
});

test('UTF-16 and oversized env files fail with a non-sensitive error', async t => {
    const { file } = await fixture(t, Buffer.from('SHOP_PORT=3456', 'utf16le'));
    assert.throws(() => loadEnv({ file, env: {} }), /UTF-8/);
    await fs.writeFile(file, 'x'.repeat(64 * 1024 + 1));
    assert.throws(() => loadEnv({ file, env: {} }), /64 KiB/);
});

test('admin list accepts international/local formatting and deduplicates synthetic fixtures', () => {
    const source = path.join(__dirname, '..', 'src', 'config.js');
    const script = `const { parseAdminNumbers } = require(${JSON.stringify(source)}); process.stdout.write(JSON.stringify(parseAdminNumbers('081000000000, +62 810-0000-0000, 628100000001')));`;
    const output = execFileSync(process.execPath, ['-e', script], { env: { ...process.env, ADMIN_NUMBERS: '' }, encoding: 'utf8' });
    assert.deepEqual(JSON.parse(output), ['6281000000000', '628100000001']);
});

test('invalid admin placeholders fail closed without exposing their value', () => {
    const source = path.join(__dirname, '..', 'src', 'config.js');
    const script = `const { parseAdminNumbers } = require(${JSON.stringify(source)}); for (const input of ['ISI_NOMOR_KAMU', '123', '628100000000abc']) { try { parseAdminNumbers(input); process.exit(1); } catch(error) { if(error.message.includes(input)) process.exit(2); } }`;
    execFileSync(process.execPath, ['-e', script], { env: { ...process.env, ADMIN_NUMBERS: '' } });
});

test('Git ignores real env/session files but allows the empty example template', async t => {
    const { directory } = await fixture(t);
    await fs.copyFile(path.join(__dirname, '..', '.gitignore'), path.join(directory, '.gitignore'));
    execFileSync('git', ['init', '-q'], { cwd: directory });
    for (const name of ['.env', '.env.local', 'auth_session/creds.json']) {
        execFileSync('git', ['check-ignore', '--no-index', name], { cwd: directory });
    }
    assert.throws(() => execFileSync('git', ['check-ignore', '--no-index', '.env.example'], { cwd: directory }), error => error.status === 1);
});
