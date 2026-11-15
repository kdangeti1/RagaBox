import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Edit3,
  Save,
  X,
  RotateCcw,
  CheckCircle2,
  Loader2,
  BookOpen,
  ZoomIn,
  ZoomOut,
  Cpu,
} from 'lucide-react';
import type { LyricEntry, Song, WhisperProgressEvent } from '../types';
import { decodeAudioTo16kHzMono } from '../utils/audio';
import { getPreloadedLyric } from '../utils/lyricsStorage';

interface LyricsDrawerProps {
  song: Song | null;
  lyricEntry: LyricEntry | undefined;
  isOpen: boolean;
  onClose: () => void;
  onSaveLyric: (entry: LyricEntry) => Promise<void>;
  onResetToPreloaded: (songId: string) => Promise<void>;
  onOpenSettingsModal: () => void;
}

export const LyricsDrawer: React.FC<LyricsDrawerProps> = ({
  song,
  lyricEntry,
  isOpen,
  onClose,
  onSaveLyric,
  onResetToPreloaded,
  onOpenSettingsModal,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [fontSize, setFontSize] = useState<'base' | 'lg' | 'xl'>('lg');

  const [isGenerating, setIsGenerating] = useState(false);
  const [aiStatus, setAiStatus] = useState<string>('');
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);

  // Sync draft text when switching songs or lyricEntry changes
  useEffect(() => {
    setDraftText(lyricEntry?.text || '');
    setIsEditing(false);
    setAiError(null);
  }, [song?.id, lyricEntry?.text]);

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  if (!isOpen || !song) return null;

  const preloadedForSong = getPreloadedLyric(song.id);
  const isLocallyModified =
    lyricEntry && (lyricEntry.source === 'manual-edit' || lyricEntry.source === 'ai-whisper' || lyricEntry.source === 'imported');

  const showToast = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3200);
  };

  const handleGenerateFromAudio = async () => {
    if (!song || isGenerating) return;

    setIsGenerating(true);
    setAiError(null);
    setDownloadProgress(null);
    setAiStatus('Decoding audio to 16kHz mono via Web Audio API...');

    try {
      const audioData = await decodeAudioTo16kHzMono(song.relativePath);

      if (!workerRef.current) {
        workerRef.current = new Worker(
          new URL('../workers/whisper.worker.ts', import.meta.url),
          { type: 'module' }
        );
      }

      const worker = workerRef.current;

      worker.onmessage = async (event: MessageEvent<WhisperProgressEvent>) => {
        const msg = event.data;
        if (msg.songId !== song.id) return;

        if (msg.type === 'download') {
          setAiStatus(msg.status || 'Downloading Whisper AI model...');
          if (typeof msg.progress === 'number') {
            setDownloadProgress(msg.progress);
          }
        } else if (msg.type === 'status') {
          setAiStatus(msg.status || 'Processing...');
          setDownloadProgress(null);
        } else if (msg.type === 'complete') {
          setIsGenerating(false);
          setDownloadProgress(null);
          setAiStatus('');
          const generatedText = msg.text || '';
          const newEntry: LyricEntry = {
            songId: song.id,
            title: song.title,
            text: generatedText,
            source: 'ai-whisper',
            updatedAt: new Date().toISOString(),
          };
          await onSaveLyric(newEntry);
          setDraftText(generatedText);
          showToast(`Saved AI transcription (${(msg.device || 'wasm').toUpperCase()}) to browser IndexedDB!`);
        } else if (msg.type === 'error') {
          setIsGenerating(false);
          setDownloadProgress(null);
          setAiStatus('');
          setAiError(msg.error || 'Failed to transcribe audio.');
        }
      };

      worker.postMessage({ songId: song.id, audio: audioData }, [audioData.buffer]);
    } catch (err) {
      setIsGenerating(false);
      setDownloadProgress(null);
      setAiStatus('');
      setAiError(err instanceof Error ? err.message : 'Failed to decode audio file.');
    }
  };

  const handleSaveManualEdit = async () => {
    if (!song) return;
    const entry: LyricEntry = {
      songId: song.id,
      title: song.title,
      text: draftText.trim(),
      source: 'manual-edit',
      updatedAt: new Date().toISOString(),
    };
    await onSaveLyric(entry);
    setIsEditing(false);
    showToast('Saved lyrics to browser IndexedDB!');
  };

  const handleReset = async () => {
    if (!song) return;
    await onResetToPreloaded(song.id);
    setIsEditing(false);
    showToast('Restored pre-loaded lyrics!');
  };

  const fontSizeClass =
    fontSize === 'base'
      ? 'text-base leading-relaxed'
      : fontSize === 'lg'
      ? 'text-lg leading-relaxed'
      : 'text-xl leading-loose';

  const getSourceBadge = (source?: LyricEntry['source']) => {
    switch (source) {
      case 'preloaded':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#E6F4F1] text-[#095252] border border-[#0D6E6E]/25">
            📚 Pre-loaded in Repo
          </span>
        );
      case 'ai-whisper':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FFF3CD] text-[#7A4F01] border border-[#D49B27]/40">
            ✨ Whisper AI (IndexedDB)
          </span>
        );
      case 'manual-edit':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FBE9E7] text-[#9A2515] border border-[#E07A1F]/40">
            ✏️ Edited Locally (IndexedDB)
          </span>
        );
      case 'imported':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EDE7F6] text-[#4527A0]">
            📥 Imported (IndexedDB)
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <aside className="fixed inset-y-0 right-0 z-30 w-full sm:w-[440px] xl:w-[480px] bg-[#FAF3E3] border-l-2 border-[#D49B27]/60 shadow-2xl flex flex-col pb-28">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-[#095252] to-[#0D6E6E] text-[#FDF9F1] border-b-2 border-[#D49B27] flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#F4B942]">
            <BookOpen className="w-4 h-4" />
            <span>Sahithyam & Swaram Studio</span>
          </div>
          <h2 className="font-display font-bold text-xl text-white truncate mt-0.5">
            {song.title}
          </h2>
          <p className="text-xs text-[#CBE7E3] truncate">
            {song.category} • {song.fileName}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close Lyrics Drawer"
          className="p-2 rounded-xl bg-[#063838]/70 hover:bg-[#063838] text-[#F6E3BA] hover:text-white transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Action Bar: Generate AI Lyrics, Edit Lyrics, Font Size */}
      <div className="px-4 py-3 bg-[#F3E9D2] border-b border-[#DFC99B] flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Generate Lyrics from MP3 (Whisper AI) */}
          <button
            type="button"
            onClick={handleGenerateFromAudio}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-[#E07A1F] to-[#D49B27] hover:from-[#C96B16] hover:to-[#C08A1E] text-white font-bold text-xs shadow-sm active:scale-95 disabled:opacity-60 transition cursor-pointer"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{isGenerating ? 'Transcribing...' : 'Generate Lyrics from MP3'}</span>
          </button>

          {/* Toggle Edit Mode */}
          {!isEditing ? (
            <button
              type="button"
              onClick={() => {
                setDraftText(lyricEntry?.text || '');
                setIsEditing(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0D6E6E] hover:bg-[#095252] text-white font-bold text-xs shadow-xs active:scale-95 transition cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Lyrics</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSaveManualEdit}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1B7A43] hover:bg-[#145E33] text-white font-bold text-xs shadow-xs active:scale-95 transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Lyrics</span>
            </button>
          )}
        </div>

        {/* Font Zoom Controls */}
        <div className="flex items-center gap-1 bg-[#FDF9F1] px-2 py-1 rounded-xl border border-[#DFC99B]">
          <button
            type="button"
            onClick={() => setFontSize((f) => (f === 'xl' ? 'lg' : 'base'))}
            title="Smaller text"
            className="p-1 text-[#095252] hover:bg-[#E6F4F1] rounded-lg cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setFontSize((f) => (f === 'base' ? 'lg' : 'xl'))}
            title="Larger text"
            className="p-1 text-[#095252] hover:bg-[#E6F4F1] rounded-lg cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Whisper AI Progress Banner */}
      {isGenerating && (
        <div className="mx-4 mt-3 p-3.5 rounded-2xl bg-[#FFF8E7] border-2 border-[#D49B27] shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-[#7A4F01]">
            <Cpu className="w-4 h-4 text-[#E07A1F] animate-pulse shrink-0" />
            <span>{aiStatus || 'Running Whisper Tiny in Web Worker...'}</span>
          </div>
          {downloadProgress !== null && (
            <div className="mt-2">
              <div className="w-full h-2.5 bg-[#F2E2BA] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#0D6E6E] to-[#E07A1F] transition-all duration-200"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-[#7A4F01] mt-1 font-semibold text-right">
                {downloadProgress}% cached in browser
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error Banner */}
      {aiError && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-[#FBE9E7] border border-[#B83B2A] text-xs text-[#9A2515] font-medium">
          ⚠️ {aiError}
        </div>
      )}

      {/* Save Toast */}
      {saveToast && (
        <div className="mx-4 mt-3 p-2.5 rounded-xl bg-[#E6F4F1] border border-[#0D6E6E] text-xs text-[#095252] font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#0D6E6E] shrink-0" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Lyrics Body / Editor */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          {getSourceBadge(lyricEntry?.source)}
          {isLocallyModified && preloadedForSong && (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-semibold text-[#9A2515] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Pre-loaded</span>
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="flex flex-col h-full gap-3">
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder="Type or paste Swaram (S R G M P D N) and Sahithyam lyrics here..."
              rows={14}
              className="w-full flex-1 p-4 rounded-2xl bg-[#FDF9F1] border-2 border-[#0D6E6E] text-[#1C2826] font-medium text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#E07A1F]"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraftText(lyricEntry?.text || '');
                  setIsEditing(false);
                }}
                className="px-4 py-2 rounded-xl bg-[#E8DEC8] text-[#1C2826] font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveManualEdit}
                className="px-4 py-2 rounded-xl bg-[#0D6E6E] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save to IndexedDB</span>
              </button>
            </div>
          </div>
        ) : lyricEntry && lyricEntry.text ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-[#FDF9F1] border border-[#E2D4B7] shadow-xs">
            <pre
              className={`whitespace-pre-wrap font-sans text-[#1C2826] font-medium ${fontSizeClass}`}
            >
              {lyricEntry.text}
            </pre>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-[#FDF9F1] border-2 border-dashed border-[#D49B27]/60 text-center my-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FFF3CD] text-[#E07A1F] flex items-center justify-center mx-auto mb-3 text-2xl">
              🪷
            </div>
            <h3 className="font-display font-bold text-lg text-[#095252]">
              No Lyrics Saved Yet for This Track
            </h3>
            <p className="text-sm text-[#4A5D5A] mt-1 mb-4">
              Click <strong>&ldquo;Generate Lyrics from MP3&rdquo;</strong> above to transcribe with
              in-browser Whisper AI, or click <strong>&ldquo;Edit Lyrics&rdquo;</strong> to type
              Swarams &amp; Sahithyam!
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleGenerateFromAudio}
                disabled={isGenerating}
                className="px-4 py-2.5 rounded-xl bg-[#E07A1F] hover:bg-[#C96B16] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate Lyrics from MP3</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-4 py-2.5 rounded-xl bg-[#0D6E6E] hover:bg-[#095252] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                <span>Add Swaram / Lyrics</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Sync Tip */}
        <div className="mt-4 p-3 rounded-xl bg-[#F3E9D2]/80 border border-[#DFC99B] flex items-center justify-between gap-2 text-xs text-[#4A5D5A]">
          <span>
            Auto-saved in browser <code className="font-bold text-[#095252]">IndexedDB</code>.
          </span>
          <button
            type="button"
            onClick={onOpenSettingsModal}
            className="font-bold text-[#0D6E6E] hover:text-[#E07A1F] underline cursor-pointer shrink-0"
          >
            Export / Import lyrics.json →
          </button>
        </div>
      </div>
    </aside>
  );
};
