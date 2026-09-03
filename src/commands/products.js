const { createCatalogService, formatPrice } = require('../shop/catalog');
const catalogService = createCatalogService();

function formatProducts(products) {
    return products
        .map((product, index) => `${index + 1}. *${product.name}*\n   Harga: ${formatPrice(product.price)}\n   ${product.description}${product.available ? '' : '\n   Sedang tidak tersedia'}`)
        .join('\n\n');
}

module.exports = {
  name: 'produk',
  aliases: ['listproduk', 'harga', 'price', 'list'],
  description: 'Menampilkan list produk dan harga.',
  async execute({ reply }) {
    let products;
    try {
      ({ products } = await catalogService.getCatalog());
    } catch (_) {
      await reply({ text: 'Katalog sedang diperbarui. Coba lagi sebentar.' });
      return true;
    }
    await reply({
      text: `🛒 *LIST PRODUK & HARGA*\n\n${products.length ? formatProducts(products) : 'Belum ada produk.'}\n\nKetik *order* atau hubungi admin untuk membeli.`,
    });
    return true;
  },
};
