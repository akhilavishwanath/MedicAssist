/**
 * whisper-runner.js
 * MedicAssist — Team Member 1
 *
 * Loads Whisper small.en (GGML) via whisper.cpp WASM and transcribes
 * recorded audio fully offline.
 *
 * Public API (attached to window for app.js):
 *   await window.whisperTranscribe(audioBuffer, onProgress?) → string
 *
 * onProgress(percent: number, stage: string) — optional callback for UI updates
 *
 * audioBuffer must be a mono 16kHz Float32Array (PCM). Use
 * preprocessAudioBlob() to convert a recorded WebM/WAV Blob into this format.
 *
 * Offline-safe: both whisper.wasm and the GGML model are same-origin files
 * served from /vendor/whisper/ and /models/, cached by the service worker.
 */

// ─── Config ───────────────────────────────────────────────────────────────────

const WHISPER_CONFIG = {
  modelPath:   '/models/ggml-small.en.bin',
  wasmPath:    '/vendor/whisper/whisper.js',  // whisper.cpp WASM shim
  sampleRate:  16000,                          // Whisper requires 16kHz mono
  language:    'en',
  threads:     Math.max(1, Math.min(navigator.hardwareConcurrency ?? 2, 4)),
};

// ─── Module state ─────────────────────────────────────────────────────────────

let _whisper      = null; // whisper.cpp WASM module instance
let _model        = null; // loaded model handle
let _loadPromise  = null;

// ─── WASM + model loader ──────────────────────────────────────────────────────

async function loadWasm(onProgress) {
  if (_model) return;
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    onProgress?.(5, 'Loading whisper.cpp WASM...');

    if (!window.WhisperModel) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = WHISPER_CONFIG.wasmPath;
        s.onload = resolve;
        s.onerror = () => reject(new Error(`Failed to load whisper WASM shim from ${WHISPER_CONFIG.wasmPath}`));
        document.head.appendChild(s);
      });
    }

    onProgress?.(15, 'Downloading speech model (first run only)...');

    const response = await fetch(WHISPER_CONFIG.modelPath);
    if (!response.ok) {
      throw new Error(`Model fetch failed: ${response.status} ${WHISPER_CONFIG.modelPath}`);
    }

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength) : null;
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (total) {
        const pct = 15 + Math.round((received / total) * 55);
        onProgress?.(pct, `Downloading model... ${Math.round(received / 1024 / 1024)} MB`);
      }
    }

    onProgress?.(75, 'Loading model into memory...');

    const modelBuffer = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      modelBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    onProgress?.(85, 'Initialising speech engine...');

    _whisper = await window.WhisperModel.init({
      modelBuffer: modelBuffer.buffer,
      language:    WHISPER_CONFIG.language,
      threads:     WHISPER_CONFIG.threads,
    });

    _model = _whisper;

    onProgress?.(100, 'Speech model ready');
  })();

  return _loadPromise;
}

// ─── Audio preprocessing ──────────────────────────────────────────────────────

/**
 * Converts a recorded audio Blob (WebM/WAV/Ogg — whatever MediaRecorder gave
 * us) into a mono 16kHz Float32Array PCM buffer that whisper.cpp expects.
 *
 * Uses the Web Audio API's OfflineAudioContext to decode + resample —
 * works fully offline, no server round-trip.
 *
 * @param {Blob} audioBlob
 * @returns {Promise<Float32Array>}
 */
export async function preprocessAudioBlob(audioBlob) {
  const arrayBuffer = await audioBlob.arrayBuffer();

  // Decode using a temporary AudioContext (native sample rate)
  const decodeCtx = new (window.AudioContext || window.webkitAudioContext)();
  const decoded = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
  decodeCtx.close();

  // Resample to 16kHz mono using OfflineAudioContext
  const targetSampleRate = WHISPER_CONFIG.sampleRate;
  const duration = decoded.duration;
  const offlineCtx = new OfflineAudioContext(
    1,                                       // mono
    Math.ceil(duration * targetSampleRate),
    targetSampleRate,
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;

  // Downmix to mono if the source has multiple channels
  const merger = offlineCtx.createChannelMerger(1);
  source.connect(merger);
  merger.connect(offlineCtx.destination);
  source.start(0);

  const rendered = await offlineCtx.startRendering();
  return rendered.getChannelData(0); // Float32Array, mono, 16kHz
}

// ─── Transcription ────────────────────────────────────────────────────────────

/**
 * Runs whisper.cpp inference on a preprocessed audio buffer.
 *
 * @param {Float32Array} audioBuffer - mono 16kHz PCM, e.g. from preprocessAudioBlob()
 * @param {Function} [onProgress]    - (percent: number, stage: string) => void
 * @returns {Promise<string>}        - the transcript text
 */
async function whisperTranscribe(audioBuffer, onProgress) {
  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error('whisperTranscribe: audioBuffer is empty');
  }

  // Phase A: load model (skipped if already loaded)
  if (!_model) {
    await loadWasm(p => onProgress?.(Math.round(p * 0.5), 'Loading speech model...'));
  }

  onProgress?.(55, 'Transcribing audio...');

  let transcript = '';
  try {
    // whisper.cpp WASM transcribe() — yields segments via callback
    const result = await _model.transcribe({
      audio: audioBuffer,
      onSegment: (segmentText, segmentIndex, totalEstimate) => {
        transcript += segmentText;
        if (totalEstimate) {
          const pct = 55 + Math.min(40, Math.round((segmentIndex / totalEstimate) * 40));
          onProgress?.(pct, 'Transcribing audio...');
        }
      },
    });

    // Some whisper.cpp WASM builds return the full text directly too
    if (result && typeof result.text === 'string' && result.text.length > transcript.length) {
      transcript = result.text;
    }
  } catch (err) {
    throw new Error(`Whisper inference failed: ${err.message}`);
  }

  const cleaned = transcript.trim();
  if (!cleaned) {
    throw new Error('Whisper produced an empty transcript — check audio quality and try again');
  }

  onProgress?.(100, 'Transcription complete');
  return cleaned;
}

/**
 * Convenience wrapper: takes a raw recorded Blob, preprocesses it, and
 * transcribes it in one call. This is what app.js should call directly.
 *
 * @param {Blob} audioBlob
 * @param {Function} [onProgress]
 * @returns {Promise<string>}
 */
async function transcribeBlob(audioBlob, onProgress) {
  onProgress?.(0, 'Preparing audio...');
  const pcm = await preprocessAudioBlob(audioBlob);
  return whisperTranscribe(pcm, onProgress);
}

// Expose on window for app.js (no bundler in this PWA)
window.whisperTranscribe = whisperTranscribe;
window.whisperTranscribeBlob = transcribeBlob;
window.whisperPreload = (onProgress) => loadWasm(onProgress);

export { whisperTranscribe, transcribeBlob };