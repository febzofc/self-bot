# Cimo Self-Bot 🤖 (v1.2.0)

Cimo Self-Bot adalah bot WhatsApp berbasis Node.js yang dirancang khusus untuk penggunaan pribadi (self-bot) dan grup chat. Bot ini menggunakan arsitektur modular berbasis plugin yang mempermudah penambahan fitur baru, serta dilengkapi dengan dashboard web monitoring, Web Player Streaming Anime, Web TV, dan Integrasi Server Minecraft ServerTap.io.

---

## 🚀 Fitur Unggulan Versi Terbaru (v1.2.0)

### 1. 🎮 Integrasi Server Minecraft ServerTap.io & Sistem Bansos Persistent
- **Status & Monitoring Server (`.mcstatus` / `.mcplayers`):** Cek TPS, memori RAM, jumlah pemain online, serta detail individual (HP, koordinat, level, & mode game).
- **Claim Bansos Starter Kit Persistent (`.mcclaimbansos` / `.mcbansos`):**
  - Pemain online di Minecraft dapat mengklaim Paket Bansos Starter Kit (Full Iron Armor, Iron Tools, 64 Roti, & Kasur).
  - **Penyimpanan Terintegrasi LowDB (`global.db.data.minecraft_bansos`):** Riwayat klaim tersimpan secara permanen di database JSON sehingga tidak hilang atau ter-reset saat bot di-restart.
  - **Cooldown 24 Jam:** Proteksi jeda waktu klaim 24 jam dengan penghitung waktu mundur (*countdown timer*) yang akurat.
- **Manajemen Koordinat & Sethome (`.mcsave`, `.mccoords`, `.sethome`, `.mctp`):**
  - Menyimpan koordinat lokasi penting & titik home player langsung ke database persistent `global.db.data`.
  - Tenteleportasi pemain ke lokasi tersimpan atau ke tempat pemain lain.

### 2. 📊 Inspeksi Grup WhatsApp (`.inspect` / `.inspectgroup`)
- Inspeksi detail grup WhatsApp menggunakan link undangan (`chat.whatsapp.com/code`), JID grup, atau langsung di dalam grup.
- Menampilkan: Pembuat grup, tanggal pembuatan, ephemeral duration, daftar admin, approval mode, presensi online realtime anggota, serta foto profil grup.

### 3. ⛩️ 🌸 Otakudesu Anime Hub & Web Player Streaming TV
- **Sesi Interaktif (3 Steps):**
  - `Step 1`: Pencarian anime (`.otakusearch <judul>`).
  - `Step 2`: Detail anime, sinopsis, dan pilihan episode / BATCH.
  - `Step 3`: Aksi episode (Download 360p-1080p / Streaming Player).
- **Web Player Streaming TV (`public/anime_stream.html`):** Pemutar video anime web responsive.

### 4. 🎮 Game Interactive Player vs Bot
- **Tic-Tac-Toe (`.ttt` / `.tictactoe` / `.ttc`):** 3 tingkat kesulitan (`Easy`, `Normal`, `Hard` Minimax) dengan integrasi statistik permanent `global.db.data`.
- **Gunting Batu Kertas / Suit Bot (`.suit` / `.gbk`):** Game RPS interaktif.

### 5. 🎨 Maker & Media Downloader Plugins
- **iPhone Quote Chat Maker (`.iqc` / `.iqcv2`)**
- **Sticker Meme Maker (`.smeme`)**
- **Brat Generator (`.brat` / `.brat --img`)**
- **Instagram Downloader (`.ig` / `.igdl` / `.reel`)**

### 6. 📈 System Performance Statistics (`.stats` / `.ping`)
- Menampilkan pemakaian CPU, penggunaan RAM, sisa penyimpanan disk, uptime sistem, dan statistik pesan bot secara realtime.

---

## 📋 Ringkasan Perintah Utama

| Perintah | Deskripsi |
| --- | --- |
| `.mcstatus` / `.mcinfo` | Menampilkan status TPS, RAM, & Uptime Server Minecraft |
| `.mcplayers` / `.mclist` | Menampilkan daftar pemain online di server Minecraft |
| `.mcclaimbansos <player>` | Klaim Paket Bansos Starter Kit Minecraft (Cooldown 24 Jam, Persistent DB) |
| `.mcsave <x> <y> <z> <nama>` | Menyimpan koordinat lokasi penting ke database |
| `.mccoords` / `.mclistc` | Menampilkan daftar koordinat lokasi tersimpan |
| `.sethome <player> <nama>` | Menyimpan lokasi rumah pemain di Minecraft |
| `.mctp <player> <target>` | Teleportasi pemain di dalam server Minecraft |
| `.inspect` [link/JID] | Inspeksi & analisis informasi grup WhatsApp |
| `.stats` / `.ping` | Menampilkan statistik performa sistem & server bot |
| `.otakusearch <judul>` | Memulai sesi pencarian anime Otakudesu |
| `.ttt <easy\|normal\|hard>` | Memulai game Tic-Tac-Toe vs Bot |
| `.suit <batu\|gunting\|kertas>` | Memainkan game Gunting Batu Kertas vs Bot |
| `.iqc <teks>` | Generator iPhone Quote Chat |
| `.smeme <teks_atas \| teks_bawah>` | Generator Sticker Meme |
| `.brat <teks>` | Generator stiker/gambar Brat |
| `.ig <link instagram>` | Downloader foto & video Instagram |
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
