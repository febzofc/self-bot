# Cimo Self-Bot (v2.0.0)

Cimo Self-Bot adalah bot WhatsApp berbasis Node.js yang dirancang khusus untuk penggunaan pribadi (self-bot) dan grup chat. Bot ini menggunakan arsitektur modular berbasis plugin yang mempermudah penambahan fitur baru, serta dilengkapi dengan integrasi AI Developer Google Antigravity CLI (AGY), dashboard web monitoring, Web Player Streaming Anime, Web TV, Integrasi Server Minecraft ServerTap.io, Social Media Stalkers (Instagram & TikTok), dan Smartphone Specification Engine.

---

## Fitur Unggulan Versi Terbaru (v2.0.0 - Antigravity Integration)

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

---

## Fitur Unggulan Versi Sebelumnya (v1.4.0)

### 1. 📱 GSMArena & Smartphone Specifications Engine (`.spec` / `.gsmarena` / `.hp`)
- **Bypass Proteksi Cloudflare Turnstile:** Mendukung integrasi Cookie (`sLoginCookie` / `cf_clearance`) dan custom User-Agent agar tetap dapat mengakses GSMArena dari IP server.
- **Sistem Dual-Scraper Berkeandalan Tinggi:** Otomatis beralih (*seamless fallback*) ke database spesifikasi alternatif tanpa delay jika GSMArena mengalami kendala/Cloudflare challenge.
- **Data Spesifikasi Lengkap & Foto HD:** Menyajikan foto HD smartphone, spesifikasi Platform (OS, Chipset, CPU, GPU), Layar (Tipe, Refresh Rate, Resolusi), RAM & Penyimpanan, Kamera Utama & Selfie, Kapasitas Baterai & Charging, Dimensi Bodi, serta estimasi harga resmi dalam format Rupiah.
- **Sesi Interaktif 2-Langkah:** Cari nama HP (`.spec samsung s24`), lalu balas dengan nomor pilihan (`#1`, `#2`, dst.) untuk membuka detail spesifikasi lengkap, atau `#exit` untuk keluar.

### 2. 🎵 Lyric Finder Plugin (`.lyrics` / `.lirik`)
- Pencarian lirik lagu lokal dan internasional secara instan dan akurat.
- Format tampilan lirik bersih, mudah dibaca, dan dilengkapi metadata artis serta judul lagu.

### 3. 🔍 Social Media Stalker Lengkap (Instagram & TikTok)
- **Instagram Stalker (`.igstalk` / `.stalkig`):**
  - Stalking profil Instagram lengkap tanpa browser/Chromium (Pure API & HTTP Scraper).
  - Menampilkan foto profil resolusi HD, nama lengkap, user ID, status privasi (Publik/Privat), lencana verifikasi (Centang Biru), bio lengkap, link bio, dan statistik akun (followers, following, posts, reels).
  - Menampilkan cuplikan 3 postingan terbaru (tipe media foto/video, likes, komentar, caption, dan link langsung).
- **TikTok Stalker (`.ttstalk` / `.tiktokstalk`):**
  - Menggunakan API Faa (`api-faa.my.id`) untuk mengambil data lengkap akun TikTok.
  - Menampilkan avatar foto profil, nama, user ID, region negara, status akun, tanggal pembuatan akun, bio, total followers, following, likes, video, dan teman.

### 4. 🎮 Integrasi Server Minecraft ServerTap.io (Port 8122) & Sistem Bansos Persistent
- **Pembaruan Koneksi & Anti-Socket Hang Up:** Optimalisasi koneksi ke port aktif 8122 dengan auto-retry interceptor dan non-keepalive socket.
- **Status & Monitoring Server (`.mcstatus` / `.mcplayers`):** Cek TPS, memori RAM, jumlah pemain online, serta detail individual (HP, koordinat, level, & mode game).
- **Claim Bansos Starter Kit Persistent (`.mcclaimbansos` / `.mcbansos`):**
  - Pemain online di Minecraft dapat mengklaim Paket Bansos Starter Kit (Full Iron Armor, Iron Tools, 64 Roti, & Kasur).
  - **Penyimpanan Terintegrasi LowDB (`global.db.data.minecraft_bansos`):** Riwayat klaim tersimpan secara permanen di database JSON sehingga tidak hilang atau ter-reset saat bot di-restart.
  - **Cooldown 24 Jam:** Proteksi jeda waktu klaim 24 jam dengan penghitung waktu mundur (*countdown timer*) yang akurat.
- **Manajemen Koordinat & Sethome (`.mcsave`, `.mccoords`, `.sethome`):**
  - Menyimpan koordinat lokasi penting & titik home player langsung ke database persistent `global.db.data`.

### 5. 📊 Inspeksi Grup WhatsApp (`.inspect` / `.inspectgroup`)
- Inspeksi detail grup WhatsApp menggunakan link undangan (`chat.whatsapp.com/code`), JID grup, atau langsung di dalam grup.
- Menampilkan: Pembuat grup, tanggal pembuatan, ephemeral duration, daftar admin, approval mode, presensi online realtime anggota, serta foto profil grup.

### 6. ⛩️ 🌸 Otakudesu Anime Hub & Web Player Streaming TV
- **Sesi Interaktif (3 Steps):**
  - `Step 1`: Pencarian anime (`.otakusearch <judul>`).
  - `Step 2`: Detail anime, sinopsis, dan pilihan episode / BATCH.
  - `Step 3`: Aksi episode (Download 360p-1080p / Streaming Player).
- **Web Player Streaming TV (`public/anime_stream.html`):** Pemutar video anime web responsive.

### 7. 🎮 Game Interactive Player vs Bot
- **Tic-Tac-Toe (`.ttt` / `.tictactoe` / `.ttc`):** 3 tingkat kesulitan (`Easy`, `Normal`, `Hard` Minimax) dengan integrasi statistik permanent `global.db.data`.
- **Gunting Batu Kertas / Suit Bot (`.suit` / `.gbk`):** Game RPS interaktif.

### 8. 🎨 Maker & Media Downloader Plugins
- **Instagram Downloader & Stalker (`.ig` / `.igdl` / `.igstalk`)**
- **TikTok Downloader & Stalker (`.tt` / `.tiktok` / `.ttstalk`)**
- **Facebook Downloader (`.fb` / `.fbdl`)**
- **YouTube Downloader (`.yt` / `.ytdl`)**
- **Videy Video Uploader (`.videy`)**
- **iPhone Quote Chat Maker (`.iqc` / `.iqcv2`)**
- **Sticker Meme Maker (`.smeme`)**
- **Brat Generator (`.brat` / `.brat --img`)**

### 9. ⚽ Jadwal Sepak Bola & Formasi Starting XI (`.jadwalbola` / `.bola`)
- **Jadwal & Hasil Pertandingan Realtime:** Menampilkan daftar jadwal laga bola terupdate lengkap dengan liga/kompetisi, status kick-off, jam/waktu WIB, skor terkini, dan stadion.
- **Formasi & Susunan Pemain (Starting XI):** Dukungan sesi interaktif untuk memilih nomor pertandingan guna melihat susunan pemain (Lineup) dari kedua tim serta statistik/kejadian laga.
- **Pencarian Tim / Liga:** Cari jadwal tim favorit secara instan (contoh: `.jadwalbola roma`, `.jadwalbola bayern`, `.jadwalbola champions`).

### 10. 📈 System Performance Statistics (`.stats` / `.ping`)
- Menampilkan pemakaian CPU, penggunaan RAM, sisa penyimpanan disk, uptime sistem, dan statistik pesan bot secara realtime.

---

## 📋 Ringkasan Perintah Utama

| Perintah | Deskripsi |
| --- | --- |
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
