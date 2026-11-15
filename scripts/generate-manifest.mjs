import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { parseFile } from 'music-metadata';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const SOURCE_MUSIC_DIR = path.join(ROOT_DIR, 'Music');
const PUBLIC_MUSIC_DIR = path.join(ROOT_DIR, 'public', 'music');
const OUTPUT_DIR = path.join(ROOT_DIR, 'src', 'data');
const SONGS_JSON_PATH = path.join(OUTPUT_DIR, 'songs.json');
const LYRICS_JSON_PATH = path.join(OUTPUT_DIR, 'lyrics.json');

const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.wav', '.ogg', '.aac', '.flac', '.webm']);
const IGNORED_FOLDERS = new Set(['Geethams_Lyrics', 'Keerthanam lyrics', 'Song lyrics']);

/**
 * Detect if an extensionless file is actually an audio file via magic bytes.
 * Returns '.m4a', '.mp3', '.wav', '.ogg', or null.
 */
function detectAudioExtension(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size < 16) return null;
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);

    const ascii = buf.toString('ascii');
    if (ascii.includes('ftypM4A') || ascii.includes('ftypmp42') || ascii.includes('ftypisom')) {
      return '.m4a';
    }
    if (ascii.startsWith('ID3') || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) {
      return '.mp3';
    }
    if (ascii.startsWith('RIFF') && ascii.includes('WAVE')) {
      return '.wav';
    }
    if (ascii.startsWith('OggS')) {
      return '.ogg';
    }
  } catch {
    // ignore read errors
  }
  return null;
}

/**
 * Sync audio files from root `Music/` directory (if present) into `public/music/`.
 * Adds file extensions to extensionless M4A/MP3 files so static web servers (GitHub Pages)
 * serve them with proper audio MIME types.
 */
function syncSourceMusicFolder() {
  if (!fs.existsSync(SOURCE_MUSIC_DIR)) return;

  function walkAndSync(currentSrcDir, relDir = '') {
    const entries = fs.readdirSync(currentSrcDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const srcFullPath = path.join(currentSrcDir, entry.name);

      if (entry.isDirectory()) {
        if (IGNORED_FOLDERS.has(entry.name)) continue;
        walkAndSync(srcFullPath, path.join(relDir, entry.name));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        let targetExt = AUDIO_EXTENSIONS.has(ext) ? ext : null;
        let destFileName = entry.name;

        if (!targetExt && !ext) {
          const detected = detectAudioExtension(srcFullPath);
          if (detected) {
            targetExt = detected;
            destFileName = `${entry.name}${detected}`;
          }
        }

        if (!targetExt) continue;

        const targetSubfolder = relDir || 'Basics & Exercises';
        const destDir = path.join(PUBLIC_MUSIC_DIR, targetSubfolder);
        fs.mkdirSync(destDir, { recursive: true });
        const destFullPath = path.join(destDir, destFileName);

        const srcStat = fs.statSync(srcFullPath);
        const needCopy =
          !fs.existsSync(destFullPath) ||
          fs.statSync(destFullPath).size !== srcStat.size;

        if (needCopy) {
          fs.copyFileSync(srcFullPath, destFullPath);
        }
      }
    }
  }

  walkAndSync(SOURCE_MUSIC_DIR);
}

/**
 * Clean up raw filename into a kid-friendly display title when ID3 title is missing.
 */
function cleanTitleFromFilename(fileName) {
  const withoutExt = fileName.replace(/\.[^/.]+$/, '');
  return withoutExt
    .replace(/_/g, ' ')
    .replace(/&/g, ' & ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Create a deterministic, URL/IndexedDB-safe ID from category + filename.
 */
function createSongId(relativePath) {
  return relativePath
    .toLowerCase()
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Extract plain text from a .docx file using Node's built-in zlib via the ZIP Central Directory.
 */
function extractDocxText(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    // Scan Central Directory headers (0x02014b50) which always contain accurate compressed size
    for (let i = 0; i < buf.length - 46; i++) {
      if (buf.readUInt32LE(i) !== 0x02014b50) continue;
      const compMethod = buf.readUInt16LE(i + 10);
      const compSize = buf.readUInt32LE(i + 20);
      const nameLen = buf.readUInt16LE(i + 28);
      const extraLen = buf.readUInt16LE(i + 30);
      const commentLen = buf.readUInt16LE(i + 32);
      const localOffset = buf.readUInt32LE(i + 42);
      const name = buf.toString('utf8', i + 46, i + 46 + nameLen);

      if (name === 'word/document.xml' && localOffset + 30 < buf.length) {
        const localNameLen = buf.readUInt16LE(localOffset + 26);
        const localExtraLen = buf.readUInt16LE(localOffset + 28);
        const dataStart = localOffset + 30 + localNameLen + localExtraLen;
        const raw = buf.subarray(dataStart, dataStart + compSize);
        const xml = (compMethod === 8 ? zlib.inflateRawSync(raw) : raw).toString('utf8');
        return xml
          .replace(/<\/w:p>/g, '\n')
          .replace(/<w:br[^>]*\/>/g, '\n')
          .replace(/<w:tab[^>]*\/>/g, '  ')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/\r\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      }
      i += 45 + nameLen + extraLen + commentLen;
    }
  } catch {
    // ignore corrupt/unsupported docx
  }
  return '';
}

/**
 * Normalize string for fuzzy matching between song titles and lyric filenames,
 * including South Indian phonetic transliteration normalization (bh->b, dh->d, aa->a, etc.).
 */
function normalizeForMatch(str) {
  return str
    .toLowerCase()
    .replace(/\.[^/.]+$/, '')
    .replace(/\(\d+\)/g, '')
    .replace(/\b(copy of|song|updated|compressed|pallavi|anupallavi|charanam|swaram|sahithyam|part\s*\d+)\b/g, '')
    .replace(/bh/g, 'b')
    .replace(/dh/g, 'd')
    .replace(/th/g, 't')
    .replace(/sh/g, 's')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/ph/g, 'p')
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/[^a-z0-9]/g, '');
}

const CLASSIC_CARNATIC_LYRICS = [
  {
    match: ['shreegananatha', 'srigananatha'],
    text: `Geetham 1: Shree Gananatha (Pillari Geetham)\nRaagam: Malahari (15th Melakarta Mayamalavagowla Janya)\nThaalam: Rupakam (6 Beats)\nComposer: Purandaradasa\n\nArohanam: S R1 M1 P D1 S'\nAvarohanam: S' D1 P M1 G3 R1 S\n\nSahithyam:\nShree Gananatha Sindhoora Varna\nKaruna Sagara Kari Vadana\nLambodhara Lakumi Karaa\nAmba Sutha Amara Vinutha\n\nSwaram & Sahithyam (1st Charanam):\nM P | D S' D P || M P | D S' D P ||\nShree - | Ga na na tha || Sin - | dhoo ra var na ||\nR M | P D M P || D P | M G R S ||\nKa ru | na Sa ga ra || Ka ri | va da na - ||`,
  },
  {
    match: ['kundagowra', 'gurunaatha', 'gurunatha'],
    text: `Geetham 2: Kunda Gowra (Guru Naatha)\nRaagam: Malahari\nThaalam: Rupakam\nComposer: Purandaradasa\n\nArohanam: S R1 M1 P D1 S'\nAvarohanam: S' D1 P M1 G3 R1 S\n\nSahithyam:\nKunda Gowra Gowri Vara\nMandiraya Maana Makuta\nMandara Kusumaabharana\nMadhuratara Haasa\nBandaasura Mada Khandana\nMandara Giridhara\nPurandara Vitala\nGuhaambika Ramana`,
  },
  {
    match: ['kerayaneeranu', 'kamalajadhala'],
    text: `Geetham: Kamala Jaadala\nRaagam: Kalyani (65th Melakarta)\nThaalam: Triputa\n\nArohanam: S R2 G3 M2 P D2 N3 S'\nAvarohanam: S' N3 D2 P M2 G3 R2 S\n\nSahithyam:\nKamala Jaadala Vimala Sunayana\nKarivarada Karunaambudhe\nKarunaambudhe Deva Shaila\nDhrutaaraathey Kamalaakaanthaa`,
  },
  {
    match: ['padumanabha'],
    text: `Geetham: Padumanabha\nRaagam: Malahari\nThaalam: Triputa\nComposer: Purandaradasa\n\nArohanam: S R1 M1 P D1 S'\nAvarohanam: S' D1 P M1 G3 R1 S\n\nSahithyam:\nPadumanabha Parama Purusha\nParama Jyothi Swaroopa\nVidhura Vandhya Vimala Charitha\nVihanga Adhirohana\nUdadhi Nivaasa Uraga Shayana\nUnnathaonnatha Mahima\nYadukulothama Yagna Rakshaka\nYagnashikshaka Rama Nama`,
  },
  {
    match: ['varaveena'],
    text: `Geetham: Varaveena Mrudupaani\nRaagam: Mohanam (28th Melakarta Harikambhoji Janya)\nThaalam: Rupakam\nComposer: Appayya Dikshitar\n\nArohanam: S R2 G3 P D2 S'\nAvarohanam: S' D2 P G3 R2 S\n\nSahithyam:\nVaraveena Mrudupaani Vanaruha Lochana Raani\nSuruchira Bambhara Veni Suranuta Kalyaani\nNirupama Shubhaguna Lolaa Nirataya Jaya Prada Sheela\nVaradaapriya Ranganaayaki Vaanchita Phala Daayaki\nSaraseegaasana Janani Jaya Jaya Jaya`,
  },
  {
    match: ['aanalekara', 'analekara'],
    text: `Geetham: Aanalekara\nRaagam: Shuddha Saveri (29th Melakarta Dheerasankarabharanam Janya)\nThaalam: Triputa\n\nArohanam: S R2 M1 P D2 S'\nAvarohanam: S' D2 P M1 R2 S\n\nSahithyam:\nAanalekara Unnipoladi\nSakala Shastra Puraanaadi\nThaaladi Dhaadhi\nPaadadi Parama\nAanalekara Unnipoladi`,
  },
  {
    match: ['kamasulochana', 'kaamasulochana'],
    text: `Geetham: Kaama Sulochana\nRaagam: Anandabhairavi\nThaalam: Chathushra Dhruva\n\nSahithyam:\nKaama Sulochana Kaladhara Vadhana\nKaamitha Phaladaayaki Kalyani\nShyama Sundaraangaari Shankari\nSaamagaana Lolaambike`,
  },
  {
    match: ['raravenu'],
    text: `Swarajathi: Rara Venu Gopala Bala\nRaagam: Bilahari (29th Melakarta Dheerasankarabharanam Janya)\nThaalam: Adi (8 Beats)\n\nArohanam: S R2 G3 P D2 S'\nAvarohanam: S' N3 D2 P M1 G3 R2 S\n\nPallavi:\nRara Venu Gopala Bala\nRaajitha Sadguna Jayasheela\n\nAnupallavi:\nSaarasaaksha Nera Memi Marubaa-\ndhaakorva Taramaa\n\nCharanam 1:\nNandagopaalaa Needu Paiponga-\nchu Nuvemaa Haarathuluga\nVandanaalu Chesithiraa`,
  },
  {
    match: ['sambasivayanave', 'sambhashivayanave'],
    text: `Swarajathi: Samba Shivaayanave\nRaagam: Khamas (28th Melakarta Harikambhoji Janya)\nThaalam: Adi (8 Beats)\nComposer: Chinna Krishna Dasa\n\nArohanam: S M1 G3 M1 P D2 N2 S'\nAvarohanam: S' N2 D2 P M1 G3 R2 S\n\nPallavi:\nSamba Shivaayanave Rajita Giri\nShaambhavi Manoharaa Parathparaa\nKripaakaraa श्री`,
  },
  {
    match: ['ninnukori'],
    text: `Adi Thaala Varnam: Ninnu Kori\nRaagam: Mohanam (28th Melakarta Janya)\nThaalam: Adi\nComposer: Poochi Srinivasa Iyengar\n\nArohanam: S R2 G3 P D2 S'\nAvarohanam: S' D2 P G3 R2 S\n\nPallavi:\nNinnu Kori Yunnanura\nNikhila Loka Nayaka\n\nAnupallavi:\nPannagendra Shayana\nPankaja Nabha Parama Dayalo\n\nCharanam:\nSarasijaaksha Neeve Gathiyani`,
  },
];

/**
 * Ensure sample folders and README exist in public/music/
 */
function ensurePublicMusicStructure() {
  fs.mkdirSync(PUBLIC_MUSIC_DIR, { recursive: true });
  const readmePath = path.join(PUBLIC_MUSIC_DIR, 'README.md');
  if (!fs.existsSync(readmePath)) {
    const readmeContent = `# RagaBox Music Directory (\`public/music/\`)

Drop your Carnatic practice folders here! Each subfolder inside \`public/music/\` automatically becomes a **Category** in RagaBox.

## Example Folder Structure

\`\`\`text
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
\`\`\`

## Supported Formats & Automatic Indexing

- **Supported Audio Files:** \`.mp3\`, \`.m4a\`, \`.wav\`, \`.ogg\`, \`.aac\`, \`.flac\`
- Whenever you run \`npm run dev\` or \`npm run build\`, \`scripts/generate-manifest.mjs\` automatically:
  1. Syncs any audio files from the root \`Music/\` folder into \`public/music/\`
  2. Parses ID3 / audio metadata tags (\`title\`, \`artist\`, \`album\`, \`year\`, \`track\`, \`genre\`, \`comment\`, \`duration\`, \`fileSize\`)
  3. Falls back cleanly to a formatted filename if tags are missing
  4. Writes the complete catalog to \`src/data/songs.json\`
`;
    fs.writeFileSync(readmePath, readmeContent, 'utf8');
  }
}

/**
 * Recursively scan public/music/ and return all discovered audio files.
 */
function findAudioFiles(dir, baseDir = dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findAudioFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (AUDIO_EXTENSIONS.has(ext)) {
        const relFromMusic = path.relative(baseDir, fullPath).split(path.sep).join('/');
        const parts = relFromMusic.split('/');
        const category = parts.length > 1 ? parts[0] : 'General';
        results.push({
          fullPath,
          fileName: entry.name,
          relativePath: `music/${relFromMusic}`,
          category,
        });
      }
    }
  }
  return results;
}

/**
 * Build pre-loaded lyrics map from existing src/data/lyrics.json + .docx files in Music/ + classic Carnatic practice guides.
 */
function buildLyricsCatalog(songs) {
  let existingLyrics = {};
  if (fs.existsSync(LYRICS_JSON_PATH)) {
    try {
      existingLyrics = JSON.parse(fs.readFileSync(LYRICS_JSON_PATH, 'utf8'));
    } catch {
      existingLyrics = {};
    }
  }

  // Collect .docx lyrics from Music/Keerthanam lyrics and Music/Song lyrics
  const docxEntries = [];
  for (const lyricFolder of ['Keerthanam lyrics', 'Song lyrics']) {
    const folderPath = path.join(SOURCE_MUSIC_DIR, lyricFolder);
    if (!fs.existsSync(folderPath)) continue;
    for (const file of fs.readdirSync(folderPath)) {
      if (file.toLowerCase().endsWith('.docx')) {
        const text = extractDocxText(path.join(folderPath, file));
        if (text && text.length > 15) {
          docxEntries.push({
            file,
            norm: normalizeForMatch(file),
            text,
          });
        }
      }
    }
  }

  // Match songs to docx lyrics or helpful Carnatic abhyasa varisai notation
  for (const song of songs) {
    if (existingLyrics[song.id]) continue;

    const songNorm = normalizeForMatch(song.title);
    let matchedDocx = null;
    for (const doc of docxEntries) {
      if (!doc.norm || !songNorm) continue;
      if (
        songNorm.includes(doc.norm) ||
        doc.norm.includes(songNorm) ||
        (songNorm.length >= 6 && doc.norm.slice(0, 6) === songNorm.slice(0, 6))
      ) {
        matchedDocx = doc;
        break;
      }
    }

    const classicMatch = CLASSIC_CARNATIC_LYRICS.find((c) =>
      c.match.some((m) => songNorm.includes(normalizeForMatch(m)))
    );

    if (matchedDocx) {
      existingLyrics[song.id] = {
        songId: song.id,
        title: song.title,
        text: matchedDocx.text,
        source: 'preloaded',
        updatedAt: '2026-11-15T00:00:00.000Z',
      };
    } else if (classicMatch) {
      existingLyrics[song.id] = {
        songId: song.id,
        title: song.title,
        text: classicMatch.text,
        source: 'preloaded',
        updatedAt: '2026-11-15T00:00:00.000Z',
      };
    } else if (song.category.toLowerCase().includes('sarali')) {
      existingLyrics[song.id] = {
        songId: song.id,
        title: song.title,
        text: `Raagam: Mayamalavagowla (15th Melakarta)\nThaalam: Adi (8 Beats)\n\nArohanam: S R1 G3 M1 P D1 N3 S'\nAvarohanam: S' N3 D1 P M1 G3 R1 S\n\nPractice Tip:\n• Sing in 3 Kaalams (speeds) with steady Shruti and Laya.\n• Use the A–B Loop and 0.75x / 0.85x speed controls below to practice difficult phrases!`,
        source: 'preloaded',
        updatedAt: '2026-11-15T00:00:00.000Z',
      };
    } else if (song.category.toLowerCase().includes('janta')) {
      existingLyrics[song.id] = {
        songId: song.id,
        title: song.title,
        text: `Raagam: Mayamalavagowla (15th Melakarta)\nThaalam: Adi (8 Beats)\n\nJanta Varisai Pattern:\nSS RR GG MM | PP DD | NN S'S' ||\nS'S' NN DD PP | MM GG | RR SS ||\n\nPractice Tip:\n• Stress the second swaram of each pair using nabhi (diaphragm) gamakam.`,
        source: 'preloaded',
        updatedAt: '2026-11-15T00:00:00.000Z',
      };
    } else if (song.category.toLowerCase().includes('alankaram')) {
      existingLyrics[song.id] = {
        songId: song.id,
        title: song.title,
        text: `Suladi Sapta Thaala Alankaram — ${song.title}\nRaagam: Mayamalavagowla\n\nPractice Tip:\n• Keep clear Laghu, Dhrutham, and Anudhrutham hand beats.\n• Practice in 1st, 2nd, and 3rd speeds.`,
        source: 'preloaded',
        updatedAt: '2026-11-15T00:00:00.000Z',
      };
    }
  }

  return existingLyrics;
}

async function generateManifest() {
  console.log('🎵 [RagaBox] Syncing & scanning music library...');
  ensurePublicMusicStructure();
  syncSourceMusicFolder();

  const audioFiles = findAudioFiles(PUBLIC_MUSIC_DIR);
  const songs = [];

  for (const item of audioFiles) {
    const stat = fs.statSync(item.fullPath);
    let title = cleanTitleFromFilename(item.fileName);
    let artist = 'Carnatic Practice';
    let album = item.category;
    let year = null;
    let track = null;
    let genre = 'Carnatic Classical';
    let comment = '';
    let duration = 0;

    try {
      const metadata = await parseFile(item.fullPath, { duration: true, skipCovers: true });
      const { common, format } = metadata;

      if (common.title && common.title.trim()) {
        title = cleanTitleFromFilename(common.title.trim());
      }
      if (common.artist && common.artist.trim()) {
        artist = common.artist.trim();
      }
      if (common.album && common.album.trim()) {
        album = common.album.trim();
      }
      if (common.year) {
        year = common.year;
      }
      if (common.track && common.track.no) {
        track = common.track.no;
      }
      if (common.genre && common.genre.length > 0 && common.genre[0]) {
        genre = common.genre.join(', ');
      }
      if (common.comment && common.comment.length > 0) {
        const firstComment = common.comment[0];
        comment = typeof firstComment === 'string' ? firstComment : (firstComment?.text || '');
      }
      if (format.duration && Number.isFinite(format.duration)) {
        duration = Math.round(format.duration * 10) / 10;
      }
    } catch (err) {
      console.warn(`⚠️  Could not parse metadata for ${item.relativePath}: ${err.message}`);
    }

    const id = createSongId(item.relativePath);
    const searchText = [
      title,
      item.fileName,
      item.category,
      artist,
      album,
      genre,
      comment,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    songs.push({
      id,
      fileName: item.fileName,
      relativePath: item.relativePath,
      category: item.category,
      title,
      artist,
      album,
      year,
      track,
      genre,
      comment,
      fileSize: stat.size,
      duration,
      searchText,
    });
  }

  // Sort songs by category, then natural sort by title
  songs.sort((a, b) => {
    const catCmp = a.category.localeCompare(b.category, undefined, { numeric: true, sensitivity: 'base' });
    if (catCmp !== 0) return catCmp;
    return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
  });

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(SONGS_JSON_PATH, JSON.stringify(songs, null, 2), 'utf8');

  const lyricsCatalog = buildLyricsCatalog(songs);
  fs.writeFileSync(LYRICS_JSON_PATH, JSON.stringify(lyricsCatalog, null, 2), 'utf8');

  const categories = new Set(songs.map((s) => s.category));
  console.log(
    `✅ [RagaBox] Indexed ${songs.length} songs across ${categories.size} categories into src/data/songs.json`
  );
  console.log(
    `✅ [RagaBox] Prepared ${Object.keys(lyricsCatalog).length} pre-loaded lyric entries in src/data/lyrics.json`
  );
}

generateManifest().catch((err) => {
  console.error('❌ [RagaBox] Failed to generate manifest:', err);
  process.exit(1);
});
