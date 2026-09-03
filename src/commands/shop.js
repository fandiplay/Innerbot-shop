'use strict';

const { createCatalogService, formatPrice } = require('../shop/catalog');
const richHtml = require('./richhtml');

const catalogService = createCatalogService();
const MAX_PRODUCTS_IN_MESSAGE = 12;

function botNumber(sock) {
    return String(sock.user?.id || '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

function commandLink(sock, command) {
    const number = botNumber(sock);
    // A link can prefill a WhatsApp message, but WhatsApp requires the buyer to
    // tap Send. Rich HTML is not allowed to execute JavaScript or send a chat
    // command on the buyer's behalf.
    return number ? `https://wa.me/${number}?text=${encodeURIComponent(command)}` : '';
}

function actionLink(url, label, disabled = false) {
    const style = disabled
        ? 'display:block;background:#94a3b8;color:#fff;padding:11px 12px;border-radius:8px;text-align:center;font-weight:700;text-decoration:none;'
        : 'display:block;background:#16a34a;color:#fff;padding:11px 12px;border-radius:8px;text-align:center;font-weight:700;text-decoration:none;';
    return url
        ? `<a href="${url}" style="${style}">${label}</a>`
        : `<div style="${style}">${label}</div>`;
}

function buildShopHtml(shop, products, sock) {
    const visible = products.slice(0, MAX_PRODUCTS_IN_MESSAGE);
    const cards = visible.map((product, index) => {
        const name = richHtml.escapeHtml(product.name);
        const description = richHtml.escapeHtml(product.description);
        const details = product.details.slice(0, 4)
            .map(item => `<li style="margin:3px 0;">${richHtml.escapeHtml(item)}</li>`).join('');
        const link = product.available ? commandLink(sock, `!buy ${product.id}`) : '';
        return `<div style="background:#fff;border:1px solid #dbe3ee;border-radius:12px;padding:14px;margin:12px 0;">
            <div style="font-size:12px;color:#64748b;font-weight:700;">PRODUK ${index + 1}</div>
            <div style="font-size:18px;color:#0f172a;font-weight:800;margin:3px 0;">${name}</div>
            <div style="font-size:17px;color:#15803d;font-weight:800;margin:4px 0 8px;">${formatPrice(product.price)}</div>
            <div style="font-size:13px;color:#475569;margin-bottom:8px;">${description}</div>
            ${details ? `<ul style="font-size:12px;color:#475569;padding-left:18px;margin:0 0 12px;">${details}</ul>` : ''}
            ${actionLink(link, product.available ? 'Beli — buka chat bot' : 'Stok tidak tersedia', !product.available)}
        </div>`;
    }).join('');
    const overflow = products.length > visible.length
        ? `<p style="font-size:12px;color:#64748b;">Menampilkan ${visible.length} dari ${products.length} produk. Kurangi katalog atau gunakan kategori bila produk sudah banyak.</p>`
        : '';
    return `<div style="font-family:Arial,sans-serif;background:#f1f5f9;padding:16px;border-radius:14px;max-width:340px;margin:auto;">
        <div style="background:#0f766e;color:#fff;padding:16px;border-radius:11px;text-align:center;">
            <div style="font-size:22px;font-weight:800;">${richHtml.escapeHtml(shop.name)}</div>
            <div style="font-size:13px;margin-top:4px;">Pilih produk, lalu tekan tombol Beli</div>
        </div>
        ${cards || '<p style="color:#475569;">Belum ada produk yang dijual.</p>'}
        ${overflow}
        <p style="font-size:11px;color:#64748b;text-align:center;margin:12px 0 0;">Harga dan rincian dikirim bot setelah permintaan beli diterima.</p>
    </div>`;
}

function buildQuoteHtml(shop, quote, sock) {
    const details = quote.product.details.map(item => `<li style="margin:4px 0;">${richHtml.escapeHtml(item)}</li>`).join('');
    const back = commandLink(sock, '!shop');
    return `<div style="font-family:Arial,sans-serif;background:#f1f5f9;padding:16px;border-radius:14px;max-width:340px;margin:auto;">
        <div style="background:#16a34a;color:#fff;padding:16px;border-radius:11px;text-align:center;">
            <div style="font-size:20px;font-weight:800;">Rincian Pembelian</div>
            <div style="font-size:12px;margin-top:4px;">Silakan lanjutkan pembayaran ke admin</div>
        </div>
        <div style="background:#fff;border:1px solid #dbe3ee;border-radius:12px;padding:14px;margin-top:12px;color:#0f172a;">
            <div style="font-size:18px;font-weight:800;">${richHtml.escapeHtml(quote.product.name)}</div>
            <div style="font-size:13px;color:#475569;margin:6px 0 10px;">${richHtml.escapeHtml(quote.product.description)}</div>
            ${details ? `<ul style="font-size:12px;color:#475569;padding-left:18px;margin:0 0 12px;">${details}</ul>` : ''}
            <div style="border-top:1px solid #e2e8f0;padding-top:10px;font-size:14px;">Harga: <b>${formatPrice(quote.unitPrice)}</b></div>
            <div style="font-size:18px;color:#15803d;font-weight:800;margin-top:5px;">Total: ${formatPrice(quote.total)}</div>
        </div>
        ${actionLink(back, 'Kembali ke katalog')}
        <p style="font-size:11px;color:#64748b;text-align:center;margin:12px 0 0;">Ini rincian harga, belum menjadi pesanan atau pembayaran.</p>
    </div>`;
}

module.exports = {
    name: 'shop',
    aliases: ['store', 'katalog'],
    description: 'Menampilkan katalog shop HTML di WhatsApp.',

    async execute({ sock, remoteJid, reply }) {
        try {
            const catalog = await catalogService.getCatalog();
            await richHtml.sendRichHtml(sock, remoteJid, {
                id: 'shop-catalog', title: `${catalog.shop.name} — Katalog`,
                html: buildShopHtml(catalog.shop, catalog.products, sock), source: 'innerbot-shop',
            });
        } catch (error) {
            console.error('[SHOP] Gagal mengirim katalog:', error?.message || error);
            await reply({ text: '❌ Katalog sedang tidak dapat dibuka. Coba lagi sebentar.' });
        }
        return true;
    },
};

module.exports.buyCommand = {
    name: 'buy',
    aliases: ['beli'],
    description: 'Mengirim rincian harga produk dari shop.',

    async execute({ sock, remoteJid, args, reply }) {
        const productId = String(args[0] || '').toLowerCase();
        if (!productId) {
            await reply({ text: 'Pilih produk dari *!shop* terlebih dahulu.' });
            return true;
        }
        try {
            const catalog = await catalogService.getCatalog();
            const quote = await catalogService.quote({ productId });
            await richHtml.sendRichHtml(sock, remoteJid, {
                id: `shop-quote-${quote.product.id}`, title: `${catalog.shop.name} — Rincian Harga`,
                html: buildQuoteHtml(catalog.shop, quote, sock), source: 'innerbot-shop',
            });
        } catch (error) {
            const text = error?.code === 'PRODUCT_UNAVAILABLE'
                ? 'Produk ini sedang tidak tersedia.'
                : error?.code === 'PRODUCT_NOT_FOUND'
                    ? 'Produk tidak ditemukan. Buka *!shop* untuk memilih lagi.'
                    : '❌ Katalog sedang diperbarui. Coba lagi sebentar.';
            await reply({ text });
        }
        return true;
    },
};

module.exports._test = { botNumber, commandLink, buildShopHtml, buildQuoteHtml };
