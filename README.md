# Cimo Self-Bot 🤖 (v1.2.0)

Cimo Self-Bot adalah bot WhatsApp berbasis Node.js yang dirancang khusus untuk penggunaan pribadi (self-bot) dan grup chat. Bot ini menggunakan arsitektur modular berbasis plugin yang mempermudah penambahan fitur baru, serta dilengkapi dengan dashboard web monitoring, Web Player Streaming Anime, dan Web TV.

---

## 🚀 Fitur Unggulan Versi Terbaru (v1.2.0)

### 1. ⛩️ 🌸 Otakudesu Anime Hub & Web Player Streaming TV
Sistem pencarian anime interaktif bersesi 3 langkah dengan tampilan jejepangan aesthetic:
- **Sesi Interaktif (3 Steps):**
  - `Step 1`: Pencarian anime (`.otakusearch <judul>`) dengan memilih nomor `#1` s/d `#10`.
  - `Step 2`: Detail anime, sinopsis, dan pilihan episode / **📦 [BATCH ALL EPISODE]**.
  - `Step 3`: Aksi episode (📥 Download semua kualitas 360p-1080p / 🎬 Streaming Player).
  - Navigasi mudah: Balas `#back` untuk kembali, `#exit` atau `#keluar` untuk mengakhiri sesi.
- **Web Player Streaming TV (`public/anime_stream.html`):** Pemutar video anime web responsive dengan tampilan cyberpunk-jejepangan, animasi kelopak sakura, reload player, dan salin link streaming.
- **Fitur Lengkap Otakudesu:** Pencarian, Detail, Download Episode & Batch, Streaming Player, Jadwal Rilis Mingguan, Ongoing Anime, dan Filter Genre.

### 2. 🎮 Game Interactive Player vs Bot
- **Tic-Tac-Toe (`.ttt` / `.tictactoe` / `.ttc`):** Game Tic-Tac-Toe Player vs Bot dengan 3 tingkat kesulitan:
  - `Easy`: Bot bergerak acak.
  - `Normal`: Campuran 50% Minimax & 50% acak.
  - `Hard`: Bot menggunakan algoritma **Minimax (Tak Terkalahkan)**.
  - Integrasi statistik kemenangan, kekalahan, dan seri yang tersimpan permanen di `src/database.json`.
- **Gunting Batu Kertas / Suit Bot (`.suit` / `.gbk`):** Game RPS interaktif Player vs Bot.

### 3. 🎨 Maker & Media Downloader Plugins
- **iPhone Quote Chat Maker (`.iqc` / `.iqcv2`):** Membuat gambar iPhone quote chat V1 (teks) & V2 (custom jam & baterai).
- **Sticker Meme Maker (`.smeme`):** Membuat stiker meme dari gambar dengan teks atas dan bawah (auto upload & parsing `|`).
- **Brat Generator (`.brat` / `.brat --img`):** Generator teks Brat menjadi stiker atau gambar.
- **Instagram Downloader (`.ig` / `.igdl` / `.reel`):** Unduh media Instagram baik berupa foto (single & carousel slide) maupun video reel.

### 4. 📺 Web Streaming TV Indonesia & Live Chat
Nonton siaran langsung TV Indonesia (RCTI, SCTV, Trans TV, Metro TV, dll.) secara gratis dengan fitur Live Chat Nobar di port `3000`.

### 5. 🧩 Web Dashboard Plugin Monitor (Owner Console)
Dashboard admin web khusus pemilik untuk memantau status plugin, mengedit kode plugin secara live, dan hot-reload plugin tanpa restart server.

---

## 📋 Ringkasan Perintah Baru

| Perintah | Deskripsi |
| --- | --- |
| `.otakusearch <judul>` | Memulai sesi pencarian anime Otakudesu |
| `.otakujadwal` | Melihat jadwal rilis anime mingguan |
| `.otakuongoing` | Melihat daftar anime ongoing terbaru |
| `.otakugenre [slug]` | Melihat daftar genre atau anime per genre |
| `.ttt <easy\|normal\|hard>` | Memulai game Tic-Tac-Toe vs Bot |
| `.suit <batu\|gunting\|kertas>` | Memainkan game Gunting Batu Kertas vs Bot |
| `.iqc <teks>` / `.iqcv2 <teks \| jam \| batre>` | Generator iPhone Quote Chat |
| `.smeme <teks_atas \| teks_bawah>` | Generator Sticker Meme dari gambar |
| `.brat <teks>` / `.brat --img <teks>` | Generator stiker/gambar Brat |
| `.ig <link instagram>` | Downloader foto & video Instagram |
| `.menu` / `.help` | Menampilkan menu utama dengan mention user JID |

---

## 🛠️ Persyaratan Sistem & Instalasi

1. **Persyaratan Sistem:**
   - Node.js versi >= 16
   - **FFmpeg** (Wajib untuk pembuatan stiker webp & konversi media)
     ```bash
     # Di Termux:
     pkg install ffmpeg -y
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
   ```

---

## 🔄 Cara Memperbarui Bot (Update dari GitHub)

```bash
git pull origin main
npm install
npm start
```

---

## 🤝 Lisensi & Hak Cipta
Created & Maintained by **Febriansyah** (febzofc). Open source & free for personal usage!
