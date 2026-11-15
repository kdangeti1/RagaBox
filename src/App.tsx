import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Play,
  Pause,
  BookOpen,
  Settings,
  Music,
  X,
  Sparkles,
  Volume2,
  Repeat,
  Gauge,
} from 'lucide-react';
import songsData from './data/songs.json';
import type { LoopState, LyricEntry, LyricsMap, PlaybackSpeed, Song } from './types';
import { formatDuration, getAudioUrl, getCategoryMeta } from './utils/audio';
import {
  deleteLocalLyricFromIndexedDB,
  getMergedLyrics,
  saveLyricToIndexedDB,
} from './utils/lyricsStorage';
import { PlayerBar } from './components/PlayerBar';
import { LyricsDrawer } from './components/LyricsDrawer';
import { SettingsModal } from './components/SettingsModal';

const ALL_SONGS: Song[] = songsData as Song[];

// Pedagogical order for Carnatic abhyasa varisais followed by alphabetical categories
const PEDAGOGICAL_ORDER = [
  'Basics & Exercises',
  'Sarali varisais',
  'Janta Varisais',
  'Dhaatu varisai',
  'Upper sthayi',
  'Alankarams',
  'Geetham Recordings',
  'Swarajathis',
  'Jathiswarams',
  'Note swarams',
  'Varnams',
  'Keerthanams',
  'Krithis',
  'Song Recordings',
];

export const App: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyWithLyrics, setOnlyWithLyrics] = useState<boolean>(false);

  // Audio player state
  const [currentSong, setCurrentSong] = useState<Song | null>(ALL_SONGS[0] || null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.9);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1.0);
  const [loop, setLoop] = useState<LoopState>({
    repeatSong: false,
    pointA: null,
    pointB: null,
  });

  // Lyrics & Modals state
  const [lyricsMap, setLyricsMap] = useState<LyricsMap>({});
  const [localLyricsCount, setLocalLyricsCount] = useState<number>(0);
  const [preloadedLyricsCount, setPreloadedLyricsCount] = useState<number>(0);
  const [isLyricsOpen, setIsLyricsOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load merged lyrics (src/data/lyrics.json + IndexedDB) on mount
  const refreshLyrics = useCallback(async () => {
    const { merged, localCount, preloadedCount } = await getMergedLyrics();
    setLyricsMap(merged);
    setLocalLyricsCount(localCount);
    setPreloadedLyricsCount(preloadedCount);
  }, []);

  useEffect(() => {
    refreshLyrics();
  }, [refreshLyrics]);

  // Compute sorted category list with counts
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const song of ALL_SONGS) {
      counts.set(song.category, (counts.get(song.category) || 0) + 1);
    }
    const list = Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
    list.sort((a, b) => {
      const idxA = PEDAGOGICAL_ORDER.findIndex(
        (p) => p.toLowerCase() === a.name.toLowerCase()
      );
      const idxB = PEDAGOGICAL_ORDER.findIndex(
        (p) => p.toLowerCase() === b.name.toLowerCase()
      );
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, []);

  // Filter songs in real time by category, search query, and lyrics filter
  const filteredSongs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ALL_SONGS.filter((song) => {
      if (selectedCategory !== 'ALL' && song.category !== selectedCategory) {
        return false;
      }
      if (onlyWithLyrics && !lyricsMap[song.id]?.text) {
        return false;
      }
      if (!q) return true;
      return (
        song.searchText.includes(q) ||
        (lyricsMap[song.id]?.text || '').toLowerCase().includes(q)
      );
    });
  }, [selectedCategory, searchQuery, onlyWithLyrics, lyricsMap]);

  // Apply playbackRate & preservesPitch whenever speed or song changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = speed;
    if ('preservesPitch' in audio) {
      audio.preservesPitch = true;
    }
  }, [speed, currentSong?.id]);

  // Apply volume & mute
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Play/pause sync when switching songs
  const playSong = useCallback(
    (song: Song, openLyricsPanel = false) => {
      const isSameSong = currentSong?.id === song.id;
      if (isSameSong) {
        if (openLyricsPanel) {
          setIsLyricsOpen(true);
          if (!isPlaying && audioRef.current) {
            audioRef.current.play().catch(() => {});
            setIsPlaying(true);
          }
          return;
        }
        if (isPlaying) {
          audioRef.current?.pause();
          setIsPlaying(false);
        } else {
          audioRef.current?.play().catch(() => {});
          setIsPlaying(true);
        }
        return;
      }

      setCurrentSong(song);
      setCurrentTime(0);
      setAudioDuration(song.duration || 0);
      setLoop((prev) => ({ ...prev, pointA: null, pointB: null }));
      setIsPlaying(true);
      if (openLyricsPanel) {
        setIsLyricsOpen(true);
      }

      setTimeout(() => {
        const audio = audioRef.current;
        if (audio) {
          audio.playbackRate = speed;
          audio.play().catch(() => {
            setIsPlaying(false);
          });
        }
      }, 30);
    },
    [currentSong?.id, isPlaying, speed]
  );

  const handleTogglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.playbackRate = speed;
      audio.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  }, [currentSong, isPlaying, speed]);

  const handlePrev = useCallback(() => {
    if (!currentSong) return;
    const pool = filteredSongs.length > 0 ? filteredSongs : ALL_SONGS;
    const idx = pool.findIndex((s) => s.id === currentSong.id);
    const prevSong = idx > 0 ? pool[idx - 1] : pool[pool.length - 1];
    if (prevSong) playSong(prevSong);
  }, [currentSong, filteredSongs, playSong]);

  const handleNext = useCallback(() => {
    if (!currentSong) return;
    const pool = filteredSongs.length > 0 ? filteredSongs : ALL_SONGS;
    const idx = pool.findIndex((s) => s.id === currentSong.id);
    const nextSong = idx >= 0 && idx < pool.length - 1 ? pool[idx + 1] : pool[0];
    if (nextSong) playSong(nextSong);
  }, [currentSong, filteredSongs, playSong]);

  const handleSeek = useCallback((newTime: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  const handleSkipSeconds = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const target = Math.max(0, Math.min(audio.duration || 9999, audio.currentTime + delta));
    audio.currentTime = target;
    setCurrentTime(target);
  }, []);

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const now = audio.currentTime;

    // Enforce A-B phrase loop if both A and B are set
    if (
      loop.pointA !== null &&
      loop.pointB !== null &&
      loop.pointB > loop.pointA + 0.5 &&
      now >= loop.pointB
    ) {
      audio.currentTime = loop.pointA;
      setCurrentTime(loop.pointA);
      return;
    }

    setCurrentTime(now);
  };

  const handleAudioEnded = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (loop.pointA !== null && loop.pointB !== null) {
      audio.currentTime = loop.pointA;
      audio.play().catch(() => {});
      return;
    }

    if (loop.repeatSong) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }

    handleNext();
  };

  const handleSetLoopA = () => {
    setLoop((prev) => ({
      ...prev,
      pointA: currentTime,
      pointB: prev.pointB !== null && prev.pointB <= currentTime ? null : prev.pointB,
    }));
  };

  const handleSetLoopB = () => {
    if (loop.pointA === null) return;
    const endPoint = Math.max(loop.pointA + 1, currentTime);
    setLoop((prev) => ({
      ...prev,
      pointB: endPoint,
    }));
  };

  const handleClearABLoop = () => {
    setLoop((prev) => ({ ...prev, pointA: null, pointB: null }));
  };

  const handleSaveLyric = async (entry: LyricEntry) => {
    await saveLyricToIndexedDB(entry);
    await refreshLyrics();
  };

  const handleResetToPreloaded = async (songId: string) => {
    await deleteLocalLyricFromIndexedDB(songId);
    await refreshLyrics();
  };

  const activeCategoryMeta =
    selectedCategory === 'ALL'
      ? {
          emoji: '🪔',
          badgeBg: 'bg-[#E6F4F1]',
          badgeText: 'text-[#095252]',
          description:
            'Explore all Sarali Varisais, Alankarams, Geethams, Varnams, Keerthanams & Bhajans',
        }
      : getCategoryMeta(selectedCategory);

  return (
    <div className="min-h-screen flex flex-col bg-[#FDF9F1] text-[#1C2826] pb-36">
      {/* Hidden HTML5 Audio Element */}
      <audio
        ref={audioRef}
        src={currentSong ? getAudioUrl(currentSong.relativePath) : undefined}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={(e) => {
          const dur = e.currentTarget.duration;
          if (Number.isFinite(dur) && dur > 0) {
            setAudioDuration(dur);
          }
          e.currentTarget.playbackRate = speed;
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleAudioEnded}
        preload="metadata"
      />

      {/* Top Ornamental Gold & Peacock Teal Header */}
      <header className="sticky top-0 z-20 bg-gradient-to-r from-[#095252] via-[#0D6E6E] to-[#095252] text-[#FDF9F1] border-b-4 border-[#D49B27] shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Brand Logo & Title */}
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F4B942] to-[#E07A1F] border-2 border-[#FDF9F1] shadow-md flex items-center justify-center text-2xl shrink-0">
                🦚
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight text-white">
                    RagaBox
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#F4B942] text-[#1C2826] shadow-2xs">
                    Carnatic Practice Studio
                  </span>
                </div>
                <p className="text-xs text-[#CBE7E3] hidden sm:block">
                  Sing along with Swarams, Sahithyam, Speed Controls &amp; A–B Phrase Looping
                </p>
              </div>
            </div>

            {/* Mobile Settings Button */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Open Lyrics Sync & Settings"
              className="md:hidden p-2.5 rounded-xl bg-[#063838] text-[#F4B942] border border-[#D49B27]/50 cursor-pointer"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {/* Prominent Instant Search Bar */}
          <div className="relative w-full md:max-w-md lg:max-w-lg flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-[#095252] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search songs, ragas, folders (e.g., Sarali, Kalyani, Varnam, Bhajare)..."
                aria-label="Search songs"
                className="w-full pl-11 pr-9 py-2.5 rounded-2xl bg-[#FDF9F1] text-[#1C2826] placeholder-[#5F7370] font-medium text-sm border-2 border-[#D49B27] shadow-inner focus:outline-none focus:ring-2 focus:ring-[#F4B942]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5F7370] hover:text-[#1C2826] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Desktop Settings & Lyrics Sync Button */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="hidden md:flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-[#063838] hover:bg-[#042626] text-[#F6E3BA] border border-[#D49B27]/60 font-bold text-xs transition cursor-pointer shrink-0"
            >
              <Settings className="w-4 h-4 text-[#F4B942]" />
              <span>Sync Lyrics</span>
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Horizontal Category Pills */}
        <div className="lg:hidden px-4 pb-3 overflow-x-auto flex items-center gap-2 no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3.5 py-1.5 rounded-full font-display font-bold text-xs whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === 'ALL'
                ? 'bg-[#F4B942] text-[#1C2826] shadow-xs'
                : 'bg-[#063838]/80 text-[#CBE7E3] border border-[#167979]'
            }`}
          >
            <span>🪔 All Songs</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/15 text-[11px]">
              {ALL_SONGS.length}
            </span>
          </button>

          {categories.map((cat) => {
            const meta = getCategoryMeta(cat.name);
            const active = selectedCategory === cat.name;
            return (
              <button
                key={cat.name}
                type="button"
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-3.5 py-1.5 rounded-full font-display font-bold text-xs whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  active
                    ? 'bg-[#F4B942] text-[#1C2826] shadow-xs'
                    : 'bg-[#063838]/80 text-[#CBE7E3] border border-[#167979]'
                }`}
              >
                <span>
                  {meta.emoji} {cat.name}
                </span>
                <span className="px-1.5 py-0.2 rounded-full bg-black/15 text-[11px]">
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Layout: Left Sidebar (Desktop) + Song Grid + Lyrics Drawer */}
      <div className="max-w-7xl w-full mx-auto flex-1 flex gap-6 px-4 sm:px-6 pt-5">
        {/* Left Category Sidebar (Desktop) */}
        <aside className="hidden lg:block w-68 shrink-0">
          <div className="sticky top-24 rounded-3xl bg-[#F6EFE0] border-2 border-[#E2D4B7] p-3.5 shadow-xs">
            <div className="px-2 pb-2.5 mb-2 border-b border-[#DFC99B] flex items-center justify-between">
              <span className="font-display font-bold text-sm uppercase tracking-wider text-[#095252]">
                Lesson Categories
              </span>
              <span className="text-xs font-bold text-[#7A4F01] bg-[#FFF3CD] px-2 py-0.5 rounded-full">
                {categories.length} folders
              </span>
            </div>

            <nav className="space-y-1 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl font-display font-bold text-sm transition cursor-pointer ${
                  selectedCategory === 'ALL'
                    ? 'bg-[#0D6E6E] text-white shadow-sm'
                    : 'text-[#1C2826] hover:bg-[#EAE0C8]'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <span className="text-lg">🪔</span>
                  <span className="truncate">All Songs</span>
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    selectedCategory === 'ALL'
                      ? 'bg-[#F4B942] text-[#1C2826]'
                      : 'bg-[#E2D4B7] text-[#3E4E4C]'
                  }`}
                >
                  {ALL_SONGS.length}
                </span>
              </button>

              {categories.map((cat) => {
                const meta = getCategoryMeta(cat.name);
                const active = selectedCategory === cat.name;
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl font-display font-bold text-sm transition cursor-pointer ${
                      active
                        ? 'bg-[#0D6E6E] text-white shadow-sm'
                        : 'text-[#1C2826] hover:bg-[#EAE0C8]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <span className="text-lg">{meta.emoji}</span>
                      <span className="truncate">{cat.name}</span>
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        active
                          ? 'bg-[#F4B942] text-[#1C2826]'
                          : 'bg-[#E2D4B7] text-[#3E4E4C]'
                      }`}
                    >
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Center Song Catalog */}
        <main
          className={`flex-1 min-w-0 transition-all ${
            isLyricsOpen ? 'lg:mr-[450px]' : ''
          }`}
        >
          {/* Category Banner + Practice Tips */}
          <div className="mb-5 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-[#F6EFE0] via-[#FAF3E3] to-[#F3E6C8] border-2 border-[#DFC99B] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-13 h-13 rounded-2xl bg-[#FDF9F1] border-2 border-[#D49B27] flex items-center justify-center text-3xl shrink-0 shadow-xs">
                {activeCategoryMeta.emoji}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display font-bold text-xl sm:text-2xl text-[#095252]">
                    {selectedCategory === 'ALL' ? 'All Carnatic Lessons & Songs' : selectedCategory}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#0D6E6E] text-white">
                    {filteredSongs.length} {filteredSongs.length === 1 ? 'track' : 'tracks'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#4A5D5A] mt-0.5">
                  {activeCategoryMeta.description}
                </p>
              </div>
            </div>

            {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setOnlyWithLyrics((v) => !v)}
                className={`px-3.5 py-2 rounded-2xl font-bold text-xs flex items-center gap-1.5 border transition cursor-pointer ${
                  onlyWithLyrics
                    ? 'bg-[#E07A1F] text-white border-[#C96B16] shadow-xs'
                    : 'bg-[#FDF9F1] text-[#095252] border-[#D49B27] hover:bg-[#FFF3CD]'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>With Lyrics ({Object.keys(lyricsMap).length})</span>
              </button>
            </div>
          </div>

          {/* Kid-Friendly Practice Guide Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-5">
            <div className="px-3.5 py-2.5 rounded-2xl bg-[#E6F4F1] border border-[#0D6E6E]/20 flex items-center gap-2.5 text-xs text-[#095252]">
              <Gauge className="w-4 h-4 text-[#0D6E6E] shrink-0" />
              <span>
                <strong>Slow Practice:</strong> Use <strong>0.75x</strong> or <strong>0.85x</strong>{' '}
                to learn fast Sangathis without changing Shruti!
              </span>
            </div>
            <div className="px-3.5 py-2.5 rounded-2xl bg-[#FFF3CD] border border-[#D49B27]/40 flex items-center gap-2.5 text-xs text-[#7A4F01]">
              <Repeat className="w-4 h-4 text-[#E07A1F] shrink-0" />
              <span>
                <strong>Phrase Loop:</strong> Tap <strong>Set A</strong> &amp; <strong>Set B</strong>{' '}
                on the bottom bar to repeat any line!
              </span>
            </div>
            <div className="px-3.5 py-2.5 rounded-2xl bg-[#FBE9E7] border border-[#E07A1F]/30 flex items-center gap-2.5 text-xs text-[#9A2515]">
              <Sparkles className="w-4 h-4 text-[#E07A1F] shrink-0" />
              <span>
                <strong>AI Sahithyam:</strong> Open <strong>Lyrics</strong> on any song to transcribe
                or edit notes in browser!
              </span>
            </div>
          </div>

          {/* Song Cards Grid */}
          {filteredSongs.length === 0 ? (
            <div className="p-12 rounded-3xl bg-[#F6EFE0] border-2 border-dashed border-[#D49B27] text-center my-6">
              <Music className="w-12 h-12 text-[#0D6E6E] mx-auto mb-3 opacity-75" />
              <h3 className="font-display font-bold text-xl text-[#095252]">
                No matching songs found
              </h3>
              <p className="text-sm text-[#4A5D5A] mt-1 mb-4">
                Try clearing your search filter or selecting &ldquo;All Songs&rdquo;.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('ALL');
                  setOnlyWithLyrics(false);
                }}
                className="px-5 py-2.5 rounded-2xl bg-[#0D6E6E] text-white font-bold text-sm cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredSongs.map((song, idx) => {
                const isCurrent = currentSong?.id === song.id;
                const isActivePlaying = isCurrent && isPlaying;
                const catMeta = getCategoryMeta(song.category);
                const songLyrics = lyricsMap[song.id];

                return (
                  <div
                    key={song.id}
                    className={`group relative rounded-3xl p-4 transition-all border-2 flex items-center justify-between gap-3.5 ${
                      isCurrent
                        ? 'bg-[#FFF8E7] border-[#E07A1F] shadow-md ring-2 ring-[#F4B942]/50'
                        : 'bg-white hover:bg-[#FAF5E8] border-[#E6DAC1] hover:border-[#0D6E6E]/60 shadow-2xs'
                    }`}
                  >
                    {/* Big Touch-Friendly Play Button */}
                    <button
                      type="button"
                      onClick={() => playSong(song)}
                      aria-label={isActivePlaying ? `Pause ${song.title}` : `Play ${song.title}`}
                      className={`w-13 h-13 rounded-2xl flex items-center justify-center shrink-0 font-bold transition shadow-sm cursor-pointer active:scale-95 ${
                        isActivePlaying
                          ? 'bg-[#E07A1F] text-white'
                          : isCurrent
                          ? 'bg-[#0D6E6E] text-white'
                          : 'bg-[#F3E9D2] group-hover:bg-[#0D6E6E] text-[#095252] group-hover:text-white'
                      }`}
                    >
                      {isActivePlaying ? (
                        <Pause className="w-6 h-6 fill-current" />
                      ) : (
                        <Play className="w-6 h-6 fill-current ml-0.5" />
                      )}
                    </button>

                    {/* Song Title & Category Metadata */}
                    <div
                      onClick={() => playSong(song)}
                      className="min-w-0 flex-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#8C7A5B] tabular-nums">
                          #{idx + 1}
                        </span>
                        <h3 className="font-display font-bold text-base sm:text-lg text-[#1C2826] truncate">
                          {song.title}
                        </h3>
                        {isActivePlaying && (
                          <Volume2 className="w-4 h-4 text-[#E07A1F] animate-bounce shrink-0" />
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${catMeta.badgeBg} ${catMeta.badgeText}`}
                        >
                          <span>{catMeta.emoji}</span>
                          <span>{song.category}</span>
                        </span>

                        {song.duration > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-[#F3E9D2] text-[#4A5D5A]">
                            {formatDuration(song.duration)}
                          </span>
                        )}

                        {songLyrics?.text && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#E6F4F1] text-[#095252] border border-[#0D6E6E]/25">
                            📖 Lyrics
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Open Lyrics / AI Studio Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (currentSong?.id !== song.id) {
                          playSong(song, true);
                        } else {
                          setIsLyricsOpen((open) => !open);
                        }
                      }}
                      title={
                        songLyrics?.text
                          ? 'View or Edit Lyrics'
                          : 'Generate Lyrics with Whisper AI or Add Notes'
                      }
                      className={`px-3 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 border ${
                        isCurrent && isLyricsOpen
                          ? 'bg-[#095252] text-white border-[#095252]'
                          : songLyrics?.text
                          ? 'bg-[#E6F4F1] hover:bg-[#0D6E6E] text-[#095252] hover:text-white border-[#0D6E6E]/30'
                          : 'bg-[#FFF8E7] hover:bg-[#E07A1F] text-[#9C3D10] hover:text-white border-[#D49B27]/50'
                      }`}
                    >
                      {songLyrics?.text ? (
                        <>
                          <BookOpen className="w-4 h-4" />
                          <span className="hidden sm:inline">Lyrics</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span className="hidden sm:inline">AI Lyrics</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Slide-Over Lyrics & In-Browser Whisper AI Drawer */}
      <LyricsDrawer
        song={currentSong}
        lyricEntry={currentSong ? lyricsMap[currentSong.id] : undefined}
        isOpen={isLyricsOpen}
        onClose={() => setIsLyricsOpen(false)}
        onSaveLyric={handleSaveLyric}
        onResetToPreloaded={handleResetToPreloaded}
        onOpenSettingsModal={() => setIsSettingsOpen(true)}
      />

      {/* Settings & Lyrics Sync Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        totalSongs={ALL_SONGS.length}
        totalCategories={categories.length}
        preloadedCount={preloadedLyricsCount}
        localCount={localLyricsCount}
        onLyricsImported={refreshLyrics}
      />

      {/* Persistent Bottom Audio Player Bar */}
      <PlayerBar
        currentSong={currentSong}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={audioDuration}
        volume={volume}
        isMuted={isMuted}
        speed={speed}
        loop={loop}
        isLyricsOpen={isLyricsOpen}
        hasLyrics={Boolean(currentSong && lyricsMap[currentSong.id]?.text)}
        onTogglePlay={handleTogglePlay}
        onPrev={handlePrev}
        onNext={handleNext}
        onSeek={handleSeek}
        onSkipSeconds={handleSkipSeconds}
        onVolumeChange={(val) => {
          setVolume(val);
          if (val > 0 && isMuted) setIsMuted(false);
        }}
        onToggleMute={() => setIsMuted((m) => !m)}
        onSpeedChange={setSpeed}
        onToggleRepeatSong={() =>
          setLoop((prev) => ({ ...prev, repeatSong: !prev.repeatSong }))
        }
        onSetLoopA={handleSetLoopA}
        onSetLoopB={handleSetLoopB}
        onClearABLoop={handleClearABLoop}
        onToggleLyrics={() => setIsLyricsOpen((o) => !o)}
      />
    </div>
  );
};

export default App;
