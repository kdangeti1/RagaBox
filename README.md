# 🦚 RagaBox — Kid-Friendly Carnatic Music Player & Practice Studio

**RagaBox** is a 100% static, kid-friendly Carnatic music player and practice web application built with **React**, **Vite**, **TypeScript**, and **Tailwind CSS**. It is designed to run entirely on **GitHub Pages** with zero backend server or external database.

---

## ✨ Features

1. **Automated Folder & ID3 Metadata Indexer (`scripts/generate-manifest.mjs`)**
   - Runs automatically before `npm run dev` (`predev`) and `npm run build` (`prebuild`).
   - Syncs audio files from `Music/` into `public/music/` (automatically adding `.m4a`/`.mp3` extensions to extensionless recordings so static servers serve them with proper MIME types).
   - Recursively scans `public/music/` where each subfolder represents a **Category** (`Sarali varisais`, `Janta Varisais`, `Dhaatu varisai`, `Upper sthayi`, `Alankarams`, `Geetham Recordings`, `Swarajathis`, `Jathiswarams`, `Note swarams`, `Varnams`, `Keerthanams`, `Krithis`, `Song Recordings`).
   - Uses `music-metadata` to parse ID3 / audio tags (`title`, `artist`, `album`, `year`, `track`, `genre`, `comment`, `duration`, `fileSize`) with graceful filename fallback, outputting `src/data/songs.json`.

2. **South Indian Classical UI & Practice Controls**
   - Warm ivory/cream (`#FDF9F1`), peacock teal (`#0D6E6E`), and saffron/marigold gold (`#E07A1F` / `#D49B27`) aesthetic with large touch-friendly buttons for kids.
   - **Category Sidebar & Mobile Pills:** Quickly filter by lesson folder with track counts.
   - **Instant Search:** Real-time filtering across song titles, filenames, categories, Ragas, and lyrics.
   - **Persistent Practice Player Bar:**
     - Play/Pause, Next/Previous, `-5s` / `+5s` quick rewind/fast-forward
     - Interactive seek bar with live timestamps and visual A–B loop markers
     - **Repeat Current Song** & **A–B Phrase Loop** (`Set A` / `Set B` / `Clear`) to practice tricky Sangathis or Chittaiswarams
     - **Playback Speed (`Kaalam`) Selector:** `0.75x`, `0.85x`, `1.0x`, `1.25x` with pitch preservation (`preservesPitch = true`) so Shruti never changes.

3. **In-Browser Whisper AI Lyrics & Zero-Backend Persistence**
   - **Pre-loaded Lyrics (`src/data/lyrics.json`):** Pre-committed lyrics load immediately for all users.
   - **In-Browser AI Transcription:** Click **"Generate Lyrics from MP3"** in the Lyrics Drawer to decode the audio file via the **Web Audio API** (resampled to 16kHz mono) and run `@huggingface/transformers` (`Xenova/whisper-tiny` with WebGPU and automatic WASM fallback) inside a **Web Worker**.
   - **Local `IndexedDB` Persistence + Repo Sync:** Generated and manually edited lyrics save automatically to browser `IndexedDB` keyed by `song.id`. Open **Sync Lyrics (Settings)** to **Export `lyrics.json`** (and commit it back to `src/data/lyrics.json`) or **Import `lyrics.json`**.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start local dev server (automatically runs scripts/generate-manifest.mjs first)
npm run dev

# 3. Build production static site into dist/
npm run build

# 4. Preview production build locally
npm run preview
```

---

## 📁 Adding New Songs & Categories

1. Drop your `.mp3` or `.m4a` folders into `public/music/<Category Name>/` (or `Music/<Category Name>/`).
2. Run `npm run dev` or `npm run build` — `scripts/generate-manifest.mjs` will scan all subfolders and update `src/data/songs.json`.

---

## 🌐 Deploying to GitHub Pages

This repository includes `.github/workflows/deploy.yml` which automatically builds and deploys `dist/` to GitHub Pages whenever you push to `main`:

1. Push this repository to GitHub on the `main` branch.
2. In your GitHub repository, go to **Settings → Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions**.
4. Every push to `main` will automatically index `public/music/`, build the static bundle with relative paths (`VITE_BASE_PATH=./`), and publish to GitHub Pages!
