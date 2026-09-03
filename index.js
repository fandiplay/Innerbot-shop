const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    Browsers,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const readline = require("readline");
const { tiktokPlugin } = require("./src/plugins/tiktok");
const commandHandler = require("./src/commands");
const { startShopServer } = require('./src/shop/server');

// Start only once, outside the WhatsApp reconnect lifecycle.
let shopServer = null;
try {
    shopServer = startShopServer();
} catch (error) {
    console.error('[SHOP]', error.message);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

let isStarting = false;
let currentSock = null;
let isConnected = false;
let reconnectAttempts = 0;
let reconnectTimer = null;
let bootGeneration = 0;
const MAX_RECONNECT_DELAY = 60_000;

function normalizePhoneNumber(phoneNumber) {
    const digits = String(phoneNumber || '').replace(/\D/g, '');
    if (digits.startsWith('0')) return `62${digits.slice(1)}`;
    return digits;
}

function cleanupSock(sock) {
    if (!sock) return;
    try { sock.ev.removeAllListeners(); } catch (_) {}
    try { sock.ws?.close(); } catch (_) {}
    try { sock.end?.(new Error('cleanup')); } catch (_) {}
}

function scheduleReconnect(label) {
    if (reconnectTimer) clearTimeout(reconnectTimer);

    reconnectAttempts++;
    const delay = Math.min(3000 * reconnectAttempts, MAX_RECONNECT_DELAY);

    console.log(`↻ Reconnect dijadwalkan (${label}) dalam ${delay}ms...`);

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        startBot().catch((err) => {
            console.error('[RECONNECT]', err?.message || err);
            scheduleReconnect('retry-failed');
        });
    }, delay);
}

async function startBot() {
    if (isStarting) return;
    isStarting = true;

    const myGen = ++bootGeneration;

    if (currentSock) {
        cleanupSock(currentSock);
        currentSock = null;
    }

    isConnected = false;

    const { state, saveCreds } = await useMultiFileAuthState('auth_session');
    if (myGen !== bootGeneration) {
        isStarting = false;
        return;
    }

    const { version } = await fetchLatestBaileysVersion();
    if (myGen !== bootGeneration) {
        isStarting = false;
        return;
    }

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        markOnlineOnConnect: false,
        connectTimeoutMs: 60_000,
        keepAliveIntervalMs: 30_000,
        retryRequestDelayMs: 500,
    });

    currentSock = sock;
    isStarting = false;

    let pairingTimer;

    if (!sock.authState.creds.registered) {
        const phoneNumber = normalizePhoneNumber(await question('Masukkan nomor WhatsApp (Format: 628xxx): '));

        pairingTimer = setTimeout(async () => {
            try {
                if (!phoneNumber) throw new Error('Nomor WhatsApp kosong/tidak valid');
                const code = await sock.requestPairingCode(phoneNumber);
                console.log(`\n🚀 KODE PAIRING LU: ${code}\n`);
            } catch (error) {
                console.error('\n❌ Gagal mengambil kode pairing:', error?.message || error);
                console.log('Tips: pastikan internet stabil, nomor format 628xxx, lalu jalankan ulang. Jika tetap error, hapus folder auth_session dan pairing ulang.\n');
            }
        }, 5000);
    }

    sock.ev.on('connection.update', (update) => {
        if (sock !== currentSock) return;

        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            isConnected = true;
            reconnectAttempts = 0;
            if (pairingTimer) clearTimeout(pairingTimer);
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            console.log('✅ Bot WhatsApp Modular Aktif!');
            return;
        }

        if (connection === 'close') {
            isConnected = false;
            if (pairingTimer) clearTimeout(pairingTimer);

            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const reason = lastDisconnect?.error?.message || 'Unknown reason';
            const isConflict = statusCode === 440 || /conflict/i.test(reason);
            const isRestart = statusCode === DisconnectReason.restartRequired || statusCode === 515 || /restart/i.test(reason);
            const isLoggedOut = statusCode === DisconnectReason.loggedOut;

            cleanupSock(sock);
            if (currentSock === sock) currentSock = null;

            if (isLoggedOut) {
                console.log('❌ Session logout/rusak. Hapus folder auth_session lalu pairing ulang.');
                return;
            }

            if (isConflict) {
                console.log(`⚠️ Koneksi tertutup: ${reason} (${statusCode || '-'}) — conflict, reconnect...`);
                scheduleReconnect('conflict');
                return;
            }

            if (isRestart) {
                console.log(`⚠️ Koneksi tertutup: ${reason} (${statusCode || '-'}) — restart total...`);
                scheduleReconnect('restart');
                return;
            }

            console.log(`⚠️ Koneksi tertutup: ${reason} (${statusCode || '-'}) — reconnect...`);
            scheduleReconnect('close');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        try {
            if (!isConnected || sock !== currentSock) return;

            const msg = m.messages?.[0];
            if (!msg?.message || msg.key?.fromMe) return;

            const remoteJid = msg.key.remoteJid;

            const rawMessage = (
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                msg.message.imageMessage?.caption ||
                msg.message.videoMessage?.caption ||
                ''
            ).trim();

            const handledCommand = await commandHandler.handle(sock, msg);
            if (handledCommand) return;

            if (!isConnected || sock !== currentSock) return;

            if (rawMessage.toLowerCase() === 'ping') {
                return await sock.sendMessage(remoteJid, { text: 'pong 🏓' }, { quoted: msg });
            }

            if (['halo', 'hai', 'hi'].includes(rawMessage.toLowerCase())) {
                return await sock.sendMessage(remoteJid, { text: 'Halo! Ketik *!menu* untuk melihat daftar perintah.' }, { quoted: msg });
            }

            if (['produk', 'harga', 'list produk'].includes(rawMessage.toLowerCase())) {
                return await sock.sendMessage(remoteJid, { text: 'Ketik *!produk* untuk melihat list produk dan harga.' }, { quoted: msg });
            }

            await tiktokPlugin(sock, msg, remoteJid, rawMessage);
        } catch (error) {
            console.error('[❌] Error saat memproses pesan:', error?.message || error);
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

process.on('SIGINT', async () => {
    try {
        shopServer?.close();
        if (reconnectTimer) clearTimeout(reconnectTimer);
        cleanupSock(currentSock);
    } finally {
        process.exit(0);
    }
});

startBot().catch((err) => {
    console.error('[FATAL]', err?.message || err);
    scheduleReconnect('boot-failed');
});
