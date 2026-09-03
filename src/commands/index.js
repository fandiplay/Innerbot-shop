const { prefixes, adminNumbers } = require('../config');
const { getMessageText, getSenderNumbers, isGroupJid } = require('../utils/message');

const shopModule = require('./shop');

const commandModules = [
    require('./help'),
    require('./products'),
    require('./reply'),
    require('./sticker'),
    require('./richhtml'),
    shopModule,
    shopModule.buyCommand,
    ...require('./moderation'),
];

class CommandHandler {
    constructor(commands) {
        this.commands = new Map();
        commands.forEach((command) => this.register(command));
    }

    register(command) {
        const names = [command.name, ...(command.aliases || [])];
        names.forEach((name) => this.commands.set(name.toLowerCase(), command));
    }

    getCommands() {
        return [...new Set(this.commands.values())];
    }

    async handle(sock, msg) {
        const remoteJid = msg.key.remoteJid;
        const rawMessage = getMessageText(msg.message);
        if (!rawMessage) return false;

        const prefix = prefixes.find((item) => rawMessage.startsWith(item));
        if (!prefix) return false;

        const [commandName, ...args] = rawMessage.slice(prefix.length).trim().split(/\s+/);
        const command = this.commands.get((commandName || '').toLowerCase());
        if (!command) return false;

        const senderNumbers = await getSenderNumbers(sock, msg);
        const senderNumber = senderNumbers[0] || '';
        const isAdmin = senderNumbers.some((number) => adminNumbers.includes(number));

        if (command.adminOnly && !isAdmin) {
            console.log(`[ADMIN FILTER] Ditolak. Sender terdeteksi: ${senderNumbers.join(', ') || '-'} | Admin: ${adminNumbers.join(', ')}`);
            await sock.sendMessage(remoteJid, { text: '❌ Perintah ini khusus admin bot.' }, { quoted: msg });
            return true;
        }

        if (command.groupOnly && !isGroupJid(remoteJid)) {
            await sock.sendMessage(remoteJid, { text: '❌ Perintah ini hanya bisa dipakai di grup.' }, { quoted: msg });
            return true;
        }

        try {
            const reply = (content) => sock.sendMessage(remoteJid, content, { quoted: msg });
            return await command.execute({
                sock,
                msg,
                remoteJid,
                rawMessage,
                args,
                senderNumber,
                senderNumbers,
                isAdmin,
                commandHandler: this,
                reply,
            });
        } catch (error) {
            console.error(`[❌] Command error (${commandName}):`, error);
            await sock.sendMessage(remoteJid, { text: '❌ Terjadi error saat menjalankan perintah.' }, { quoted: msg });
            return true;
        }
    }
}

module.exports = new CommandHandler(commandModules);
