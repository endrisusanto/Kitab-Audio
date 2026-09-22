# 🎧 Kitab Audio - Interactive Audio Gear Guide & AI Assistant

Aplikasi web interaktif untuk eksplorasi katalog, tier list, dan rekomendasi perangkat audio dari database legendaris **"Kitab Audio Fernanda Gunsan"** (mencakup 812+ item di 21 kategori audio gear).

Dibangun dengan filosofi **Antislop** (copywriting jujur tanpa jargon marketing klise, bebas em dash, kontras tinggi WCAG AA) dan **Ponytail** (kode murni Vanilla JS/CSS yang ramping, instan, zero external heavy dependencies).

---

## ✨ Fitur Utama

- **🤖 Asisten AI Audio (LMStudio RAG Integration):**
  - Terhubung langsung ke endpoint LMStudio lokal (`google/gemma-4-e4b`, `google/gemma-4-12b-qat`, `qwen3.6-35b-a3b-uncensored-hauhaucs-aggressive`).
  - Dilengkapi RAG (*Retrieval-Augmented Generation*) berbasis database Kitab Audio.
  - Secara otomatis merender **Kartu Produk Interaktif** pada setiap rekomendasi AI (nama, tier, harga, skor VFM, tombol detail review, dan link toko).
- **🎛️ Dual-Handle Price Range Slider:**
  - Slider dua handle interaktif untuk menentukan batas bawah (*min*) dan batas atas (*max*) harga dari Rp 0 s.d. Rp 25.000.000 dengan preset instan.
- **🏷️ Filter Tier Lengkap (Tier SS s.d. Tier E):**
  - Filter chip multi-pilihan untuk seluruh ranking tier (*Semua, Tier SS/SSS, Tier S, Tier A, Tier B, Tier C, Tier D, Tier E*).
- **⚖️ Fullwidth Side-by-Side Comparison:**
  - Modal komparasi lapang (*ultra-wide layout*) untuk membandingkan 2 hingga 4 perangkat sekaligus (Tier, Value for Money, grafik rating suara per frekuensi, spesifikasi driver/codec, ANC/Mic, dan link pembelian).
- **⌨️ Typewriter Audio Concierge:**
  - Pemandu rekomendasi bertahap interaktif dengan animasi ketik mesin tik untuk menentukan gear berdasarkan kategori, budget, karakter suara, dan kebutuhan fitur khusus.
- **📂 Katalog 21 Kategori Lengkap:**
  - Tab navigasi untuk *TWS, TWS No Karet, IEM, OWS, Headphone, Dongle DAC, Bluetooth DAC, Desktop DAC, Gaming, Mic, Clip On Wireless, Speaker, Soundbar, DAP, Soundcard, Kabel, Eartips, Charger, dll.*
- **🌓 Dark & Light Mode:**
  - Toggle tema instan dengan persistensi *localStorage* dan palet warna studio yang nyaman di mata.
- **🌐 Open Graph & Modern SVG Favicon:**
  - Dilengkapi favicon vector SVG tajam dan tag Open Graph lengkap untuk sharing WhatsApp, Telegram, Discord, dan media sosial.

---

## 🚀 Panduan Menjalankan

### Opsi 1: Menjalankan dengan Docker (Disarankan)

Aplikasi telah terkonfigurasi dengan Docker & Docker Compose menggunakan base image ringan Python 3.11 Alpine.

```bash
# Jalankan container di background
docker compose up --build -d
```

Buka browser dan akses: **[http://localhost:8000](http://localhost:8000)**

Untuk menghentikan container:
```bash
docker compose down
```

---

### Opsi 2: Menjalankan Langsung (Python Lokal)

Pastikan Python 3 sudah terpasang di sistem Anda.

```bash
# 1. Ekstraksi / perbarui data dari spreadsheet Excel (opsional, otomatis dijalankan)
python3 scripts/parse_excel.py

# 2. Jalankan server
python3 server.py
```

Buka browser dan akses: **[http://localhost:8080](http://localhost:8080)** (atau sesuaikan port via `PORT=8000 python3 server.py`).

---

## 🛠️ Arsitektur & Struktur Direktori

```text
Kitab-Audio/
├── Dockerfile                   # Docker build configuration (Python Alpine)
├── docker-compose.yml           # Compose file (Port 8000:8080)
├── server.py                    # Lightweight Python HTTP server & LMStudio AI Proxy
├── scripts/
│   └── parse_excel.py           # Parser spreadsheet .xlsx ke data JSON tanpa 3rd-party libs
├── src/
│   ├── index.html               # Main single-page application UI
│   ├── favicon.svg              # Vector SVG branding icon
│   ├── css/
│   │   └── style.css            # Vanilla CSS design system (tokens, themes, animations)
│   ├── js/
│   │   ├── app.js               # Catalog engine, filters, compare, modal detail
│   │   ├── typewriter.js        # Interactive guidance concierge
│   │   └── chat.js              # AI chat client with interactive product cards
│   └── data/
│       └── audio_data.json      # Structured database (812+ items, 21 categories)
├── .gitignore
└── README.md
```

---

## 🤖 Konfigurasi Model AI (LMStudio)

Server secara default terhubung ke endpoint LMStudio OpenAI-compatible:
```bash
LMSTUDIO_BASE_URL=https://lmstudio.endrisusanto.my.id/v1
```
Anda dapat mengubah endpoint ini melalui environment variable saat menjalankan container atau server lokal.

---

## 📜 Lisensi & Atribusi

- **Database & Review:** Berdasarkan kompilasi dan review audio gear oleh **Fernanda Gunsan** (*Update 14-09-2026*).
- **Web App:** Dibuat oleh **[Endri Susanto](https://github.com/endrisusanto)**.
