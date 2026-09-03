# Innerbot Shop

Shop HTML ringan untuk membuka katalog dan rincian harga tanpa mengetik perintah
WhatsApp. Klik **Buy** untuk mengambil rincian terbaru dari server Node dan
menampilkannya di halaman yang sama.

**Tanpa database. Buy hanya menampilkan rincian, belum membuat pesanan atau pembayaran.**

## Langsung jalankan shop

Dengan Node terpasang, di Termux atau terminal komputer (fitur `.env` memerlukan
`util.parseEnv`, tersedia sejak Node 20.12; gunakan rilis Node yang masih didukung):

```bash
git clone https://github.com/fandiplay/Innerbot-shop.git
cd Innerbot-shop
node shop.js
```

Buka **http://127.0.0.1:3000** di browser pada perangkat yang menjalankan server.
Jangan membuka file HTML langsung. Shop standalone memakai modul bawaan Node,
sehingga **tidak perlu `npm install`**. Perintah `npm start` setara dengan `node shop.js`.

Kalau repo sudah ada, masuk ke folder repo tersebut dan periksa `git status`
sebelum `git pull --ff-only`. Simpan perubahan lokal terlebih dahulu jika diperlukan;
jangan memakai force/reset untuk menimpa editan sendiri.

Untuk restart otomatis saat proses shop berhenti:

```bash
node shop-keepalive.js
```

Pilih salah satu; jangan jalankan dua shop di port yang sama. Runner memakai
backoff 2–60 detik. Android tetap dapat mematikan Termux, sehingga ini bukan jaminan 24/7.

## Mengubah produk

Edit **`src/shop/catalog.json`**. Daftar ini dipakai oleh web dan perintah produk
bot **di repo ini**. Harga tidak disalin ke HTML dan selalu dibaca ulang saat Buy
ditekan. Perubahan JSON valid langsung terbaca tanpa restart.

```json
{
  "id": "paket-a",
  "name": "Paket A",
  "price": 15000,
  "description": "Deskripsi produk.",
  "details": ["Rincian produk", "Ketentuan pembelian"],
  "available": true
}
```

Masukkan entri di array `products`; harga berupa angka Rupiah tanpa titik atau `Rp`.
Pertahankan ID unik dan stabil. `available: false` menonaktifkan Buy, bukan menghitung stok.
Produk A/B/C bawaan adalah contoh yang diambil dari katalog sebelumnya; ganti sebelum dijual.

## Bot WhatsApp opsional

Modul bot pendukung disertakan agar `index.js` dapat dijalankan, bukan hanya salinan
sebagian file perubahan. Untuk mode bot, pasang dependensi yang dikunci dalam lockfile:

```bash
npm ci
node index.js
```

Perintah ini menyalakan bot **dan** shop. Salin `.env.example` menjadi `.env`, isi
`ADMIN_NUMBERS` dengan nomor milikmu, lalu ikuti pairing pada terminal. Jangan
menuliskan nomor pribadi ke `.env.example` atau source code. Tidak ada sesi atau token
WhatsApp yang disertakan di repository. Beberapa fitur bot lama membutuhkan utilitas
tambahan seperti ffmpeg/webp; shop tidak memakainya.

Mode dua proses di Termux:

```bash
# Sesi pertama: bot tanpa server shop bawaan
SHOP_ENABLED=0 node index.js
```

```bash
# Sesi kedua: shop independen dengan runner
node shop-keepalive.js
```

Ini membuat crash/reconnect bot tidak langsung menghentikan proses shop. Jangan
menjalankan dua koneksi bot dengan akun/sesi WhatsApp yang sama.

Repo `Innerbotwa` lama **tidak diubah**. File katalog di dua folder/repo berbeda
tidak otomatis sinkron. Jalankan bot dan shop dari checkout `Innerbot-shop` yang
sama jika ingin memakai satu daftar produk.

## Akses pelanggan

`127.0.0.1` hanya untuk perangkat sendiri. Agar pelanggan internet bisa masuk,
dibutuhkan alamat **HTTPS publik** dengan tunnel/reverse proxy ke port shop.
Repo GitHub ini bukan hosting API dan belum menyediakan tunnel atau alamat shop publik.

`SHOP_PUBLIC_URL` hanya menentukan origin yang diizinkan; **tidak membuat tunnel**.
Jangan membuka folder repo sebagai static server: sesi WhatsApp harus tetap privat.

## Pengujian dan dokumentasi

```bash
npm test
```

Tes shop tidak membutuhkan dependensi WhatsApp atau pairing. Mencakup perhitungan
harga server, perubahan katalog tanpa restart, validasi input, produk nonaktif,
pembatasan endpoint, perlindungan jalur file, runner, dan referensi asset HTML.

Pengaturan pribadi: [tutorial membuat dan mengedit .env](ENV.md).
Pengaturan dibaca otomatis; setelah mengedit `.env`, restart proses bot/shop/runner.
Environment shell mengambil prioritas atas `.env`. Jika `ADMIN_NUMBERS` kosong,
command admin tidak diberikan kepada siapa pun. Shop umum tetap dapat berjalan.

Selengkapnya: [panduan Termux dan API](SHOP-TERMUX.md).

Tidak ada checkout, penyimpanan pesanan, payment gateway, atau pengiriman barang otomatis.
Uji pada browser Android, jaringan publik, dan akun WhatsApp pemilik tetap diperlukan.
