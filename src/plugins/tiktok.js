const { ssstik } = require("../lib/ssstik");

async function tiktokPlugin(sock, msg, remoteJid, textMessage) {
    if (!textMessage.includes('tiktok.com')) return false;

    console.log(`\n[📥] MENERIMA LINK TIKTOK: ${textMessage} dari ${remoteJid}`);
    await sock.sendMessage(remoteJid, { text: '⏳ Bentar, lagi gw download...' });
    
    console.log(`[🚀] Memulai proses scraping ke SSSTik...`);
    const data = await ssstik(textMessage.trim());
    
    if (!data) {
        console.log(`[❌] SCRAPER GAGAL: Data tidak ditemukan atau link tidak valid!`);
        await sock.sendMessage(remoteJid, { text: '❌ Gagal mengambil data TikTok. Pastikan link video lu valid!' });
        return true; 
    }

    console.log(`[📦] SCRAPER SUKSES: Tipe Konten -> ${data.type} | Author -> ${data.author}`);
    const captionInfo = `👤 *Author:* ${data.author}\n📝 *Caption:* ${data.caption}`;

    if (data.type === 'video' && data.download.noWatermark) {
        console.log(`[🎬] Mengirim file video tanpa watermark ke WhatsApp...`);
        await sock.sendMessage(remoteJid, { video: { url: data.download.noWatermark }, caption: captionInfo });
        console.log(`[✅] Video sukses dikirim.`);
    } else if (data.type === 'slide' && data.slides.length > 0) {
        console.log(`[📸] Mengirim ${data.slides.length} foto slide ke WhatsApp...`);
        await sock.sendMessage(remoteJid, { text: `${captionInfo}\n\n📦 *Jenis:* Slide Foto` });
        for (let slide of data.slides) {
            if (slide.downloadUrl) await sock.sendMessage(remoteJid, { image: { url: slide.downloadUrl } });
        }
        console.log(`[✅] Semua foto slide sukses dikirim.`);
    } else {
        console.log(`[⚠️] Konten terdeteksi tapi tidak didukung.`);
        await sock.sendMessage(remoteJid, { text: '❌ Konten tidak didukung atau link rusak.' });
    }
    return true;
}

module.exports = { tiktokPlugin };

