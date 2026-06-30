/**
 * ai-pipeline.js
 * MedicAssist — Team Member 1
 *
 * Orchestrates the full AI pipeline: Audio/Text → Transcript → Intermediate JSON
 * → FHIR R4 Bundle. This is the single entry point app.js (frontend) should call.
 *
 * Depends on:
 *   whisper-runner.js  (window.whisperTranscribeBlob)
 *   llm-runner.js      (window.llmExtract)
 *   fhir-builder.js    (buildFhirBundle, validateFhirBundle)
 *
 * Public API:
 *   await window.processAudioRecord(audioBlob, onProgress?) → PipelineResult
 *   await window.processTextRecord(text, onProgress?)       → PipelineResult
 *
 * PipelineResult shape:
 *   {
 *     success: boolean,
 *     transcript: string | null,
 *     intermediateJson: object | null,
 *     fhirBundle: object | null,
 *     validation: { valid: boolean, errors: array } | null,
 *     error: string | null,
 *     stage: string,        // which stage failed, if any
 *     rawLlmOutput: string | null,  // for manual recovery on parse failure
 *   }
 */

import { buildFhirBundle, validateFhirBundle } from './fhir-builder.js';

// ─── Progress stage weights (must sum to 100) ────────────────────────────────

const STAGE_WEIGHTS = {
  transcribe: 40, // audio path only; skipped for text input
  extract:    45,
  build:      10,
  validate:    5,
};

function makeScopedProgress(onProgress, stageName, stageStart, stageWeight) {
  return (pct, label) => {
    const overall = stageStart + Math.round((pct / 100) * stageWeight);
    onProgress?.(Math.min(99, overall), label || stageName);
  };
}

// ─── Result helpers ───────────────────────────────────────────────────────────

function emptyResult() {
  return {
    success: false,
    transcript: null,
    intermediateJson: null,
    fhirBundle: null,
    validation: null,
    error: null,
    stage: null,
    rawLlmOutput: null,
  };
}

function failAt(result, stage, error) {
  result.success = false;
  result.stage = stage;
  result.error = error.message || String(error);
  if (error.rawOutput) result.rawLlmOutput = error.rawOutput;
  console.error(`[ai-pipeline] Failed at stage "${stage}":`, error);
  return result;
}

// ─── Core pipeline (shared by audio and text entry points) ──────────────────

async function runExtractAndBuild(transcript, result, onProgress) {
  // Stage: LLM extraction
  let intermediateJson;
  try {
    const extractProgress = makeScopedProgress(onProgress, 'Extracting clinical data...', 40, STAGE_WEIGHTS.extract);
    intermediateJson = await window.llmExtract(transcript, extractProgress);
    result.intermediateJson = intermediateJson;
  } catch (err) {
    return failAt(result, 'extract', err);
  }

  // Stage: FHIR bundle construction
  let fhirBundle;
  try {
    onProgress?.(85, 'Building FHIR record...');
    fhirBundle = buildFhirBundle(intermediateJson);
    result.fhirBundle = fhirBundle;
  } catch (err) {
    return failAt(result, 'build', err);
  }

  // Stage: schema validation
  try {
    onProgress?.(95, 'Validating record...');
    const validation = await validateFhirBundle(fhirBundle);
    result.validation = validation;

    if (!validation.valid) {
      console.warn('[ai-pipeline] FHIR validation warnings:', validation.errors);
      // Per spec/prompt-template.md post-processing rule:
      // "On validation failure — Display raw LLM output with manual edit
      //  fields; do not discard." We surface the bundle anyway so the UI
      // can offer manual correction, but mark success=false so app.js knows
      // to show the edit flow instead of silently saving.
      result.success = false;
      result.stage = 'validate';
      result.error = 'FHIR bundle failed schema validation — manual review required';
      return result;
    }
  } catch (err) {
    // Validation infra itself failed — fhir-builder.js already falls back
    // to smokeValidate() internally, so this should be rare.
    return failAt(result, 'validate', err);
  }

  onProgress?.(100, 'Record ready');
  result.success = true;
  return result;
}

// ─── Public entry points ──────────────────────────────────────────────────────

/**
 * Full pipeline starting from a recorded audio Blob.
 *
 * @param {Blob} audioBlob
 * @param {Function} [onProgress] - (percent: number, label: string) => void
 * @returns {Promise<object>} PipelineResult
 */
async function processAudioRecord(audioBlob, onProgress) {
  const result = emptyResult();

  if (!audioBlob || audioBlob.size === 0) {
    return failAt(result, 'transcribe', new Error('No audio recorded'));
  }

  // Stage: transcription
  try {
    const transcribeProgress = makeScopedProgress(onProgress, 'Transcribing audio...', 0, STAGE_WEIGHTS.transcribe);
    const transcript = await window.whisperTranscribeBlob(audioBlob, transcribeProgress);
    result.transcript = transcript;
  } catch (err) {
    return failAt(result, 'transcribe', err);
  }

  return runExtractAndBuild(result.transcript, result, onProgress);
}

/**
 * Full pipeline starting from typed text (skips Whisper entirely).
 *
 * @param {string} text
 * @param {Function} [onProgress] - (percent: number, label: string) => void
 * @returns {Promise<object>} PipelineResult
 */
async function processTextRecord(text, onProgress) {
  const result = emptyResult();

  if (!text || !text.trim()) {
    return failAt(result, 'extract', new Error('No text provided'));
  }

  result.transcript = text.trim();
  onProgress?.(5, 'Preparing text...');

  return runExtractAndBuild(result.transcript, result, onProgress);
}

/**
 * Warms up both models in the background (call on app idle, e.g. after
 * the dashboard loads) so the first real recording doesn't pay the full
 * model-load cost.
 */
async function preloadModels(onProgress) {
  onProgress?.(0, 'Warming up AI models...');
  try {
    await Promise.all([
      window.whisperPreload?.(p => onProgress?.(Math.round(p * 0.5), 'Loading speech model...')),
      window.llmPreload?.(p => onProgress?.(50 + Math.round(p * 0.5), 'Loading language model...')),
    ]);
    onProgress?.(100, 'AI models ready');
  } catch (err) {
    // Preload failures are non-fatal — models will just load lazily on first use
    console.warn('[ai-pipeline] Preload failed (will retry on first use):', err.message);
  }
}

// Expose on window for app.js (no bundler in this PWA)
window.processAudioRecord = processAudioRecord;
window.processTextRecord  = processTextRecord;
window.preloadModels      = preloadModels;

export { processAudioRecord, processTextRecord, preloadModels };