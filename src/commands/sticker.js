const { execFile } = require('child_process');
const { writeFile, unlink } = require('fs/promises');
const { tmpdir } = require('os');
const { join } = require('path');
const { randomBytes } = require('crypto');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { Image } = require('node-webpmux');

function buildExif(packname, author, categories = ['']) {
    const stickerPackId = randomBytes(32).toString('hex');
    const json = {
        'sticker-pack-id': stickerPackId,
        'sticker-pack-name': packname,
        'sticker-pack-publisher': author,
        emojis: categories
    };

    const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');

    const exifAttr = Buffer.from([
        0x49, 0x49, 0x2A, 0x00,
        0x08, 0x00, 0x00, 0x00,
        0x01, 0x00,
        0x41, 0x57, 0x07, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x16, 0x00, 0x00, 0x00
    ]);

    const exif = Buffer.concat([exifAttr, jsonBuffer]);
    exif.writeUIntLE(jsonBuffer.length, 14, 4);

    return exif;
}

async function toStickerWebp(inputPath, packname, author) {
    const tmpWebp = join(tmpdir(), `stkr_${randomBytes(4).toString('hex')}.webp`);

    await new Promise((resolve, reject) => {
        execFile(
            'cwebp',
            ['-q', '80', '-resize', '512', '512', inputPath, '-o', tmpWebp],
            (err) => (err ? reject(err) : resolve())
        );
    });

    const exifBuf = buildExif(packname, author, ['']);

    const img = new Image();
    await img.load(tmpWebp);
    img.exif = exifBuf;

    const result = await img.save(null);

    await unlink(tmpWebp).catch(() => {});
    return result;
}

module.exports = {
    name: 'sticker',
    aliases: ['s', 'stiker'],
    description: 'Ubah gambar jadi stiker WhatsApp. Kirim gambar dengan caption !sticker atau reply gambar dengan !sticker.',

    async execute({ sock, msg, remoteJid, reply }) {
        const imageMsg = msg.message?.imageMessage;
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        const quotedImageMsg = contextInfo?.quotedMessage?.imageMessage;

        if (!imageMsg && !quotedImageMsg) {
            await reply({ text: '❌ Kirim/reply gambar dengan caption *!sticker*' });
            return true;
        }

        const downloadMsg = imageMsg
            ? msg
            : {
                key: {
                    ...msg.key,
                    id: contextInfo.stanzaId,
                    participant: contextInfo.participant,
                },
                message: contextInfo.quotedMessage,
            };

        const buffer = await downloadMediaMessage(downloadMsg, 'buffer', {}, sock);
        if (!buffer) {
            await reply({ text: '❌ Gagal mengunduh gambar.' });
            return true;
        }

        const tmpInput = join(tmpdir(), `sticker_in_${randomBytes(4).toString('hex')}`);
        await writeFile(tmpInput, buffer);

        try {
            const webpBuffer = await toStickerWebp(tmpInput, 'my bot', 'tokocoding');
            await reply({ sticker: webpBuffer });
        } catch (err) {
            console.error('[STICKER]', err);
            await reply({ text: '❌ Gagal mengkonversi gambar ke stiker.' });
        } finally {
            await unlink(tmpInput).catch(() => {});
        }

        return true;
    },
};

