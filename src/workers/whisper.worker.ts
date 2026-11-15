import { pipeline, env } from '@huggingface/transformers';
import type { WhisperProgressEvent } from '../types';

// Configure transformers.js for purely browser-side execution on GitHub Pages
env.allowLocalModels = false;
env.useBrowserCache = true;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transcriberPromise: Promise<any> | null = null;
let activeDevice: 'webgpu' | 'wasm' = 'wasm';

async function hasWebGPU(): Promise<boolean> {
  try {
    const nav = self.navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } };
    if (!nav.gpu) return false;
    const adapter = await nav.gpu.requestAdapter();
    return Boolean(adapter);
  } catch {
    return false;
  }
}

async function getTranscriber(songId: string) {
  if (transcriberPromise) return transcriberPromise;

  const useWebGPU = await hasWebGPU();
  activeDevice = useWebGPU ? 'webgpu' : 'wasm';

  const postProgress = (info: { status?: string; file?: string; progress?: number }) => {
    if (info.status === 'progress' || typeof info.progress === 'number') {
      const msg: WhisperProgressEvent = {
        type: 'download',
        songId,
        status: `Downloading Whisper AI model (${info.file || 'weights'})...`,
        file: info.file,
        progress: Math.round(info.progress ?? 0),
        device: activeDevice,
      };
      self.postMessage(msg);
    } else if (info.status === 'ready') {
      const msg: WhisperProgressEvent = {
        type: 'status',
        songId,
        status: `Whisper AI ready (${activeDevice.toUpperCase()})`,
        device: activeDevice,
      };
      self.postMessage(msg);
    }
  };

  transcriberPromise = (async () => {
    try {
      if (useWebGPU) {
        return await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
          device: 'webgpu',
          dtype: {
            encoder_model: 'fp32',
            decoder_model_merged: 'q4',
          },
          progress_callback: postProgress,
        });
      }
    } catch (err) {
      console.warn('WebGPU initialization failed, falling back to WASM:', err);
      activeDevice = 'wasm';
    }

    return await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
      device: 'wasm',
      dtype: 'q8',
      progress_callback: postProgress,
    });
  })();

  return transcriberPromise;
}

function formatTimestamp(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

self.addEventListener('message', async (event: MessageEvent<{ songId: string; audio: Float32Array }>) => {
  const { songId, audio } = event.data;

  try {
    self.postMessage({
      type: 'status',
      songId,
      status: 'Loading Whisper AI model in browser...',
    } satisfies WhisperProgressEvent);

    const transcriber = await getTranscriber(songId);

    self.postMessage({
      type: 'status',
      songId,
      status: `Transcribing audio with Whisper (${activeDevice.toUpperCase()})...`,
      device: activeDevice,
    } satisfies WhisperProgressEvent);

    const output = await transcriber(audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
    });

    let formattedText = '';
    if (output && Array.isArray(output.chunks) && output.chunks.length > 0) {
      const lines = output.chunks
        .map((chunk: { timestamp?: [number, number | null]; text?: string }) => {
          const text = (chunk.text || '').trim();
          if (!text) return '';
          if (chunk.timestamp && typeof chunk.timestamp[0] === 'number') {
            return `[${formatTimestamp(chunk.timestamp[0])}] ${text}`;
          }
          return text;
        })
        .filter(Boolean);
      formattedText = lines.join('\n');
    } else if (output && typeof output.text === 'string') {
      formattedText = output.text.trim();
    }

    if (!formattedText) {
      formattedText = '(No vocal lyrics detected in this audio recording. You can click "Edit Lyrics" to add Swaram or Sahithyam notes!)';
    }

    self.postMessage({
      type: 'complete',
      songId,
      text: formattedText,
      device: activeDevice,
    } satisfies WhisperProgressEvent);
  } catch (err) {
    transcriberPromise = null;
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({
      type: 'error',
      songId,
      error: message,
    } satisfies WhisperProgressEvent);
  }
});
