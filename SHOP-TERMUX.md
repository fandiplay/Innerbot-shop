# Inner Shop — panduan Termux

## Apa yang dibuat

Shop HTML yang membaca daftar produk dari proses Node di Termux. Pelanggan membuka
link shop, memilih **Buy**, lalu mendapat nama, deskripsi, detail, harga satuan,
jumlah, dan total produk di halaman yang sama. Tidak perlu mengetik perintah WA.

**Buy saat ini hanya mengambil rincian harga.** Tidak membuat pesanan, menagih
pembayaran, mengurangi stok, mengirim chat WA, atau mengirim barang otomatis.
Tidak ada database, akun pelanggan, riwayat pembelian, atau payment gateway.

Daftar awal mempertahankan tiga produk di repo: Produk A (10.000), Produk B
(25.000), dan Produk C (50.000). Ganti dengan produk asli sebelum dibagikan.

## Mulai cepat: bot dan shop sekaligus

Setelah patch terpasang, dari direktori bot:

```bash
node index.js
```

Buka **http://127.0.0.1:3000** di Chrome pada HP yang menjalankan Termux.
Jangan membuka file HTML langsung. Shop tidak menambah paket npm dan tidak
mengubah versi Baileys atau lockfile. Dependensi bot yang sudah ada tetap diperlukan
untuk `index.js`. Shop terpisah hanya memerlukan Node, tanpa `npm install`.

Saat koneksi WhatsApp reconnect, server shop tetap berjalan. Jika keseluruhan
proses `index.js` mati, keduanya berhenti; gunakan mode terpisah di bawah.

## Mode lebih tahan gangguan: dua sesi Termux

Hentikan proses bot lama terlebih dahulu agar tidak ada dua sesi WhatsApp.

Sesi 1, dari folder bot:

```bash
SHOP_ENABLED=0 node index.js
```

Sesi 2, dari folder bot yang sama:

```bash
node shop-keepalive.js
```

Runner menjalankan `shop.js` dan mencoba kembali jika proses shop berhenti,
dengan jeda bertahap 2–60 detik. Ctrl+C tetap menghentikannya. Bot dan shop membaca
file katalog yang sama, tetapi prosesnya terpisah: crash WhatsApp tidak menutup
shop. Jangan menjalankan `node shop.js` atau shop bawaan `index.js` pada port
yang sama secara bersamaan. Runner sengaja tidak menjalankan sesi WA kedua.

Ini bukan jaminan 24/7. Jika Android mematikan Termux, HP kehabisan daya,
atau jaringan/tunnel terputus, pelanggan tidak dapat mengaksesnya. Pengecualian
optimasi baterai dan wake lock membantu kondisi tertentu, bukan jaminan anti-kill.
Termux sendiri memperingatkan pembatasan proses di Android 12+:
[dokumentasi Termux](https://github.com/termux/termux-app#readme).
Alternatif pengelolaan proses adalah
[termux-services](https://github.com/termux/termux-services#readme).
Untuk kebutuhan operasional 24/7, kode shop dapat dipindah ke server Node yang selalu hidup;
kode HTML dan kontrak API tidak perlu diganti jika origin-nya tetap sama.

## Mengubah katalog tanpa restart

Satu sumber: **`src/shop/catalog.json`**. Ini file daftar biasa, bukan database.
Bot `!produk` dan web menggunakan pembaca file yang sama; tidak ada salinan harga
di HTML. Setelah disimpan dengan JSON valid, permintaan berikutnya membaca versi baru.
Web memperbarui daftar lewat **Muat ulang**, saat kembali ke tab setelah satu menit,
atau saat koneksi pulih. Setiap **Buy / Cek harga lagi** selalu meminta harga terbaru.
Tidak ada polling terus-menerus atau cache harga offline.

Contoh satu entri (di dalam array `products`):

```json
{
  "id": "paket-a",
  "name": "Paket A",
  "price": 15000,
  "description": "Deskripsi produk yang benar.",
  "details": ["Rincian pertama", "Ketentuan produk"],
  "available": true
}
```

- `id`: unik dan stabil, huruf kecil/angka dengan pemisah `-`. Maksimal 64 karakter.
- `name`: nama produk, maksimal 100 karakter.
- `price`: angka Rupiah bulat, tanpa `Rp` dan tanpa pemisah ribuan; 0–1.000.000.000.000.
- `description`: teks, maksimal 1.000 karakter.
- `details`: array teks, boleh kosong; maksimal 12 rincian, masing-masing 500 karakter.
- `available`: `false` menonaktifkan Buy; ini bukan penghitung stok otomatis.
- `shop.name`: nama toko; mata uang saat ini IDR.
- `schemaVersion`: tetap `1`. Maksimal 500 produk dan ukuran file 256 KiB.

Validasi file sebelum digunakan:

```bash
node -e "require('./src/shop/catalog').createCatalogService().getCatalog().then(c => console.log(c.products.length + ' produk valid')).catch(e => { console.error(e.message); process.exitCode = 1; })"
```

Sebaiknya simpan melalui editor yang mengganti file secara atomik. Jika JSON
rusak/sementara belum selesai ditulis, API memberi pesan katalog sedang diperbarui,
bukan menjual dengan harga lama. Setelah file diperbaiki, API pulih tanpa restart.

## Akses pelanggan di luar HP

`127.0.0.1` hanya menunjuk perangkat yang sedang membuka alamat tersebut.
Membagikan alamat itu ke pelanggan **tidak** menghubungkan mereka ke HP penjual.

Untuk pelanggan di internet, sediakan **alamat HTTPS publik** dari reverse proxy
atau tunnel yang meneruskan seluruh website ke `http://127.0.0.1:3000`.
Alamat dan konfigurasi tunnel belum disiapkan dalam paket ini. Domain dan layanan
dipilih pemilik; tidak ada token, akun, atau tunnel yang dibuat otomatis.

Setelah domain/tunnel tersedia, misalnya `https://shop.example.com` (contoh saja):

```bash
SHOP_PUBLIC_URL=https://shop.example.com node shop-keepalive.js
```

`SHOP_PUBLIC_URL` hanya menetapkan origin yang diizinkan, **bukan membuat tunnel**.
Pakai origin tanpa subpath. HTML dan API harus di origin yang sama. Hindari
menaruh HTML di GitHub Pages terpisah dari API karena akan memerlukan konfigurasi
lintas-origin tambahan. Jangan membuka seluruh folder bot dengan static server.

Untuk uji di Wi-Fi yang sama, jalankan shop dengan `SHOP_HOST=0.0.0.0`, lalu buka
alamat IP lokal HP penjual dari perangkat lain. Ini mengekspos shop ke jaringan lokal,
bukan internet, dan HTTP lokal tidak memberikan enkripsi.

## Pengaturan

Variabel diberikan lewat shell/runner; file `.env` tidak otomatis dibaca.

| Variabel | Default | Fungsi |
| --- | --- | --- |
| `SHOP_ENABLED` | aktif | `0` mematikan shop bawaan, terutama untuk mode terpisah |
| `SHOP_HOST` | `127.0.0.1` | Interface dengar; default cocok untuk tunnel lokal |
| `SHOP_PORT` | `3000` | Port 1–65535 |
| `SHOP_PUBLIC_URL` | kosong | Origin HTTPS publik yang memang sudah disiapkan |
| `SHOP_RATE_LIMIT` | `120` | Maksimum permintaan API per alamat socket per menit |

Di belakang tunnel/proxy lokal, pelanggan dapat berbagi satu alamat socket.
Jadi rate limit ini menjadi batas gabungan, bukan batas per pelanggan. Naikkan
secukupnya sesuai kapasitas HP dan gunakan pembatasan trafik di proxy untuk publik.
Header `X-Forwarded-For` sengaja tidak dipercaya begitu saja agar tidak mudah dipalsukan.
Rate limit dan 128 koneksi maksimum bukan perlindungan DDoS menyeluruh.

## Struktur dan kontrak yang dapat dikembangkan

| Bagian | Lokasi |
| --- | --- |
| Daftar produk | `src/shop/catalog.json` |
| Validasi, format harga, perhitungan rincian | `src/shop/catalog.js` |
| Server HTTP dan pembatasan akses | `src/shop/server.js` |
| HTML / CSS / interaksi | `src/shop/public/index.html`, `shop.css`, `shop.js` |
| Shop terpisah / runner | `shop.js`, `shop-keepalive.js` |
| Integrasi bot lama | `index.js`, `src/commands/products.js` |
| Pengujian | `tests/shop.test.js` |

`GET /api/v1/catalog` mengembalikan `{ apiVersion: 1, data: { shop, products, revision, schemaVersion } }`.

`POST /api/v1/quote` menerima JSON `{ "productId": "produk-a" }`; optional `quantity`
berupa integer 1–100 (UI saat ini memakai satu produk). Balasan `data` memuat
`product`, `quantity`, `unitPrice`, `total`, `currency`, `revision`, `generatedAt`, dan
`notice`. API menolak field lain, termasuk harga dari browser. `total` hanya harga
produk × jumlah, bukan kalkulasi pajak/ongkir/biaya pembayaran.

Kesalahan: `{ apiVersion: 1, error: { code, message } }`. Status 400 input salah,
403 origin ditolak, 404 produk/rute tidak ada, 409 produk tidak tersedia,
413 body terlalu besar, 415 bukan JSON, 429 batas trafik, dan 503 katalog tidak valid.

Gunakan ID stabil; tambahan field publik harus melewati validasi dan allowlist.
Perubahan kontrak yang memutus klien lama sebaiknya masuk `/api/v2`, bukan diam-diam
mengganti makna `/api/v1`. Jika suatu saat ada checkout, validasi harga lagi saat
pesanan dibuat, tambahkan penyimpanan pesanan serta verifikasi pembayaran di server.
Rincian harga saat ini tidak menjamin reservasi barang atau mengunci harga.

## Batas keamanan dan pengujian

Hanya tiga asset publik yang disajikan. `auth_session`, `.env`, source bot,
dan katalog mentah tidak dibuka sebagai static file. Response API memakai field
publik yang diizinkan, header no-store, CSP tanpa script inline, body maksimum 4 KiB,
timeout request, serta batas trafik. Teks katalog di DOM ditulis memakai
`textContent`, bukan dieksekusi sebagai HTML. Tidak ada endpoint menulis katalog,
menjalankan perintah, atau mengirim pesan WhatsApp dari browser.

Prinsip timeout menggunakan [HTTP bawaan Node](https://nodejs.org/api/http.html).
Paket shop ditulis memakai API yang ada pada Node 18.2+, tetapi hanya diuji di
Node 24.19.0 pada lingkungan pengerjaan; gunakan rilis Node yang masih didukung
dan kompatibel dengan Baileys di perangkatmu.

Jalankan tanpa menghubungkan WhatsApp:

```bash
node --test tests/shop.test.js tests/shop-runner.test.js
```

Pengujian mencakup harga dari server, update katalog saat hidup, input harga palsu,
produk hilang/nonaktif, JSON rusak/oversize, jalur file rahasia, method/origin,
rate limit, output perintah produk lama, restart runner, dan referensi asset HTML.
Seluruh 15 pengujian lulus di lingkungan pengerjaan. Tidak memerlukan pairing atau sesi WA.
Uji browser Android dan tunnel publik tetap perlu dilakukan pada perangkat pemilik.
