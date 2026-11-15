import React, { useRef, useState } from 'react';
import {
  X,
  Download,
  Upload,
  CheckCircle2,
  Database,
  FolderPlus,
  Sparkles,
  FileJson,
} from 'lucide-react';
import type { LyricsMap } from '../types';
import { exportMergedLyricsJson, importLyricsMapToIndexedDB } from '../utils/lyricsStorage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalSongs: number;
  totalCategories: number;
  preloadedCount: number;
  localCount: number;
  onLyricsImported: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  totalSongs,
  totalCategories,
  preloadedCount,
  localCount,
  onLyricsImported,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    try {
      setErrorMessage(null);
      await exportMergedLyricsJson();
      setStatusMessage(
        'Downloaded lyrics.json! Replace src/data/lyrics.json in your GitHub repo with this file to share lyrics with all users.'
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to export lyrics.json');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setErrorMessage(null);
      const text = await file.text();
      const parsed = JSON.parse(text) as LyricsMap;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Invalid lyrics.json format: expected a JSON object keyed by song.id.');
      }
      const importedCount = await importLyricsMapToIndexedDB(parsed);
      await onLyricsImported();
      setStatusMessage(`Successfully imported ${importedCount} lyric entries into browser IndexedDB!`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to import lyrics.json');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#062828]/70 backdrop-blur-xs">
      <div className="w-full max-w-xl rounded-3xl bg-[#FDF9F1] border-4 border-[#D49B27] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#095252] to-[#0D6E6E] text-[#FDF9F1] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileJson className="w-6 h-6 text-[#F4B942]" />
            <div>
              <h2 className="font-display font-bold text-xl">
                RagaBox Settings &amp; Lyrics Sync
              </h2>
              <p className="text-xs text-[#CBE7E3]">
                100% Static GitHub Pages • Zero Backend Persistence
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Settings Modal"
            className="p-2 rounded-xl bg-[#063838]/70 hover:bg-[#063838] text-[#F6E3BA] hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl bg-[#F3E9D2] border border-[#DFC99B] text-center">
              <p className="text-2xl font-display font-bold text-[#095252]">{totalSongs}</p>
              <p className="text-xs font-semibold text-[#4A5D5A]">Songs Indexed</p>
            </div>
            <div className="p-3 rounded-2xl bg-[#F3E9D2] border border-[#DFC99B] text-center">
              <p className="text-2xl font-display font-bold text-[#095252]">{totalCategories}</p>
              <p className="text-xs font-semibold text-[#4A5D5A]">Categories</p>
            </div>
            <div className="p-3 rounded-2xl bg-[#E6F4F1] border border-[#0D6E6E]/30 text-center">
              <p className="text-2xl font-display font-bold text-[#0D6E6E]">{preloadedCount}</p>
              <p className="text-xs font-semibold text-[#095252]">Repo Lyrics</p>
            </div>
            <div className="p-3 rounded-2xl bg-[#FFF3CD] border border-[#D49B27]/50 text-center">
              <p className="text-2xl font-display font-bold text-[#B25000]">{localCount}</p>
              <p className="text-xs font-semibold text-[#7A4F01]">IndexedDB Edits</p>
            </div>
          </div>

          {/* Export / Import Lyrics Section */}
          <div className="p-5 rounded-2xl bg-[#FAF3E3] border-2 border-[#D49B27]/60 space-y-3">
            <div className="flex items-center gap-2 text-[#095252] font-display font-bold text-base">
              <Database className="w-5 h-5 text-[#E07A1F]" />
              <h3>Sync Browser Lyrics with GitHub Repo</h3>
            </div>
            <p className="text-xs sm:text-sm text-[#3E4E4C] leading-relaxed">
              Any lyrics generated with Whisper AI or edited in the browser are saved immediately in{' '}
              <code className="font-bold text-[#095252]">IndexedDB</code>. Click{' '}
              <strong>Export lyrics.json</strong> to download the complete dictionary and save it to{' '}
              <code className="font-bold text-[#9A2515]">src/data/lyrics.json</code> in your repo!
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#095252] to-[#0D6E6E] hover:from-[#063838] hover:to-[#095252] text-white font-bold text-sm shadow-sm active:scale-95 transition cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#F4B942]" />
                <span>Export lyrics.json</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E07A1F] hover:bg-[#C96B16] text-white font-bold text-sm shadow-sm active:scale-95 transition cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Import lyrics.json</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {statusMessage && (
              <div className="p-3 rounded-xl bg-[#E6F4F1] border border-[#0D6E6E] text-xs font-bold text-[#095252] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#0D6E6E] shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-xl bg-[#FBE9E7] border border-[#B83B2A] text-xs font-bold text-[#9A2515]">
                ⚠️ {errorMessage}
              </div>
            )}
          </div>

          {/* How to Add More Songs */}
          <div className="p-4 rounded-2xl bg-[#F3E9D2]/70 border border-[#DFC99B] space-y-2">
            <div className="flex items-center gap-2 text-[#095252] font-display font-bold text-sm">
              <FolderPlus className="w-4 h-4 text-[#0D6E6E]" />
              <h4>Adding New Carnatic Practice Folders</h4>
            </div>
            <ol className="text-xs text-[#3E4E4C] space-y-1.5 list-decimal list-inside">
              <li>
                Drop MP3 or M4A files into category subfolders inside{' '}
                <code className="font-bold text-[#095252]">public/music/&lt;Category&gt;/</code> (or{' '}
                <code className="font-bold text-[#095252]">Music/&lt;Category&gt;/</code>).
              </li>
              <li>
                Run <code className="font-bold text-[#095252]">npm run dev</code> or{' '}
                <code className="font-bold text-[#095252]">npm run build</code> — the{' '}
                <code className="font-bold text-[#095252]">scripts/generate-manifest.mjs</code>{' '}
                indexer automatically parses ID3 tags and updates{' '}
                <code className="font-bold text-[#095252]">src/data/songs.json</code>.
              </li>
              <li className="flex items-center gap-1">
                <span>Push to</span>
                <code className="font-bold text-[#095252]">main</code>
                <span>— GitHub Actions deploys directly to GitHub Pages!</span>
                <Sparkles className="w-3.5 h-3.5 text-[#E07A1F] inline" />
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
