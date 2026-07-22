# Cimo Self-Bot 🤖

Cimo Self-Bot adalah bot WhatsApp berbasis Node.js yang dirancang khusus untuk penggunaan pribadi (self-bot) dan grup chat saja. Bot ini memiliki arsitektur modular berbasis plugin yang mempermudah penambahan fitur baru, serta dilengkapi dengan dashboard web monitoring dan web streaming TV.

---

## 🚀 Fitur Unggulan

### 1. 📺 Web Streaming TV Indonesia & Live Chat (Nobar)
Nonton siaran langsung TV Indonesia (RCTI, SCTV, Trans TV, Metro TV, dll.) secara gratis langsung lewat browser.
- **Real-time Live Chat**: Fitur obrolan mirip Live Chat YouTube sehingga Anda dapat melakukan nobar (nonton bareng) dengan pengguna lain. Cukup isi nama panggilan Anda untuk mulai mengobrol!
- **Desain Responsif**: Tampilan player dan daftar channel dioptimalkan agar responsif dan terlihat premium baik di HP, tablet, maupun desktop.
- **Web Share API**: Bagikan tautan streaming secara native menggunakan menu share di ponsel Anda.

### 2. 🧩 Web Dashboard Plugin Monitor (Owner Console)
Dashboard admin web khusus untuk pemilik (Owner Only) yang berjalan di port `3000`.
- **Status Plugin Terperinci**: Melihat statistik plugin yang tersedia, berjalan aktif, atau mendeteksi plugin yang error.
- **Web-based Code Editor & Reload**: Mengedit kode plugin secara langsung di browser dan menyimpannya. Bot akan memuat ulang (reload) plugin tersebut secara real-time tanpa perlu restart server!

### 3. 📦 Fitur Bot WhatsApp Lainnya
- **Media Downloader**: Mengunduh video/media dari TikTok, Instagram, dll.
- **Sticker Converter**: Mengubah gambar/video menjadi stiker WhatsApp dengan mudah.
- **Trace Moe**: Mencari anime berdasarkan potongan gambar.

---

## 🛠️ Cara Instalasi & Menjalankan Bot

1. **Clone Repository:**
   ```bash
   git clone https://github.com/febzofc/self-bot.git
   cd self-bot
   ```

2. **Instal Dependensi:**
   ```bash
   npm install
   ```

3. **Konfigurasi:**
   Sesuaikan konfigurasi bot Anda di file `config.js`.

4. **Jalankan Bot:**
   ```bash
   npm start
   ```
   Pindai (scan) kode QR yang muncul di terminal menggunakan fitur "Perangkat Tertaut" di WhatsApp Anda.

---

## 🔄 Cara Memperbarui Bot (Update Lewat Terminal)

Untuk memperbarui bot ini ke versi terbaru dari GitHub langsung melalui terminal, gunakan perintah berikut:

1. **Simpan atau Reset Perubahan Lokal Anda (Jika Ada):**
   Jika Anda mengubah file bawaan dan ingin menyimpannya terlebih dahulu sebelum melakukan update:
   ```bash
   git stash
   ```
   Atau jika Anda ingin membuang semua perubahan lokal Anda dan menimpanya dengan versi terbaru dari repository:
   ```bash
   git reset --hard HEAD
   ```

2. **Tarik Versi Terbaru dari GitHub:**
   ```bash
   git pull origin main
   ```

3. **Kembalikan Perubahan Lokal Anda (Jika Menggunakan Stash):**
   ```bash
   git stash pop
   ```

4. **Instal Dependensi Baru (Jika Ada):**
   ```bash
   npm install
   ```

5. **Jalankan Ulang Bot:**
   ```bash
   npm start
   ```

---

## 🤝 Kolaborasi & Kontribusi

Kami sangat menyambut kontribusi dari siapa pun yang ingin menambahkan fitur baru atau memperbaiki bug!

### Cara Menambahkan Fitur (Plugin Baru):
Bot ini menggunakan sistem plugin otomatis. Anda hanya perlu menambahkan file JavaScript baru di dalam folder `perintah/`.

Contoh struktur plugin baru (`perintah/hello.js`):
```javascript
module.exports = {
    CmD: ['hello'],                 // Perintah utama
    aliases: ['hi', 'halo'],        // Nama alias perintah
    categori: 'utility',            // Kategori fitur
    exec: async (m, { bob }) => {
        return m.reply('Halo! Saya adalah bot asisten Anda.');
    }
};
```
Plugin yang ditambahkan di folder `perintah/` akan secara otomatis terbaca dan dimuat saat bot dijalankan atau melalui Dashboard Plugin Editor.

### Mengirimkan Kontribusi:
1. **Fork** repository ini.
2. Buat branch baru untuk fitur Anda (`git checkout -b feature/FiturBaru`).
3. Commit perubahan Anda (`git commit -m 'Menambahkan fitur XYZ'`).
4. Push ke branch Anda (`git push origin feature/FiturBaru`).
5. Buat **Pull Request (PR)** di GitHub.
