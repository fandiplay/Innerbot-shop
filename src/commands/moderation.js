const { isGroupJid } = require('../utils/message');

async function ensureGroupAdmin(sock, remoteJid, senderNumbers = []) {
    const metadata = await sock.groupMetadata(remoteJid);
    const botIds = [sock.user?.id, sock.user?.lid]
        .filter(Boolean)
        .map((jid) => jid.split(':')[0].split('@')[0]);

    const bot = metadata.participants.find((p) => botIds.includes(p.id.split('@')[0]));
    const sender = metadata.participants.find((p) => senderNumbers.includes(p.id.split('@')[0]));

    return {
        botIsAdmin: Boolean(bot?.admin),
        senderIsAdmin: Boolean(sender?.admin),
    };
}

function getMentionedJids(msg, args) {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentioned.length) return mentioned;

    const number = args[0]?.replace(/\D/g, '');
    if (!number) return [];
    const normalized = number.startsWith('0') ? `62${number.slice(1)}` : number;
    return [`${normalized}@s.whatsapp.net`];
}

module.exports = [
    {
        name: 'kick',
        aliases: ['remove'],
        adminOnly: true,
        groupOnly: true,
        description: 'Mengeluarkan member grup. Format: !kick @member',
        async execute({ sock, msg, remoteJid, senderNumbers, args, reply }) {
            if (!isGroupJid(remoteJid)) return true;
            const { botIsAdmin } = await ensureGroupAdmin(sock, remoteJid, senderNumbers);
            if (!botIsAdmin) {
                await reply({ text: '❌ Bot harus jadi admin grup dulu.' });
                return true;
            }

            const targets = getMentionedJids(msg, args);
            if (!targets.length) {
                await reply({ text: 'Tag member yang ingin dikeluarkan. Contoh: *!kick @member*' });
                return true;
            }

            await sock.groupParticipantsUpdate(remoteJid, targets, 'remove');
            await reply({ text: '✅ Member berhasil dikeluarkan.' });
            return true;
        },
    },
    {
        name: 'promote',
        aliases: ['promosi'],
        adminOnly: true,
        groupOnly: true,
        description: 'Menjadikan member sebagai admin. Format: !promote @member',
        async execute({ sock, msg, remoteJid, senderNumbers, args, reply }) {
            const { botIsAdmin } = await ensureGroupAdmin(sock, remoteJid, senderNumbers);
            if (!botIsAdmin) {
                await reply({ text: '❌ Bot harus jadi admin grup dulu.' });
                return true;
            }

            const targets = getMentionedJids(msg, args);
            if (!targets.length) {
                await reply({ text: 'Tag member yang ingin dijadikan admin. Contoh: *!promote @member*' });
                return true;
            }

            await sock.groupParticipantsUpdate(remoteJid, targets, 'promote');
            await reply({ text: '✅ Member berhasil dijadikan admin.' });
            return true;
        },
    },
    {
        name: 'demote',
        aliases: ['turunkan'],
        adminOnly: true,
        groupOnly: true,
        description: 'Menurunkan admin menjadi member. Format: !demote @member',
        async execute({ sock, msg, remoteJid, senderNumbers, args, reply }) {
            const { botIsAdmin } = await ensureGroupAdmin(sock, remoteJid, senderNumbers);
            if (!botIsAdmin) {
                await reply({ text: '❌ Bot harus jadi admin grup dulu.' });
                return true;
            }

            const targets = getMentionedJids(msg, args);
            if (!targets.length) {
                await reply({ text: 'Tag admin yang ingin diturunkan. Contoh: *!demote @member*' });
                return true;
            }

            await sock.groupParticipantsUpdate(remoteJid, targets, 'demote');
            await reply({ text: '✅ Admin berhasil diturunkan.' });
            return true;
        },
    },
];

