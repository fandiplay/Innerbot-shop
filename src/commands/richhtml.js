// src/commands/richhtml.js
// Command: .send / !send — mengirim pesan rich HTML test
// (Fungsi yang sebelumnya berada di test-rich.js, sekarang dipindah ke sini
//  supaya bisa dipakai oleh index.js maupun test-rich.js)

/**
 * Mengirim rich HTML message menggunakan Baileys.
 * Menggunakan payload internal sehingga WhatsApp merender HTML dalam chat.
 *
 * @param {Object} socket - Socket Baileys aktif.
 * @param {string} jid - JID tujuan (mis. '1234567890@s.whatsapp.net').
 * @param {Object} options - Opsi pesan.
 * @param {string} options.id - Identitas unik grup pesan.
 * @param {string} options.title - Judul yang ditampilkan.
 * @param {string} options.html - String HTML mentah yang akan dirender.
 * @param {string} options.source - Sumber tepercaya untuk rendering engine.
 */
async function sendRichHtml(socket, jid, { id, title, html, source }) {
    const responseId = `${id}-${Date.now()}`;

    const payload = {
        response_id: responseId,
        sections: [{
            view_model: {
                primitive: {
                    __typename: 'GenAIaeacdsnwHtmlPrimitive',
                    payload: html,
                    trusted_sources: [source]
                },
                __typename: 'GenAISingleLayoutViewModel'
            }
        }]
    };

    await socket.relayMessage(jid, {
        messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
            botMetadata: {
                messageDisclaimerText: '',
                botResponseId: responseId
            }
        },
        botForwardedMessage: {
            message: {
                richResponseMessage: {
                    messageType: 1,
                    submessages: [{ messageType: 2, messageText: title }],
                    unifiedResponse: {
                        data: Buffer.from(JSON.stringify(payload)).toString('base64')
                    },
                    contextInfo: {
                        forwardingScore: 1,
                        isForwarded: true,
                        forwardedAiBotMessageInfo: { botJid: '867051314767696@bot' },
                        forwardOrigin: 4
                    }
                }
            }
        }
    }, {});
}

function buildTestHtml() {
    return `
        <div style="padding: 20px; font-family: sans-serif; background-color: #f0f4f8; border-radius: 10px; max-width: 300px; margin: auto; text-align: center; border: 1px solid #d1d5db;">
            <h2 style="color: #2563eb; margin-top: 0;">HTML Test Successful! 🎉</h2>
            <p style="color: #4b5563; font-size: 14px;">This is a test message sent via the new Baileys rich HTML feature.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">
            <div style="background-color: #10b981; color: white; padding: 10px; border-radius: 5px; font-weight: bold; cursor: pointer;">
                Click Me (Dummy Button)
            </div>
        </div>
    `.trim();
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

module.exports = {
    name: 'send',
    aliases: ['sendhtml', 'rich', 'html'],
    description: 'Mengirim pesan rich HTML test.',

    async execute({ sock, remoteJid, reply }) {
        try {
            await sendRichHtml(sock, remoteJid, {
                id: 'cmd-test-html',
                title: 'Test HTML Render',
                html: buildTestHtml(),
                source: 'testsource'
            });
            console.log('[✅] Rich HTML sent successfully.');
            return true;
        } catch (error) {
            console.error('[❌] Failed to send Rich HTML:', error?.message || error);
            await reply({ text: `❌ Gagal mengirim HTML: ${error?.message || 'unknown error'}` });
            return true;
        }
    },
    // Dipakai command shop. Tidak diekspos sebagai command terpisah di sini.
    sendRichHtml,
    escapeHtml,
};
