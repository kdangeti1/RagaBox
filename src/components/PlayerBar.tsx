import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  BookOpen,
  RotateCcw,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import type { LoopState, PlaybackSpeed, Song } from '../types';
import { formatDuration, getCategoryMeta } from '../utils/audio';

interface PlayerBarProps {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  speed: PlaybackSpeed;
  loop: LoopState;
  isLyricsOpen: boolean;
  hasLyrics: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onSkipSeconds: (delta: number) => void;
  onVolumeChange: (val: number) => void;
  onToggleMute: () => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  onToggleRepeatSong: () => void;
  onSetLoopA: () => void;
  onSetLoopB: () => void;
  onClearABLoop: () => void;
  onToggleLyrics: () => void;
}

const SPEEDS: PlaybackSpeed[] = [0.75, 0.85, 1.0, 1.25];

export const PlayerBar: React.FC<PlayerBarProps> = ({
  currentSong,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  speed,
  loop,
  isLyricsOpen,
  hasLyrics,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  onSkipSeconds,
  onVolumeChange,
  onToggleMute,
  onSpeedChange,
  onToggleRepeatSong,
  onSetLoopA,
  onSetLoopB,
  onClearABLoop,
  onToggleLyrics,
}) => {
  const effectiveDuration = duration > 0 ? duration : currentSong?.duration || 0;
  const progressPercent =
    effectiveDuration > 0 ? Math.min(100, (currentTime / effectiveDuration) * 100) : 0;

  const loopAPercent =
    loop.pointA !== null && effectiveDuration > 0
      ? Math.min(100, (loop.pointA / effectiveDuration) * 100)
      : null;
  const loopBPercent =
    loop.pointB !== null && effectiveDuration > 0
      ? Math.min(100, (loop.pointB / effectiveDuration) * 100)
      : null;

  const catMeta = currentSong ? getCategoryMeta(currentSong.category) : null;

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 bg-[#095252] text-[#FDF9F1] border-t-4 border-[#D49B27] shadow-[0_-8px_30px_rgba(9,82,82,0.28)]">
      {/* Interactive Seek Bar Strip at Top of Player */}
      <div className="relative px-4 pt-2.5 pb-1 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <span className="text-xs sm:text-sm font-mono font-semibold text-[#F6E3BA] w-12 text-right tabular-nums">
            {formatDuration(currentTime)}
          </span>

          <div className="relative flex-1 flex items-center h-6">
            {/* Track background */}
            <div className="w-full h-2.5 bg-[#063838] rounded-full overflow-hidden border border-[#147A7A]/50">
              <div
                className="h-full bg-gradient-to-r from-[#E07A1F] to-[#F4B942] transition-all duration-100"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* A-B Loop Highlight Region */}
            {loopAPercent !== null && (
              <div
                className="absolute h-2.5 bg-[#48E5C2]/45 border-x-2 border-[#48E5C2] pointer-events-none rounded-xs"
                style={{
                  left: `${loopAPercent}%`,
                  width:
                    loopBPercent !== null && loopBPercent > loopAPercent
                      ? `${loopBPercent - loopAPercent}%`
                      : '4px',
                }}
              />
            )}

            {/* Marker A badge */}
            {loopAPercent !== null && (
              <span
                className="absolute -top-2.5 -translate-x-1/2 px-1 py-0.2 text-[10px] font-bold bg-[#48E5C2] text-[#063838] rounded shadow pointer-events-none"
                style={{ left: `${loopAPercent}%` }}
              >
                A
              </span>
            )}

            {/* Marker B badge */}
            {loopBPercent !== null && (
              <span
                className="absolute -top-2.5 -translate-x-1/2 px-1 py-0.2 text-[10px] font-bold bg-[#F4B942] text-[#063838] rounded shadow pointer-events-none"
                style={{ left: `${loopBPercent}%` }}
              >
                B
              </span>
            )}

            <input
              type="range"
              min={0}
              max={effectiveDuration || 100}
              step={0.1}
              value={Math.min(currentTime, effectiveDuration || 100)}
              disabled={!currentSong}
              onChange={(e) => onSeek( Number(e.target.value) )}
              aria-label="Seek audio position"
              className="ragabox-slider absolute inset-0 w-full h-full opacity-100"
            />
          </div>

          <span className="text-xs sm:text-sm font-mono font-semibold text-[#F6E3BA] w-12 tabular-nums">
            {formatDuration(effectiveDuration)}
          </span>
        </div>
      </div>

      {/* Main Controls Row */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 pb-3 pt-1 flex flex-col lg:flex-row items-center justify-between gap-2.5">
        {/* Left: Currently Playing Song Info */}
        <div className="flex items-center gap-3 w-full lg:w-[28%] min-w-0">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#0D6E6E] border-2 border-[#D49B27] flex items-center justify-center text-2xl shrink-0 shadow-inner">
            {catMeta ? catMeta.emoji : '🪔'}
          </div>
          {currentSong ? (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-display font-bold text-base sm:text-lg text-[#FDF9F1] truncate">
                  {currentSong.title}
                </p>
              </div>
              <p className="text-xs sm:text-sm text-[#CBE7E3] truncate">
                <span className="font-semibold text-[#F4B942]">{currentSong.category}</span>
                {' • '}
                <span>{currentSong.fileName}</span>
              </p>
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <p className="font-display font-bold text-base text-[#F6E3BA]">
                Tap any song to start practicing!
              </p>
              <p className="text-xs text-[#CBE7E3]">
                Use speed controls & A–B loop for tough Sangathis
              </p>
            </div>
          )}

          {/* Mobile Lyrics Toggle Button */}
          <button
            type="button"
            onClick={onToggleLyrics}
            disabled={!currentSong}
            className={`lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer shrink-0 ${
              isLyricsOpen
                ? 'bg-[#E07A1F] text-white shadow-md'
                : 'bg-[#0D6E6E] text-[#FDF9F1] border border-[#D49B27]/60'
            } disabled:opacity-40`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Lyrics</span>
          </button>
        </div>

        {/* Center: Primary Transport + A-B Practice Loop Controls */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2.5">
          {/* Previous Song */}
          <button
            type="button"
            onClick={onPrev}
            disabled={!currentSong}
            title="Previous Song"
            aria-label="Previous Song"
            className="p-2.5 rounded-xl bg-[#0D6E6E] hover:bg-[#138484] active:scale-95 text-[#FDF9F1] disabled:opacity-40 transition cursor-pointer"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          {/* Rewind 5s */}
          <button
            type="button"
            onClick={() => onSkipSeconds(-5)}
            disabled={!currentSong}
            title="Back 5 seconds"
            aria-label="Back 5 seconds"
            className="px-2.5 py-2 rounded-xl bg-[#0D6E6E] hover:bg-[#138484] active:scale-95 text-xs font-bold text-[#F6E3BA] flex items-center gap-1 disabled:opacity-40 transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>5s</span>
          </button>

          {/* Big Kid-Friendly Play / Pause Button */}
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={!currentSong}
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-b from-[#F4B942] to-[#E07A1F] hover:from-[#F7C762] hover:to-[#EB862A] active:scale-95 text-[#1C2826] shadow-lg border-2 border-[#FDF9F1] flex items-center justify-center disabled:opacity-40 transition cursor-pointer"
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current ml-0.5" />
            )}
          </button>

          {/* Forward 5s */}
          <button
            type="button"
            onClick={() => onSkipSeconds(5)}
            disabled={!currentSong}
            title="Forward 5 seconds"
            aria-label="Forward 5 seconds"
            className="px-2.5 py-2 rounded-xl bg-[#0D6E6E] hover:bg-[#138484] active:scale-95 text-xs font-bold text-[#F6E3BA] flex items-center gap-1 disabled:opacity-40 transition cursor-pointer"
          >
            <span>5s</span>
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Next Song */}
          <button
            type="button"
            onClick={onNext}
            disabled={!currentSong}
            title="Next Song"
            aria-label="Next Song"
            className="p-2.5 rounded-xl bg-[#0D6E6E] hover:bg-[#138484] active:scale-95 text-[#FDF9F1] disabled:opacity-40 transition cursor-pointer"
          >
            <SkipForward className="w-5 h-5" />
          </button>

          {/* Divider */}
          <div className="h-7 w-px bg-[#167979] mx-0.5 hidden sm:block" />

          {/* Repeat Current Song Toggle */}
          <button
            type="button"
            onClick={onToggleRepeatSong}
            disabled={!currentSong}
            title="Repeat Current Song"
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer disabled:opacity-40 ${
              loop.repeatSong
                ? 'bg-[#E07A1F] text-white border-[#FDF9F1] shadow-sm'
                : 'bg-[#0D6E6E] text-[#CBE7E3] border-[#1A8585] hover:bg-[#138484]'
            }`}
          >
            {loop.repeatSong ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            <span className="hidden sm:inline">Repeat</span>
          </button>

          {/* A-B Loop Phrase Practice Controls */}
          <div className="flex items-center bg-[#063838] p-1 rounded-xl border border-[#167979]">
            <button
              type="button"
              onClick={onSetLoopA}
              disabled={!currentSong}
              title="Set Loop Start Point A at current timestamp"
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-40 ${
                loop.pointA !== null
                  ? 'bg-[#48E5C2] text-[#063838]'
                  : 'text-[#CBE7E3] hover:bg-[#0D6E6E]'
              }`}
            >
              {loop.pointA !== null ? `A: ${formatDuration(loop.pointA)}` : 'Set A'}
            </button>
            <button
              type="button"
              onClick={onSetLoopB}
              disabled={!currentSong || loop.pointA === null}
              title="Set Loop End Point B at current timestamp"
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ml-1 disabled:opacity-40 ${
                loop.pointB !== null
                  ? 'bg-[#F4B942] text-[#063838]'
                  : 'text-[#CBE7E3] hover:bg-[#0D6E6E]'
              }`}
            >
              {loop.pointB !== null ? `B: ${formatDuration(loop.pointB)}` : 'Set B'}
            </button>
            {(loop.pointA !== null || loop.pointB !== null) && (
              <button
                type="button"
                onClick={onClearABLoop}
                title="Clear A-B Loop"
                className="ml-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-[#B83B2A] text-white hover:bg-[#D14836] transition cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Right: Speed Selector (Kaalam) + Volume + Lyrics Drawer Button */}
        <div className="flex items-center justify-end gap-2.5 w-full lg:w-[32%]">
          {/* Playback Speed Selector */}
          <div
            className="flex items-center bg-[#063838] p-1 rounded-xl border border-[#167979]"
            role="group"
            aria-label="Playback Speed"
          >
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSpeedChange(s)}
                className={`px-2 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  speed === s
                    ? 'bg-[#F4B942] text-[#1C2826] shadow-xs'
                    : 'text-[#CBE7E3] hover:text-white'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Volume Control (Desktop/Tablet) */}
          <div className="hidden sm:flex items-center gap-1.5 bg-[#063838] px-2.5 py-1.5 rounded-xl border border-[#167979]">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              className="text-[#F6E3BA] hover:text-white cursor-pointer"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-[#E07A1F]" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              aria-label="Volume"
              className="ragabox-slider w-16 h-1.5 bg-[#0D6E6E] rounded-lg"
            />
          </div>

          {/* Desktop Lyrics & AI Drawer Button */}
          <button
            type="button"
            onClick={onToggleLyrics}
            disabled={!currentSong}
            className={`hidden lg:flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer shrink-0 border ${
              isLyricsOpen
                ? 'bg-[#E07A1F] text-white border-[#FDF9F1] shadow-md'
                : 'bg-[#0D6E6E] text-[#FDF9F1] border-[#D49B27]/70 hover:bg-[#138484]'
            } disabled:opacity-40`}
          >
            {hasLyrics ? (
              <BookOpen className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4 text-[#F4B942]" />
            )}
            <span>{hasLyrics ? 'Lyrics & Notes' : 'AI Lyrics'}</span>
          </button>
        </div>
      </div>
    </footer>
  );
};
