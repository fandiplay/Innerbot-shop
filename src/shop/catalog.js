'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');

const DEFAULT_FILE = path.join(__dirname, 'catalog.json');
const MAX_BYTES = 256 * 1024;
const MAX_PRICE = 1_000_000_000_000;

class ShopError extends Error {
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

function invalid() {
    throw new Error('Format katalog tidak valid.');
}

function text(value, max) {
    if (typeof value !== 'string' || !value.trim() || value.length > max) invalid();
    return value.trim();
}

function validateCatalog(raw) {
    if (!raw || raw.schemaVersion !== 1 || raw.shop?.currency !== 'IDR') invalid();
    if (!Array.isArray(raw.products) || raw.products.length > 500) invalid();
    const ids = new Set();
    const products = raw.products.map(item => {
        if (!item || typeof item !== 'object') invalid();
        const id = text(item.id, 64);
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || ids.has(id)) invalid();
        ids.add(id);
        if (!Number.isSafeInteger(item.price) || item.price < 0 || item.price > MAX_PRICE) invalid();
        if (typeof item.available !== 'boolean') invalid();
        if (!Array.isArray(item.details) || item.details.length > 12) invalid();
        // Explicit public fields only; never serialize the original object.
        return {
            id, name: text(item.name, 100), price: item.price,
            description: text(item.description, 1000),
            details: item.details.map(detail => text(detail, 500)),
            available: item.available,
        };
    });
    return { schemaVersion: 1, shop: { name: text(raw.shop.name, 100), currency: 'IDR' }, products };
}

function createCatalogService(file = DEFAULT_FILE) {
    async function getCatalog() {
        let handle;
        try {
            handle = await fs.open(file, 'r');
            const stat = await handle.stat();
            if (!stat.isFile() || stat.size > MAX_BYTES) invalid();
            // Bounded read, including if an editor grows the file after stat().
            const buffer = Buffer.alloc(MAX_BYTES + 1);
            let length = 0;
            while (length < buffer.length) {
                const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
                if (!bytesRead) break;
                length += bytesRead;
            }
            if (length > MAX_BYTES) invalid();
            const catalog = validateCatalog(JSON.parse(buffer.toString('utf8', 0, length)));
            const revision = createHash('sha256').update(JSON.stringify(catalog)).digest('hex').slice(0, 16);
            return { ...catalog, revision };
        } catch (_) {
            // Fail closed: never serve an old price after an invalid edit.
            throw new ShopError(503, 'CATALOG_UNAVAILABLE', 'Katalog sedang diperbarui. Coba lagi sebentar.');
        } finally {
            if (handle) await handle.close().catch(() => {});
        }
    }

    async function quote(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input) ||
            Object.keys(input).some(key => !['productId', 'quantity'].includes(key)) ||
            typeof input.productId !== 'string' || input.productId.length > 64) {
            throw new ShopError(400, 'INVALID_SELECTION', 'Pilihan produk tidak valid.');
        }
        const quantity = input.quantity === undefined ? 1 : input.quantity;
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) {
            throw new ShopError(400, 'INVALID_QUANTITY', 'Jumlah harus berupa angka bulat 1–100.');
        }
        const catalog = await getCatalog();
        const product = catalog.products.find(item => item.id === input.productId);
        if (!product) throw new ShopError(404, 'PRODUCT_NOT_FOUND', 'Produk sudah tidak ada. Muat ulang katalog.');
        if (!product.available) throw new ShopError(409, 'PRODUCT_UNAVAILABLE', 'Produk ini sedang tidak tersedia.');
        return {
            product, quantity, unitPrice: product.price, total: product.price * quantity,
            currency: catalog.shop.currency, revision: catalog.revision,
            generatedAt: new Date().toISOString(),
            notice: 'Ini rincian harga, bukan pesanan atau bukti pembayaran. Harga dapat berubah.',
        };
    }

    return { getCatalog, quote };
}

function formatPrice(price) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(price);
}

module.exports = { createCatalogService, validateCatalog, formatPrice, ShopError };
