import type { LyricEntry, LyricsMap } from '../types';
import preloadedLyricsJson from '../data/lyrics.json';

const DB_NAME = 'ragabox-lyrics-db';
const DB_VERSION = 1;
const STORE_NAME = 'lyrics';

const preloadedLyrics: LyricsMap = (preloadedLyricsJson as LyricsMap) || {};

function openLyricsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'songId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load all locally saved lyrics from IndexedDB.
 */
export async function getAllIndexedDBLyrics(): Promise<LyricsMap> {
  try {
    const db = await openLyricsDB();
    return await new Promise<LyricsMap>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const entries = (req.result || []) as LyricEntry[];
        const map: LyricsMap = {};
        for (const entry of entries) {
          if (entry && entry.songId) {
            map[entry.songId] = entry;
          }
        }
        resolve(map);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB unavailable, falling back to preloaded lyrics:', err);
    return {};
  }
}

/**
 * Returns the merged lyrics dictionary (preloaded lyrics from src/data/lyrics.json
 * overlaid with user/AI lyrics stored in browser IndexedDB).
 */
export async function getMergedLyrics(): Promise<{
  merged: LyricsMap;
  localCount: number;
  preloadedCount: number;
}> {
  const localMap = await getAllIndexedDBLyrics();
  const merged: LyricsMap = {
    ...preloadedLyrics,
    ...localMap,
  };
  return {
    merged,
    localCount: Object.keys(localMap).length,
    preloadedCount: Object.keys(preloadedLyrics).length,
  };
}

/**
 * Save a single song's lyric entry into IndexedDB.
 */
export async function saveLyricToIndexedDB(entry: LyricEntry): Promise<void> {
  const db = await openLyricsDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Remove a locally overridden lyric entry from IndexedDB (restores preloaded if present).
 */
export async function deleteLocalLyricFromIndexedDB(songId: string): Promise<LyricEntry | undefined> {
  const db = await openLyricsDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(songId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return preloadedLyrics[songId];
}

/**
 * Bulk import a lyrics.json object into IndexedDB.
 */
export async function importLyricsMapToIndexedDB(imported: LyricsMap): Promise<number> {
  const db = await openLyricsDB();
  let count = 0;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const [key, val] of Object.entries(imported)) {
      if (val && typeof val.text === 'string') {
        const entry: LyricEntry = {
          songId: val.songId || key,
          title: val.title || key,
          text: val.text,
          source: val.source || 'imported',
          updatedAt: val.updatedAt || new Date().toISOString(),
        };
        store.put(entry);
        count++;
      }
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return count;
}

/**
 * Triggers a browser download of the merged `lyrics.json` file so the user can commit it
 * directly to `src/data/lyrics.json` in their GitHub repository.
 */
export async function exportMergedLyricsJson(): Promise<void> {
  const { merged } = await getMergedLyrics();
  const sortedKeys = Object.keys(merged).sort();
  const ordered: LyricsMap = {};
  for (const key of sortedKeys) {
    ordered[key] = merged[key];
  }
  const jsonString = JSON.stringify(ordered, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lyrics.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Check if a song has a preloaded lyric in src/data/lyrics.json.
 */
export function getPreloadedLyric(songId: string): LyricEntry | undefined {
  return preloadedLyrics[songId];
}
