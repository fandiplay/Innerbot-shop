module.exports = {
  name: 'balas',
  aliases: ['reply'],
  adminOnly: true,
  description: 'Admin membalas pesan ke nomor tertentu. Format: !balas 628xxx isi pesan',
  async execute({ sock, remoteJid, args, reply }) {
    try {
      const targetRaw = args.shift();
      const text = args.join(' ').trim();

      if (!targetRaw || !text) {
        await reply({ text: 'Format salah. Contoh: *!balas 628123456789 Halo, pesanan kamu sedang diproses.*' });
        return true;
      }

      const cleaned = targetRaw.replace(/[^\d+]/g, '');

      let normalized = cleaned;
      if (normalized.startsWith('+62')) {
        normalized = normalized.slice(1);
      } else if (normalized.startsWith('0')) {
        normalized = `62${normalized.slice(1)}`;
      } else if (normalized.startsWith('8')) {
        normalized = `62${normalized}`;
      }

      if (!/^62\d{8,15}$/.test(normalized)) {
        await reply({ text: 'Nomor tidak valid. Pakai format Indonesia, misalnya 628123456789.' });
        return true;
      }

      const targetJid = `${normalized}@s.whatsapp.net`;

      await sock.sendMessage(targetJid, { text });
      await reply({ text: `✅ Pesan berhasil dikirim ke ${normalized}.` });

      return true;
    } catch (error) {
      await reply({ text: `❌ Gagal mengirim pesan: ${error.message || 'unknown error'}` });
      return true;
    }
  },
};

