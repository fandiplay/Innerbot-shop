'use strict';

(() => {
    const $ = id => document.getElementById(id);
    const grid = $('products');
    const dialog = $('quote-dialog');
    let catalog = null;
    let selectedId = null;
    let catalogBusy = false;
    let lastLoaded = 0;
    let quoteController = null;
    let quoteSequence = 0;

    const money = value => new Intl.NumberFormat('id-ID', {
        style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
    }).format(value);
    const clock = value => new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(new Date(value));
    const initial = name => Array.from(name.trim()).slice(0, 1).join('').toUpperCase();
    const element = (tag, className, content) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (content !== undefined) node.textContent = content;
        return node;
    };

    async function request(path, { signal, ...options } = {}) {
        const controller = new AbortController();
        const abort = () => controller.abort();
        if (signal?.aborted) controller.abort();
        signal?.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(abort, 12_000);
        try {
            const response = await fetch(path, {
                ...options, cache: 'no-store', credentials: 'omit', signal: controller.signal,
                headers: { Accept: 'application/json', ...options.headers },
            });
            let payload;
            try { payload = await response.json(); }
            catch (_) { throw new Error('Respons shop tidak valid. Buka alamat server shop, bukan file HTML langsung.'); }
            if (!response.ok) throw new Error(payload.error?.message || 'Shop belum dapat diakses. Coba lagi.');
            if (payload.apiVersion !== 1 || !payload.data) throw new Error('Versi shop berubah. Muat ulang halaman.');
            return payload.data;
        } catch (error) {
            if (signal?.aborted) throw error;
            if (error.name === 'AbortError' || error instanceof TypeError) {
                throw new Error('Tidak terhubung ke shop. Periksa koneksi atau coba lagi setelah server aktif.');
            }
            throw error;
        } finally {
            clearTimeout(timer);
            signal?.removeEventListener('abort', abort);
        }
    }

    function renderProducts() {
        grid.replaceChildren();
        for (const product of catalog.products) {
            const article = element('article', 'product');
            const top = element('div', 'product-top');
            const letter = element('span', 'product-initial', initial(product.name));
            letter.setAttribute('aria-hidden', 'true');
            top.append(letter, element('span', `availability${product.available ? '' : ' unavailable'}`, product.available ? 'Tersedia' : 'Tidak tersedia'));
            const row = element('div', 'price-row');
            const amount = element('div');
            amount.append(element('p', 'price-label', 'Harga produk'), element('p', 'price', money(product.price)));
            const buy = element('button', 'buy');
            buy.type = 'button';
            buy.disabled = !product.available;
            buy.setAttribute('aria-label', `Buy ${product.name}, lihat rincian harga`);
            const arrow = element('span', '', '↗');
            arrow.setAttribute('aria-hidden', 'true');
            buy.append(element('span', '', 'Buy'), arrow);
            buy.addEventListener('click', () => openQuote(product.id));
            row.append(amount, buy);
            article.append(top, element('p', 'sku', product.id), element('h3', '', product.name), element('p', 'description', product.description), row);
            grid.append(article);
        }
        $('product-count').textContent = String(catalog.products.length);
    }

    async function loadCatalog() {
        if (catalogBusy) return;
        catalogBusy = true;
        $('refresh').disabled = true;
        grid.setAttribute('aria-busy', 'true');
        $('sync-status').textContent = 'Memperbarui katalog…';
        const message = $('catalog-message');
        try {
            catalog = await request('/api/v1/catalog');
            if (!Array.isArray(catalog.products) || !catalog.shop) throw new Error('Katalog tidak valid. Coba lagi.');
            $('shop-name').textContent = catalog.shop.name;
            $('footer-name').textContent = catalog.shop.name;
            document.title = catalog.shop.name;
            renderProducts();
            grid.hidden = false;
            message.className = 'message';
            message.textContent = 'Belum ada produk. Silakan kembali nanti.';
            message.hidden = catalog.products.length > 0;
            lastLoaded = Date.now();
            $('sync-status').textContent = `Diperbarui ${clock(lastLoaded)}`;
        } catch (error) {
            grid.hidden = true;
            message.hidden = false;
            message.className = 'message error';
            message.textContent = error.message;
            $('sync-status').textContent = 'Katalog belum dapat diperbarui';
            $('product-count').textContent = '';
        } finally {
            catalogBusy = false;
            $('refresh').disabled = false;
            grid.setAttribute('aria-busy', 'false');
        }
    }

    async function openQuote(id) {
        selectedId = id;
        quoteController?.abort();
        quoteController = new AbortController();
        const controller = quoteController;
        const sequence = ++quoteSequence;
        const displayedPrice = catalog?.products.find(item => item.id === id)?.price;
        $('quote-result').hidden = true;
        $('retry-quote').hidden = true;
        $('refresh-quote').hidden = true;
        const message = $('quote-message');
        message.hidden = false;
        message.className = 'message';
        message.textContent = 'Mengambil rincian harga terbaru…';
        if (!dialog.open) dialog.showModal();
        try {
            const quote = await request('/api/v1/quote', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId: id }), signal: controller.signal,
            });
            if (sequence !== quoteSequence || !dialog.open) return;
            const product = quote.product;
            $('quote-product').textContent = product.name;
            $('quote-initial').textContent = initial(product.name);
            $('quote-id').textContent = product.id;
            $('quote-description').textContent = product.description;
            $('quote-details').replaceChildren(...product.details.map(detail => element('li', '', detail)));
            $('quote-details').hidden = product.details.length === 0;
            $('quote-unit').textContent = money(quote.unitPrice);
            $('quote-quantity').textContent = `${quote.quantity} produk`;
            $('quote-total').textContent = money(quote.total);
            $('quote-time').textContent = `Harga diperiksa ${clock(quote.generatedAt)}`;
            $('quote-notice').textContent = quote.notice;
            $('price-change').hidden = displayedPrice === undefined || displayedPrice === quote.unitPrice;
            message.hidden = true;
            $('quote-result').hidden = false;
            $('refresh-quote').hidden = false;
            if (catalog && quote.revision !== catalog.revision) void loadCatalog();
        } catch (error) {
            if (controller.signal.aborted || sequence !== quoteSequence || !dialog.open) return;
            message.className = 'message error';
            message.textContent = error.message;
            $('retry-quote').hidden = false;
        }
    }

    function closeQuote() {
        ++quoteSequence;
        quoteController?.abort();
        dialog.close();
    }
    $('refresh').addEventListener('click', loadCatalog);
    $('close-quote').addEventListener('click', closeQuote);
    $('back-quote').addEventListener('click', closeQuote);
    $('retry-quote').addEventListener('click', () => openQuote(selectedId));
    $('refresh-quote').addEventListener('click', () => openQuote(selectedId));
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeQuote(); });
    dialog.addEventListener('click', event => {
        const rect = dialog.getBoundingClientRect();
        if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) closeQuote();
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && Date.now() - lastLoaded > 60_000) void loadCatalog();
    });
    window.addEventListener('online', () => void loadCatalog());
    if (location.protocol === 'file:') {
        $('catalog-message').textContent = 'Jalankan node index.js atau node shop.js di Termux, lalu buka http://127.0.0.1:3000. File HTML tidak bisa terhubung jika dibuka langsung.';
        $('catalog-message').className = 'message error';
        $('sync-status').textContent = 'Buka melalui server shop';
        grid.setAttribute('aria-busy', 'false');
        $('refresh').disabled = true;
    } else {
        void loadCatalog();
    }
})();
