# RagaBox Music Directory (`public/music/`)

Drop your Carnatic practice folders here! Each subfolder inside `public/music/` automatically becomes a **Category** in RagaBox.

## Example Folder Structure

```text
public/music/
├── Sarali varisais/
│   ├── Sarali 1-3.m4a
│   └── Sarali 4-5.m4a
├── Janta Varisais/
│   └── Janta Varisai #1.m4a
├── Alankarams/
│   └── Chathushra_Dhruva.m4a
├── Geetham Recordings/
│   └── Shreegananatha.m4a
├── Keerthanams/
│   └── Bhajare yadunatham.m4a
├── Varnams/
│   └── Ninnukori_mohanam.m4a
└── Song Recordings/
    └── Maithreem bajatha.m4a
```

## Supported Formats & Automatic Indexing

- **Supported Audio Files:** `.mp3`, `.m4a`, `.wav`, `.ogg`, `.aac`, `.flac`
- Whenever you run `npm run dev` or `npm run build`, `scripts/generate-manifest.mjs` automatically:
  1. Syncs any audio files from the root `Music/` folder into `public/music/`
  2. Parses ID3 / audio metadata tags (`title`, `artist`, `album`, `year`, `track`, `genre`, `comment`, `duration`, `fileSize`)
  3. Falls back cleanly to a formatted filename if tags are missing
  4. Writes the complete catalog to `src/data/songs.json`
