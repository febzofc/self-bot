# Cimo Self-Bot 🤖 (v1.3.0)

Cimo Self-Bot adalah bot WhatsApp berbasis Node.js yang dirancang khusus untuk penggunaan pribadi (self-bot) dan grup chat. Bot ini menggunakan arsitektur modular berbasis plugin yang mempermudah penambahan fitur baru, serta dilengkapi dengan dashboard web monitoring, Web Player Streaming Anime, Web TV, Integrasi Server Minecraft ServerTap.io, dan Social Media Stalkers (Instagram & TikTok).

---

## 🚀 Fitur Unggulan Versi Terbaru (v1.3.0)

### 1. 🔍 Social Media Stalker Lengkap (Instagram & TikTok)
- **Instagram Stalker (`.igstalk` / `.stalkig`):**
  - Stalking profil Instagram lengkap tanpa browser/Chromium (Pure API & HTTP Scraper).
  - Menampilkan foto profil resolusi HD, nama lengkap, user ID, status privasi (Publik/Privat), lencana verifikasi (Centang Biru), bio lengkap, link bio, dan statistik akun (followers, following, posts, reels).
  - Menampilkan cuplikan 3 postingan terbaru (tipe media foto/video, likes, komentar, caption, dan link langsung).
- **TikTok Stalker (`.ttstalk` / `.tiktokstalk`):**
  - Menggunakan API Faa (`api-faa.my.id`) untuk mengambil data lengkap akun TikTok.
  - Menampilkan avatar foto profil, nama, user ID, region negara, status akun, tanggal pembuatan akun, bio, total followers, following, likes, video, dan teman.

### 2. 🎮 Integrasi Server Minecraft ServerTap.io (Port 8122) & Sistem Bansos Persistent
- **Pembaruan Koneksi & Anti-Socket Hang Up:** Optimalisasi koneksi ke port aktif 8122 dengan auto-retry interceptor dan non-keepalive socket.
- **Status & Monitoring Server (`.mcstatus` / `.mcplayers`):** Cek TPS, memori RAM, jumlah pemain online, serta detail individual (HP, koordinat, level, & mode game).
- **Claim Bansos Starter Kit Persistent (`.mcclaimbansos` / `.mcbansos`):**
  - Pemain online di Minecraft dapat mengklaim Paket Bansos Starter Kit (Full Iron Armor, Iron Tools, 64 Roti, & Kasur).
  - **Penyimpanan Terintegrasi LowDB (`global.db.data.minecraft_bansos`):** Riwayat klaim tersimpan secara permanen di database JSON sehingga tidak hilang atau ter-reset saat bot di-restart.
  - **Cooldown 24 Jam:** Proteksi jeda waktu klaim 24 jam dengan penghitung waktu mundur (*countdown timer*) yang akurat.
- **Manajemen Koordinat & Sethome (`.mcsave`, `.mccoords`, `.sethome`):**
  - Menyimpan koordinat lokasi penting & titik home player langsung ke database persistent `global.db.data`.

### 3. 📊 Inspeksi Grup WhatsApp (`.inspect` / `.inspectgroup`)
- Inspeksi detail grup WhatsApp menggunakan link undangan (`chat.whatsapp.com/code`), JID grup, atau langsung di dalam grup.
- Menampilkan: Pembuat grup, tanggal pembuatan, ephemeral duration, daftar admin, approval mode, presensi online realtime anggota, serta foto profil grup.

### 4. ⛩️ 🌸 Otakudesu Anime Hub & Web Player Streaming TV
- **Sesi Interaktif (3 Steps):**
  - `Step 1`: Pencarian anime (`.otakusearch <judul>`).
  - `Step 2`: Detail anime, sinopsis, dan pilihan episode / BATCH.
  - `Step 3`: Aksi episode (Download 360p-1080p / Streaming Player).
- **Web Player Streaming TV (`public/anime_stream.html`):** Pemutar video anime web responsive.

### 5. 🎮 Game Interactive Player vs Bot
- **Tic-Tac-Toe (`.ttt` / `.tictactoe` / `.ttc`):** 3 tingkat kesulitan (`Easy`, `Normal`, `Hard` Minimax) dengan integrasi statistik permanent `global.db.data`.
- **Gunting Batu Kertas / Suit Bot (`.suit` / `.gbk`):** Game RPS interaktif.

### 6. 🎨 Maker & Media Downloader Plugins
- **Instagram Downloader & Stalker (`.ig` / `.igdl` / `.igstalk`)**
- **TikTok Downloader & Stalker (`.tt` / `.tiktok` / `.ttstalk`)**
- **Facebook Downloader (`.fb` / `.fbdl`)**
- **YouTube Downloader (`.yt` / `.ytdl`)**
- **Videy Video Uploader (`.videy`)**
- **iPhone Quote Chat Maker (`.iqc` / `.iqcv2`)**
- **Sticker Meme Maker (`.smeme`)**
- **Brat Generator (`.brat` / `.brat --img`)**

### 7. 📈 System Performance Statistics (`.stats` / `.ping`)
- Menampilkan pemakaian CPU, penggunaan RAM, sisa penyimpanan disk, uptime sistem, dan statistik pesan bot secara realtime.

---

## 📋 Ringkasan Perintah Utama

| Perintah | Deskripsi |
| --- | --- |
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
