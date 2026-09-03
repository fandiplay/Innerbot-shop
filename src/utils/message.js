const { normalizeNumber } = require('../config');

function getMessageText(message) {
    return (
        message?.conversation ||
        message?.extendedTextMessage?.text ||
        message?.imageMessage?.caption ||
        message?.videoMessage?.caption ||
        ''
    ).trim();
}

function unique(items) {
    return [...new Set(items.filter(Boolean))];
}

function numberFromJid(jid) {
    const value = String(jid || '');
    if (!value || value.endsWith('@g.us')) return '';
    return normalizeNumber(value.split('@')[0]);
}

function getSenderJids(msg) {
    return unique([
        // Baileys v7 sering mengirim participantAlt/remoteJidAlt untuk nomor asli,
        // sedangkan participant/remoteJid bisa berupa @lid.
        msg.key?.participantAlt,
        msg.key?.remoteJidAlt,
        msg.key?.participant,
        msg.key?.remoteJid,
        msg.message?.extendedTextMessage?.contextInfo?.participant,
        msg.message?.extendedTextMessage?.contextInfo?.participantAlt,
    ]);
}

async function getSenderNumbers(sock, msg) {
    const jids = getSenderJids(msg);
    const numbers = [];

    for (const jid of jids) {
        numbers.push(numberFromJid(jid));

        // Jika sender berupa @lid, coba mapping ke nomor telepon asli (@s.whatsapp.net).
        if (String(jid).endsWith('@lid')) {
            try {
                const pnJid = await sock.signalRepository?.lidMapping?.getPNForLID(jid);
                numbers.push(numberFromJid(pnJid));
            } catch (_) {}
        }
    }

    return unique(numbers);
}

async function getSenderNumber(sock, msg) {
    const numbers = await getSenderNumbers(sock, msg);
    return numbers[0] || '';
}

function isGroupJid(jid) {
    return String(jid || '').endsWith('@g.us');
}

module.exports = { getMessageText, getSenderNumber, getSenderNumbers, getSenderJids, isGroupJid };

