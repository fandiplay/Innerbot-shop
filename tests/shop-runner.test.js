'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

test('runner retries with bounded backoff and stops instead of respawning on SIGTERM', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'shop-keepalive.js'), 'utf8');
    const signals = new EventEmitter();
    const children = [];
    const timers = [];
    const logs = [];
    Object.assign(signals, { execPath: process.execPath, env: {} });
    const spawn = (_exec, args, options) => {
        assert.match(args[0], /shop\.js$/);
        assert.equal(options.stdio, 'inherit');
        const child = new EventEmitter();
        child.kills = [];
        child.kill = signal => { child.kills.push(signal); return true; };
        children.push(child);
        return child;
    };
    vm.runInNewContext(source, {
        require: name => name === 'node:child_process' ? { spawn }
            : name === './src/utils/env' ? { loadEnv() {} } : require(name),
        __dirname: path.join(__dirname, '..'), process: signals,
        console: { error: message => logs.push(message) },
        setTimeout: (fn, ms) => { const timer = { fn, ms, unref() {} }; timers.push(timer); return timer; },
        clearTimeout: timer => { if (timer) timer.cleared = true; },
    });
    assert.equal(children.length, 1);
    for (const expected of [2000, 4000, 8000, 16000, 32000, 60000, 60000]) {
        children.at(-1).emit('close', 1);
        const timer = timers.at(-1);
        assert.equal(timer.ms, expected);
        timer.fn();
    }
    const active = children.at(-1);
    const count = children.length;
    signals.emit('SIGTERM');
    assert.deepEqual(active.kills, ['SIGTERM']);
    active.emit('close', 0);
    assert.equal(children.length, count);
    assert.ok(timers.at(-1).cleared);
    assert.equal(logs.length, 7);
});

test('public page references existing assets and JavaScript IDs', () => {
    const root = path.join(__dirname, '..', 'src', 'shop', 'public');
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const script = fs.readFileSync(path.join(root, 'shop.js'), 'utf8');
    const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
    for (const match of script.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.has(match[1]), match[1]);
    for (const match of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)) assert.ok(fs.existsSync(path.join(root, match[1])));
    assert.doesNotMatch(script, /\.innerHTML\s*=/);
    assert.doesNotMatch(html, /\sonclick=/);
});
