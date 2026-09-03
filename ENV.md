# Membuat dan mengedit .env

`.env` adalah **file pengaturan pribadi di perangkatmu**, bukan database.
File berada di folder yang sama dengan `package.json`, `shop.js`, dan `index.js`.
`.env.example` hanya contoh kosong untuk GitHub; **jangan isi nomor asli di sana**.

## 1. Perbarui kode

Masuk ke folder repo `Innerbot-shop` yang benar. Jika nama foldermu `changes`,
pakai folder itu, selama `git remote -v` menunjuk repo `fandiplay/Innerbot-shop`.
Jangan mengubah remote repo bot lama.

```text
git status --short
git pull --ff-only
node -v
```

Jika pull ditolak karena editan lokal atau riwayat berbeda, berhenti dan periksa;
jangan memakai reset/force. Fitur pembacaan `.env` memerlukan `util.parseEnv`,
tersedia di Node 20.12.0 dan 21.7.0 ke atas pada cabang masing-masing.
Gunakan rilis Node yang masih didukung. [Dokumentasi Node](https://nodejs.org/api/util.html#utilparseenvcontent).

## 2A. Windows / PowerShell

Dari folder repo:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

Jika `.env` sudah ada, perintah pertama tidak menimpanya. Simpan dengan **Ctrl+S**.
Nama file harus tepat `.env`, bukan `.env.txt`; gunakan encoding UTF-8.

Untuk mengedit lagi nanti, cukup:

```powershell
notepad .env
```

## 2B. Android / Termux

Dari folder repo:

```bash
test -e .env || cp .env.example .env
nano .env
```

Jika `nano` belum tersedia, pasang dengan `pkg install nano`.
Di nano: **Ctrl+O**, **Enter** untuk menyimpan; **Ctrl+X** untuk keluar.
Untuk mengedit lagi nanti, cukup `nano .env`.

## 3. Isi pengaturan

Template awal:

```dotenv
ADMIN_NUMBERS=
SHOP_ENABLED=1
SHOP_HOST=127.0.0.1
SHOP_PORT=3000
SHOP_PUBLIC_URL=
SHOP_RATE_LIMIT=120
```

- `ADMIN_NUMBERS`: isi nomor admin milikmu setelah tanda `=`. Gunakan nomor lengkap,
  misalnya pola `628xxxxxxxxxx` (**x wajib diganti digit asli, jangan ditempel apa adanya**).
  Format `08…` akan dinormalisasi menjadi `628…`. Untuk lebih dari satu admin,
  pisahkan nomor lengkap dengan koma, tanpa tanda kurung siku.
- `ADMIN_NUMBERS=` kosong: **tidak ada siapa pun yang mendapat akses admin**.
  Shop tetap bisa dibuka. Nomor admin bukan otomatis nomor bot dan bukan pengganti pairing.
- `SHOP_ENABLED=1`: shop aktif. Nilai `0` menonaktifkan shop bawaan/standalone.
- `SHOP_HOST=127.0.0.1`: akses dari perangkat sendiri atau tunnel lokal.
- `SHOP_PORT=3000`: port shop. Jika diganti ke 4000, alamat lokalnya menjadi
  `http://127.0.0.1:4000`; target port tunnel juga perlu disesuaikan.
- `SHOP_PUBLIC_URL=`: biarkan kosong sebelum memiliki tunnel/domain HTTPS.
  Mengisi variabel ini tidak membuat link publik otomatis.
- `SHOP_RATE_LIMIT=120`: batas permintaan API per alamat socket per menit.
  Di belakang tunnel, batas ini dapat menjadi gabungan beberapa pelanggan.

Satu variabel satu baris. Huruf nama variabel harus sesuai template. Komentar
boleh diawali `#`. Tanda kutip boleh, tetapi untuk nomor gunakan teks biasa tanpa
kurung siku. Variabel selain yang didukung tidak diimpor; file ini tidak menjalankan
perintah shell. Tidak perlu `source .env`.

## 4. Restart setelah mengedit

Hentikan proses yang sedang berjalan dengan **Ctrl+C** di terminalnya, lalu pilih
perintah yang sesuai:

```text
node shop.js
```

Atau, shop dengan restart otomatis:

```text
node shop-keepalive.js
```

Atau, bot WhatsApp sekaligus shop (dependensi bot harus sudah dipasang):

```text
node index.js
```

Jangan menjalankan ketiganya bersamaan pada port yang sama. Jika menggunakan runner,
hentikan dan mulai ulang **runner-nya**, bukan hanya proses anak, agar environment
lama tidak terus diwariskan. Konfigurasi `.env` memerlukan restart; perubahan
produk di `src/shop/catalog.json` tetap langsung terbaca tanpa restart.

## 5. Periksa tanpa menampilkan nomor pribadi

```text
node -e "console.log('Jumlah admin aktif:', require('./src/config').adminNumbers.length)"
git check-ignore .env
git ls-files -- .env
```

`git check-ignore .env` seharusnya menampilkan `.env`; `git ls-files -- .env`
seharusnya **tidak menghasilkan apa pun**, artinya file tidak dilacak Git.
Jika ternyata sudah dilacak, `.gitignore` saja tidak menghapusnya dari riwayat.
Jangan push dulu; periksa commit terkait. Jangan gunakan `git add -f .env`.

## Jika isi .env terasa tidak berpengaruh

Environment yang sudah ada di shell memiliki prioritas. Untuk menghapus override
khusus nomor admin, lalu memakai nilai dari `.env`:

PowerShell:

```powershell
Remove-Item Env:ADMIN_NUMBERS -ErrorAction SilentlyContinue
```

Termux:

```bash
unset ADMIN_NUMBERS
```

Untuk variabel lain, ganti `ADMIN_NUMBERS` dengan nama variabel yang ingin direset.
Lalu restart proses. Jangan menghapus variabel sistem yang tidak terkait.

Jangan bagikan `.env`, screenshot isinya, file sesi WA, token, atau private key.
Push repo tidak menjalankan program di HP: proses Termux dan tunnel tetap perlu hidup.
