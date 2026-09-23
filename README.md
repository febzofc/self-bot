# Cimo Self-Bot (v2.2.0)

Cimo Self-Bot adalah bot WhatsApp berbasis Node.js yang dirancang khusus untuk penggunaan pribadi (self-bot) dan grup chat. Bot ini menggunakan arsitektur modular berbasis plugin yang mempermudah penambahan fitur baru, serta dilengkapi dengan integrasi AI Developer Google Antigravity CLI (AGY), engine AI chat santai resmi `@google/genai`, pencarian tiket pesawat real-time, visual search komparasi harga marketplace, upload gambar ke hosting Lightshot, dashboard web monitoring, Web Player Streaming Anime, Web TV, Integrasi Server Minecraft ServerTap.io, Social Media Stalkers (Instagram & TikTok), dan Smartphone Specification Engine.

---

## 🚀 Catatan Rilis & Log Pembaruan (Changelog)

> 💡 **Petunjuk:** Klik pada masing-masing baris versi di bawah ini untuk melihat detail perubahan serta penambahan fitur barunya.

<details open>
<summary><b>📦 Versi 2.2.0 (Terbaru) - Flight Ticket, Marketplace Visual Search, Lightshot CDN & Official Google GenAI SDK</b></summary>
<br>

### 🛫 1. Cek Tiket Pesawat Domestik & Internasional (`.tiketpesawat` / `.pesawat` / `.flight`)
- **Pencarian Real-Time via Trip.com:** Menampilkan jadwal penerbangan lengkap, nama maskapai, nomor penerbangan, waktu berangkat/tiba, durasi perjalanan, serta harga tiket termurah dan direct link pemesanan.
- **Interactive List Message (Baileys single_select):** Mendukung pemilihan rute bandara asal dan tujuan secara interaktif lewat tombol menu interaktif WhatsApp.
- **Dukungan Bandara Lengkap & Tanggal Fleksibel:** Otomatis memilih tanggal keberangkatan H+1 secara default jika tidak ditentukan, atau tentukan tanggal spesifik (`YYYY-MM-DD` / `DD-MM-YYYY`).

### 🛍️ 2. Cek Harga Barang & Visual Search Marketplace (`.cekharga` / `.harga` / `.caribarang`)
- **Visual Product Recognition:** Cukup kirim atau balas (reply) foto barang/produk, bot otomatis memindai objek produk tersebut.
- **Komparasi Multi-Marketplace:** Membandingkan harga dan ketersediaan produk serupa di Shopee, Tokopedia, dan Lazada secara real-time.
- **Pratinjau & Estimasi Harga:** Menampilkan estimasi kisaran harga termurah hingga tertinggi, rating toko, dan tautan langsung ke etalase marketplace.

### 📸 3. Lightshot Image Uploader (`.tourlsc` / `.prntsc` / `.tourl3`)
- **Upload Media ke Prnt.sc:** Mengunggah foto, gambar, maupun stiker WhatsApp langsung ke server Lightshot (`https://prnt.sc`).
- **Direct Raw Image Link:** Otomatis menghasilkan tautan publik direct raw image (CDN) yang siap dibagikan atau digunakan untuk integrasi visual scraper.

### 🗑️ 4. Smart Message Deletion (`.del` / `.delete` / `.d` / `.hapus`)
- **Hapus Pesan Bot (Self-Bot):** Balas (reply) pesan yang dikirim oleh bot di obrolan pribadi (DM) maupun grup untuk menghapusnya seketika.
- **Admin Delete (Grup):** Jika bot dan pemanggil perintah memiliki akses admin grup, perintah ini dapat menghapus pesan anggota lain (revoke message).
- **Multi-Identifier Detection:** Deteksi akurat berbasis Baileys ID, fromMe, nomor bot, dan WhatsApp LID.

### ⚡ 5. Engine Baru Google GenAI Official SDK (`.ai`)
- **Integrasi SDK Resmi `@google/genai`:** Didukung model pool berkecepatan tinggi (`gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-3-flash-preview`).
- **Respon Super Kilat:** Kecepatan respon ~2-3 detik dengan thinking level minimal, hemat bubble chat, dan natural splitting.
- **Ekspresi Emosi Stiker Otomatis:** AI mampu mendeteksi konteks emosi dan mentrigger stiker ekspresi (`[EXPR: ...]`).

### 🎭 6. Ekosistem Stiker Ekspresi Kontekstual & Reaksi Emosi
- **Koleksi Stiker Baru:** Penambahan koleksi stiker ekspresi lucu, sedih, sus, bingung, gaktau, ketawa, pujian, dan mabar di `src/expressions/`.
- **Helper `sendExpressionByName`:** Pengiriman stiker langsung sesuai deteksi emosi tanpa jeda berlebih.

### 🛡️ 7. Standarisasi Plugin & Proteksi Keamanan Gatekeeper
- **Standarisasi Plugin:** Pembersihan dan unifikasi properti `CmD` dan `aliases` di seluruh modul plugin `./perintah/`.
- **Penyempurnaan Gatekeeper Hook:** Proteksi otomatis terhadap perintah fatal/destruktif dan pencegahan restart PM2 sepihak.

</details>

<details>
<summary><b>📦 Versi 2.1.0 - Pinterest Search, SSYouTube Downloader, Jarak Antar Kota & Safe PM2 Policy</b></summary>
<br>

### 1. Pinterest Search Engine (`.pinterest` / `.pin`)
- **Pencarian Gambar Pinterest Realtime:** Menggunakan API siputzx untuk mengambil gambar resolusi tinggi dari Pinterest.
- **Dukungan Multi-Gambar:** Mendukung pengiriman 1 hingga 5 gambar sekaligus (contoh: `.pin anime aesthetic 3` atau `--count=3`).
- **Pengacakan Variatif & Anti-Repetitif:** Hasil pencarian diacak (Fisher-Yates shuffle) agar setiap pencarian menghasilkan gambar yang selalu bervariasi.
- **Download Buffer & URL Fallback:** Gambar diunduh sebagai buffer terlebih dahulu untuk keandalan Baileys, dengan fallback otomatis ke direct URL jika diperlukan.

### 2. SSYouTube Downloader MP3 (128kbps) & MP4 All Resolusi (`.ssyt` / `.ssmp3` / `.ssmp4`)
- Scraper kustom untuk mengunduh video dan audio YouTube melalui penyedia ssyoutube.com.mx.
- Pemilihan otomatis kualitas audio MP3 128kbps dan video MP4 kualitas terbaik.

### 3. Jarak Antar Kota & Kalkulator Rute (`.jarak` / `.jarakkota` / `.distance`)
- Menghitung jarak rute jalan darat antar dua kota secara akurat dalam kilometer (KM).
- Estimasi waktu tempuh mobil dan sepeda motor beserta koordinat geografis.

### 4. Optimalisasi Kebijakan Restart PM2 & AI Router
- Proteksi restart PM2 otomatis: penambahan/pengeditan plugin di `./perintah/` menggunakan hot-reload tanpa restart proses bot.
- Penyempurnaan filter routing AI dan penanganan interupsi `/btw` saat task Antigravity berjalan.

</details>

<details>
<summary><b>📦 Versi 2.0.0 - Google Antigravity (AGY) CLI Integration</b></summary>
<br>

### 1. Google Antigravity (AGY) CLI Full Integration & Controller (`.agy` / `.antigravity` / `.btw`)
- **Jembatan WhatsApp ke AI Developer Agent Antigravity:** Menghubungkan bot WhatsApp langsung ke runtime Antigravity CLI di VPS untuk mengeksekusi instruksi coding, inspeksi file, debugging, testing, pembuatan dokumen, dan manajemen task.
- **Sistem Sesi Multi-Turn & Interaktif:**
  - Konteks percakapan coding tetap tersimpan per chat menggunakan `conversationId` Antigravity.
  - Mode sesi interaktif (`.agy --sesi`) memungkinkan chat instruksi langsung tanpa perlu mengetik prefix terus-menerus.
  - Perintah kontrol sesi: `.agy --stop` untuk mengakhiri sesi interaktif, dan `.agy --reset` untuk memulai obrolan baru dari awal.
- **Keamanan Berlapis dengan PreToolUse Gatekeeper Hook:**
  - Menolak bypass liar: Setiap pemanggilan aksi kritis/terminal (`run_command`, `write_to_file`, `replace_file_content`, dsb.) otomatis dijeda (*pause*) oleh Lifecycle Hook `.agents/hooks.json`.
  - Bot mengirimkan pesan konfirmasi persetujuan ke WhatsApp Owner: balas `Y` untuk mengizinkan atau `N` untuk menolak aksi tersebut.
  - Aksi aman/read-only (`view_file`, `list_dir`, `grep_search`, `search_web`, dsb.) berjalan otomatis tanpa membebani interaksi chat.
- **Live Logs Streaming dengan WhatsApp Message Edit:**
  - Menampilkan langkah realtime yang sedang diproses agen (narasi pemikiran + status pemanggilan tool: `● Read(...)`, `✔ Read(...)`, `● Bash(...)`, `● ManageTask(...)`).
  - Menggunakan sistem edit pesan WhatsApp in-place dengan debounce cerdas sehingga tidak membanjiri ruang chat.
  - Alur persetujuan terpisah rapi: pesan log difinalisasi $\rightarrow$ kirim pesan konfirmasi baru $\rightarrow$ kirim pesan baru untuk melanjutkan live log.
- **Fitur `/btw` (By The Way / Progress Check):**
  - Cek status langkah task yang sedang berjalan secara realtime kapan saja dengan mengetik `/btw` atau `.btw`.
  - Tanyakan progres atau arahan tambahan di tengah berjalannya proses dengan `/btw <pertanyaan>`.
- **Hasil Akhir Respon Utuh Teks (Bebas Dokumen .txt):**
  - Respon hasil akhir agen dikirimkan langsung sebagai teks chat WhatsApp biasa (bukan sebagai lampiran file `.txt`), dengan auto-chunking jika melebihi batas karakter pesan WhatsApp.
- **100% Portabel & Auto Self-Setup:**
  - Otomatis mengonfigurasi direktori `.agents/` dan hook saat bot pertama kali dijalankan di VPS baru mana pun.
  - Otomatis mendeteksi jika Antigravity CLI belum terinstall di VPS dan memberikan instruksi instalasi lengkap.

</details>

<details>
<summary><b>📦 Versi 1.4.0 - Specs Engine, Anime Hub, Minecraft & Game Interaktif</b></summary>
<br>

### 1. 📱 GSMArena & Smartphone Specifications Engine (`.spec` / `.gsmarena` / `.hp`)
- **Bypass Proteksi Cloudflare Turnstile:** Mendukung integrasi Cookie (`sLoginCookie` / `cf_clearance`) dan custom User-Agent agar tetap dapat mengakses GSMArena dari IP server.
- **Sistem Dual-Scraper Berkeandalan Tinggi:** Otomatis beralih (*seamless fallback*) ke database spesifikasi alternatif tanpa delay jika GSMArena mengalami kendala/Cloudflare challenge.
- **Data Spesifikasi Lengkap & Foto HD:** Menyajikan foto HD smartphone, spesifikasi Platform (OS, Chipset, CPU, GPU), Layar (Tipe, Refresh Rate, Resolusi), RAM & Penyimpanan, Kamera Utama & Selfie, Kapasitas Baterai & Charging, Dimensi Bodi, serta estimasi harga resmi dalam format Rupiah.
- **Sesi Interaktif 2-Langkah:** Cari nama HP (`.spec samsung s24`), lalu balas dengan nomor pilihan (`#1`, `#2`, dst.) untuk membuka detail spesifikasi lengkap, atau `#exit` untuk keluar.

### 2. 🎵 Lyric Finder Plugin (`.lyrics` / `.lirik`)
- Pencarian lirik lagu lokal dan internasional secara instan dan akurat.
- Format tampilan lirik bersih, mudah dibaca, dan dilengkapi metadata artis serta judul lagu.

### 3. 🔍 Social Media Stalker Lengkap (Instagram & TikTok)
- **Instagram Stalker (`.igstalk` / `.stalkig`):** Stalking profil Instagram lengkap tanpa browser/Chromium (Pure API & HTTP Scraper).
- **TikTok Stalker (`.ttstalk` / `.tiktokstalk`):** Data profil TikTok lengkap via API Faa.

### 4. 🎮 Integrasi Server Minecraft ServerTap.io & Sistem Bansos Persistent
- Monitoring Server (`.mcstatus` / `.mcplayers`), klaim Bansos Kit (`.mcclaimbansos`) Cooldown 24 jam dengan database LowDB persistent, dan manajemen koordinat (`.mcsave`, `.mccoords`).

### 5. 📊 Inspeksi Grup WhatsApp (`.inspect` / `.inspectgroup`)
- Analisis link grup, JID, daftar admin, dan detail member.

### 6. ⛩️ 🌸 Otakudesu Anime Hub & Web Player Streaming TV
- Pencarian anime, detail episode, dan web player video streaming (`public/anime_stream.html`).

### 7. 🎮 Game Interactive Player vs Bot
- Tic-Tac-Toe (`.ttt`) & Gunting Batu Kertas (`.suit`).

### 8. 🎨 Maker & Media Downloader Plugins
- Instagram, TikTok, Facebook, YouTube, Videy, Quote chat, Sticker meme, Brat generator.

### 9. ⚽ Jadwal Sepak Bola & Formasi Starting XI (`.jadwalbola` / `.bola`)
- Jadwal liga terupdate, livescore, dan susunan formasi starting XI.

### 10. 📈 System Performance Statistics (`.stats` / `.ping`)
- Monitoring CPU, RAM, disk storage, dan uptime.

</details>

---

## 📋 Ringkasan Perintah Utama

| Perintah | Deskripsi |
| --- | --- |
| `.tiketpesawat <asal> <tujuan> [tgl]` | Cek jadwal & harga tiket pesawat domestik/internasional via Trip.com |
| `.cekharga` (reply foto barang) | Visual search & komparasi harga barang di Shopee, Tokopedia, Lazada |
| `.tourlsc` / `.prntsc` (reply foto) | Upload foto/stiker ke Lightshot (prnt.sc) & ambil link direct raw image |
| `.del` / `.delete` / `.d` (reply) | Hapus pesan bot (DM/grup) atau pesan member (Admin delete) |
| `.ai <pesan>` / `.ai --sesi` | AI Chat santai gaul bertenaga Google GenAI SDK resmi (Fast Response) |
| `.pinterest <query> [jumlah]` | Cari dan download gambar resolusi tinggi dari Pinterest |
| `.ssyt` / `.ssmp3` / `.ssmp4` [url] | Download video/audio YouTube via SSYouTube scraper |
| `.jarak <kota1> - <kota2>` | Hitung jarak rute jalan darat & estimasi waktu tempuh antar kota |
| `.agy <instruksi>` | Menjalankan instruksi AI Developer Google Antigravity CLI dengan sistem approval (Khusus Owner) |
| `.agy --sesi` | Mengaktifkan sesi obrolan interaktif langsung tanpa prefix |
| `/btw` atau `.btw` | Memeriksa live status & riwayat task Antigravity yang sedang berjalan, atau tanya progres |
| `.spec <nama hp>` | Pencarian spesifikasi HP & GSMArena interaktif dengan foto & estimasi harga |
| `.lyrics <judul lagu>` | Pencarian lirik lagu lokal dan internasional lengkap |
| `.jadwalbola [tim/nomor]` | Jadwal sepak bola terkini, skor, & susunan pemain Starting XI interaktif |
| `.igstalk <user/link>` | Stalker profil Instagram lengkap + foto HD & postingan terbaru |
| `.ttstalk <user/link>` | Stalker profil TikTok lengkap via API Faa + foto profil & statistik |
| `.mcstatus` / `.mcinfo` | Menampilkan status TPS, RAM, & Uptime Server Minecraft |
| `.mcplayers` / `.mclist` | Menampilkan daftar pemain online di server Minecraft |
| `.mcclaimbansos <player>` | Klaim Paket Bansos Starter Kit Minecraft (Cooldown 24 Jam, Persistent DB) |
| `.mcsave <x> <y> <z> <nama>` | Menyimpan koordinat lokasi penting ke database |
| `.mccoords` / `.mclistc` | Menampilkan daftar koordinat lokasi tersimpan |
| `.sethome <player>` | Menyimpan lokasi rumah pemain di Minecraft |
| `.inspect` [link/JID] | Inspeksi & analisis informasi grup WhatsApp |
| `.stats` / `.ping` | Menampilkan statistik performa sistem & server bot |
| `.otakusearch <judul>` | Memulai sesi pencarian anime Otakudesu |
| `.ttt <easy\|normal\|hard>` | Memulai game Tic-Tac-Toe vs Bot |
| `.suit <batu\|gunting\|kertas>` | Memainkan game Gunting Batu Kertas vs Bot |
| `.ig <link instagram>` | Downloader foto & video Instagram |
| `.tt <link tiktok>` | Downloader video TikTok tanpa watermark |
| `.fb <link facebook>` | Downloader video Facebook |
| `.yt <link youtube>` | Downloader video/audio YouTube |
| `.videy` (reply video) | Upload video ke Videy Cloud |
| `.menu` / `.help` | Menampilkan menu utama |

---

## 🛠️ Persyaratan Sistem & Instalasi

1. **Persyaratan Sistem:**
   - Node.js versi >= 16
   - **FFmpeg & ImageMagick** (Wajib untuk stiker, konversi media & kartu ucapan grup)
     ```bash
     # Di Termux / Ubuntu:
     pkg install ffmpeg imagemagick -y
     # atau
     sudo apt update && sudo apt install ffmpeg imagemagick -y
     ```

2. **Clone Repository:**
   ```bash
   git clone https://github.com/febzofc/self-bot.git
   cd self-bot
   ```

3. **Instal Dependensi:**
   ```bash
   npm install
   ```

4. **Jalankan Bot:**
   ```bash
   npm start
   # atau via PM2:
   pm2 start main.js --name "self-bot"
   ```

---

## 🔄 Cara Memperbarui Bot (Update dari GitHub)

```bash
git pull origin main
npm install
pm2 restart self-bot
```

---

## 🤝 Lisensi & Hak Cipta
Created & Maintained by **Febriansyah** (febzofc). Open source & free for personal usage!
