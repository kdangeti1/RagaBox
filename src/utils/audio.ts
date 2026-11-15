/**
 * Resolves a relative path like "music/Upper sthayi/#1.m4a" into a properly
 * URL-encoded path respecting Vite's configurable base URL for GitHub Pages.
 */
export function getAudioUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL || './';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const cleanRel = relativePath.replace(/^\/+/, '');
  const encodedPath = cleanRel
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${normalizedBase}${encodedPath}`;
}

/**
 * Formats seconds into M:SS or H:MM:SS.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const totalSecs = Math.floor(seconds);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Decodes an MP3/M4A file from URL into a 16kHz mono Float32Array using the Web Audio API
 * for in-browser Whisper transcription.
 */
export async function decodeAudioTo16kHzMono(relativePath: string): Promise<Float32Array> {
  const url = getAudioUrl(relativePath);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio file (${response.status} ${response.statusText})`);
  }
  const arrayBuffer = await response.arrayBuffer();

  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx();

  try {
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const targetSampleRate = 16000;
    const targetLength = Math.max(1, Math.ceil(decodedBuffer.duration * targetSampleRate));

    const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = decodedBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    const channelData = renderedBuffer.getChannelData(0);
    return new Float32Array(channelData);
  } finally {
    await audioCtx.close().catch(() => {});
  }
}

/**
 * Category metadata helper: returns a kid-friendly icon/badge color and subtitle for Carnatic categories.
 */
export function getCategoryMeta(category: string): {
  emoji: string;
  badgeBg: string;
  badgeText: string;
  description: string;
} {
  const lower = category.toLowerCase();
  if (lower.includes('sarali')) {
    return {
      emoji: '🌱',
      badgeBg: 'bg-[#E6F4F1]',
      badgeText: 'text-[#095252]',
      description: 'Foundational Swara steps (Sa Ri Ga Ma Pa Dha Ni Sa)',
    };
  }
  if (lower.includes('janta')) {
    return {
      emoji: '🌿',
      badgeBg: 'bg-[#E8F5E9]',
      badgeText: 'text-[#1B5E20]',
      description: 'Double-note Swara patterns (SS RR GG MM)',
    };
  }
  if (lower.includes('dhaatu') || lower.includes('dhatu')) {
    return {
      emoji: '🦌',
      badgeBg: 'bg-[#FFF3E0]',
      badgeText: 'text-[#B25000]',
      description: 'Zig-zag jumping Swara exercises',
    };
  }
  if (lower.includes('upper') || lower.includes('sthayi')) {
    return {
      emoji: '⭐',
      badgeBg: 'bg-[#FFF8E1]',
      badgeText: 'text-[#8D5B00]',
      description: 'Higher octave (Thara Sthayi) voice exercises',
    };
  }
  if (lower.includes('alankaram')) {
    return {
      emoji: '🥁',
      badgeBg: 'bg-[#FCE4EC]',
      badgeText: 'text-[#880E4F]',
      description: 'Suladi Sapta Thaala rhythm patterns',
    };
  }
  if (lower.includes('geetham')) {
    return {
      emoji: '🪷',
      badgeBg: 'bg-[#FDF0E6]',
      badgeText: 'text-[#9C3D10]',
      description: 'First melodic songs combining Swaram & Sahithyam',
    };
  }
  if (lower.includes('jathiswaram') || lower.includes('swarajathi')) {
    return {
      emoji: '🦚',
      badgeBg: 'bg-[#E0F2F1]',
      badgeText: 'text-[#004D40]',
      description: 'Rhythmic Raga compositions with Swara passages',
    };
  }
  if (lower.includes('note')) {
    return {
      emoji: '🎶',
      badgeBg: 'bg-[#EDE7F6]',
      badgeText: 'text-[#4527A0]',
      description: 'Joyful Nottuswaram melodies by Muthuswami Dikshitar',
    };
  }
  if (lower.includes('varnam')) {
    return {
      emoji: '👑',
      badgeBg: 'bg-[#FFF3CD]',
      badgeText: 'text-[#7A4F01]',
      description: 'Concert openers mastering Raga, Laya & Chittaiswaram',
    };
  }
  if (lower.includes('keerthanam') || lower.includes('krithi')) {
    return {
      emoji: '🪔',
      badgeBg: 'bg-[#FBE9E7]',
      badgeText: 'text-[#9A2515]',
      description: 'Devotional Kriti & Keerthanam compositions',
    };
  }
  return {
    emoji: '🎵',
    badgeBg: 'bg-[#E6F4F1]',
    badgeText: 'text-[#0D6E6E]',
    description: 'Devotional songs, Bhajans & practice recordings',
  };
}
