export interface Song {
  id: string;
  fileName: string;
  relativePath: string;
  category: string;
  title: string;
  artist: string;
  album: string;
  year?: number | null;
  track?: number | null;
  genre?: string;
  comment?: string;
  fileSize?: number;
  duration: number;
  searchText: string;
}

export type LyricSource = 'preloaded' | 'ai-whisper' | 'manual-edit' | 'imported';

export interface LyricEntry {
  songId: string;
  title: string;
  text: string;
  source: LyricSource;
  updatedAt: string;
}

export type LyricsMap = Record<string, LyricEntry>;

export type PlaybackSpeed = 0.75 | 0.85 | 1.0 | 1.25;

export interface LoopState {
  repeatSong: boolean;
  pointA: number | null;
  pointB: number | null;
}

export interface WhisperProgressEvent {
  type: 'status' | 'download' | 'chunk' | 'complete' | 'error';
  songId: string;
  status?: string;
  file?: string;
  progress?: number;
  text?: string;
  device?: 'webgpu' | 'wasm';
  error?: string;
}
