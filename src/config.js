'use strict';

const { loadEnv } = require('./utils/env');
loadEnv();

function normalizeNumber(number) {
    const digits = String(number || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) return `62${digits.slice(1)}`;
    return digits;
}

function parseAdminNumbers(value = '') {
    const entries = String(value).split(',').map(item => item.trim()).filter(Boolean);
    const numbers = entries.map(entry => {
        const number = normalizeNumber(entry);
        if (!/^[+\d\s()-]+$/.test(entry) || !/^[1-9]\d{7,14}$/.test(number)) {
            throw new Error('ADMIN_NUMBERS tidak valid. Isi nomor telepon 8–15 digit, pisahkan dengan koma; jangan gunakan teks placeholder.');
        }
        return number;
    });
    return [...new Set(numbers)];
}

module.exports = {
    prefixes: ['!', '.', '/'],
    // Empty configuration grants admin access to nobody.
    adminNumbers: parseAdminNumbers(process.env.ADMIN_NUMBERS),
    normalizeNumber,
    parseAdminNumbers,
};
