/**
 * llm-runner.js
 * MedicAssist — Team Member 1
 *
 * Loads Phi-3-mini-4k-instruct (Q4_K_M GGUF) via llama.cpp WASM and extracts
 * structured clinical JSON from a medic's transcript or typed note.
 *
 * Public API (attached to window for app.js):
 *   await window.llmExtract(transcriptText, onProgress?) → object
 *
 * onProgress(percent: number, stage: string) — optional callback for UI updates
 *
 * The model is loaded once and cached in memory. Subsequent calls reuse
 * the loaded instance (no reload between records).
 *
 * Offline-safe: both llama.wasm and the GGUF model are same-origin files
 * served from /models/ and cached by the service worker.
 */

// ─── Config ───────────────────────────────────────────────────────────────────

const LLM_CONFIG = {
  modelPath:    '/models/phi-3-mini-4k-instruct-q4.gguf',
  wasmPath:     '/vendor/llama/llama.js',       // llama.cpp WASM shim
  contextSize:  2048,
  maxTokens:    512,
  temperature:  0.1,   // Low temp → deterministic JSON
  topP:         0.9,
  repeatPenalty: 1.1,
  threads:      Math.max(1, Math.min(navigator.hardwareConcurrency ?? 2, 4)),
};

// ─── System prompt (mirrors spec/prompt-template.md exactly) ─────────────────

const SYSTEM_PROMPT = `You are a medical data extraction assistant for field triage. Extract structured clinical data from the medic's note below.

Return ONLY a valid JSON object. No prose, no explanations, no markdown fences.

The JSON must follow this exact structure:
{
  "patient": {
    "estimatedAge": <integer or null>,
    "gender": "<male|female|other|unknown>",
    "id": "<optional patient ID if mentioned>"
  },
  "encounter": {
    "triageLevel": "<Red|Yellow|Green|Black|Unknown>",
    "triageTime": "<HH:MM or null>",
    "location": "<string or null>"
  },
  "conditions": [
    {
      "description": "<injury or complaint text>",
      "bodysite": "<body part or null>",
      "severity": "<mild|moderate|severe|null>"
    }
  ],
  "vitals": [
    {
      "type": "<blood_pressure|heart_rate|respiratory_rate|oxygen_saturation|consciousness|temperature>",
      "value": "<string>",
      "unit": "<string or null>",
      "time": "<HH:MM or null>"
    }
  ],
  "procedures": [
    {
      "description": "<what was done>",
      "time": "<HH:MM or null>",
      "status": "<completed|in-progress|not-done>"
    }
  ],
  "rawNote": "<original medic note verbatim>"
}

Triage levels:
- Red   = Immediate, life-threatening, needs care now
- Yellow = Delayed, serious but can wait
- Green  = Minor, walking wounded
- Black  = Deceased or expectant (unsalvageable)

If a field is not mentioned, use null. Do not invent information.`;

// ─── Few-shot examples (prepended to user message) ───────────────────────────

const FEW_SHOT = `
EXAMPLE INPUT:
Patient is a 30-year-old male, severe laceration on left thigh, bleeding heavily, applied tourniquet at 0915, triage level red.

EXAMPLE OUTPUT:
{"patient":{"estimatedAge":30,"gender":"male","id":null},"encounter":{"triageLevel":"Red","triageTime":"09:15","location":null},"conditions":[{"description":"Severe laceration with heavy bleeding","bodysite":"left thigh","severity":"severe"}],"vitals":[],"procedures":[{"description":"Tourniquet application","time":"09:15","status":"completed"}],"rawNote":"Patient is a 30-year-old male, severe laceration on left thigh, bleeding heavily, applied tourniquet at 0915, triage level red."}

EXAMPLE INPUT:
Female, approximately 45, found unconscious, GCS 8, BP 90/60, HR 120 irregular. Priority immediate. IV access, 500ml saline running.

EXAMPLE OUTPUT:
{"patient":{"estimatedAge":45,"gender":"female","id":null},"encounter":{"triageLevel":"Red","triageTime":null,"location":null},"conditions":[{"description":"Unconscious, GCS 8, possible internal bleeding","bodysite":null,"severity":"severe"}],"vitals":[{"type":"consciousness","value":"GCS 8","unit":null,"time":null},{"type":"blood_pressure","value":"90/60","unit":"mmHg","time":null},{"type":"heart_rate","value":"120 irregular","unit":"bpm","time":null}],"procedures":[{"description":"IV access, 500ml saline infusion","time":null,"status":"in-progress"}],"rawNote":"Female, approximately 45, found unconscious, GCS 8, BP 90/60, HR 120 irregular. Priority immediate. IV access, 500ml saline running."}

`;

// ─── Module state ─────────────────────────────────────────────────────────────

let _llama     = null;   // llama.cpp WASM module instance
let _model     = null;   // loaded model handle
let _loading   = false;
let _loadPromise = null;

// ─── WASM loader ──────────────────────────────────────────────────────────────

async function loadWasm(onProgress) {
  if (_model) return;          // Already loaded
  if (_loadPromise) return _loadPromise; // Load in progress

  _loading = true;

  _loadPromise = (async () => {
    onProgress?.(5, 'Loading llama.cpp WASM...');

    // Load the llama.cpp JS shim (compiled WASM wrapper)
    if (!window.LlamaModel) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = LLM_CONFIG.wasmPath;
        s.onload = resolve;
        s.onerror = () => reject(new Error(`Failed to load llama WASM shim from ${LLM_CONFIG.wasmPath}`));
        document.head.appendChild(s);
      });
    }

    onProgress?.(15, 'Downloading model (first run only)...');

    // Fetch model with progress tracking
    const response = await fetch(LLM_CONFIG.modelPath);
    if (!response.ok) {
      throw new Error(`Model fetch failed: ${response.status} ${LLM_CONFIG.modelPath}`);
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
        const pct = 15 + Math.round((received / total) * 60);
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

    onProgress?.(85, 'Initialising inference engine...');

    // Initialise llama.cpp WASM with our config
    _llama = await window.LlamaModel.init({
      modelBuffer: modelBuffer.buffer,
      contextSize: LLM_CONFIG.contextSize,
      threads:     LLM_CONFIG.threads,
    });

    _model = _llama;
    _loading = false;

    onProgress?.(100, 'Model ready');
  })();

  return _loadPromise;
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(transcriptText) {
  // Phi-3-mini chat template:
  // <|system|>\n{system}\n<|end|>\n<|user|>\n{user}\n<|end|>\n<|assistant|>\n
  return (
    `<|system|>\n${SYSTEM_PROMPT}\n<|end|>\n` +
    `<|user|>\n${FEW_SHOT}MEDIC NOTE:\n${transcriptText.trim()}\n<|end|>\n` +
    `<|assistant|>\n`
  );
}

// ─── Output parser ────────────────────────────────────────────────────────────

/**
 * Strips markdown fences and extracts the first valid JSON object from raw
 * LLM output. Phi-3 sometimes adds prose before or after the JSON despite
 * the system prompt; we find the first { ... } block.
 */
function parseJsonOutput(raw) {
  // Strip ```json ... ``` fences
  let cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // Find the first opening brace and matching closing brace
  const start = cleaned.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in LLM output');

  // Walk to find balanced closing brace
  let depth = 0;
  let end = -1;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === '{') depth++;
    else if (cleaned[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  if (end === -1) throw new Error('Unbalanced JSON braces in LLM output');

  const jsonStr = cleaned.slice(start, end + 1);
  return JSON.parse(jsonStr);
}

/**
 * Applies sensible defaults and type coercions to LLM output that may be
 * slightly off-spec (null vs missing, string ages, etc.)
 */
function normaliseOutput(obj) {
  const result = {
    patient: {
      estimatedAge: null,
      gender:       'unknown',
      id:           null,
      ...(obj.patient || {}),
    },
    encounter: {
      triageLevel: 'Unknown',
      triageTime:  null,
      location:    null,
      ...(obj.encounter || {}),
    },
    conditions:  Array.isArray(obj.conditions)  ? obj.conditions  : [],
    vitals:      Array.isArray(obj.vitals)       ? obj.vitals       : [],
    procedures:  Array.isArray(obj.procedures)   ? obj.procedures   : [],
    rawNote:     obj.rawNote || '',
  };

  // Coerce age to integer
  if (typeof result.patient.estimatedAge === 'string') {
    const n = parseInt(result.patient.estimatedAge);
    result.patient.estimatedAge = isNaN(n) ? null : n;
  }

  // Ensure gender is one of the allowed values
  const allowed = ['male', 'female', 'other', 'unknown'];
  if (!allowed.includes((result.patient.gender || '').toLowerCase())) {
    result.patient.gender = 'unknown';
  } else {
    result.patient.gender = result.patient.gender.toLowerCase();
  }

  return result;
}

// ─── Inference ────────────────────────────────────────────────────────────────

async function runInference(prompt, onProgress) {
  onProgress?.(10, 'Preparing prompt...');

  let outputText = '';

  // llama.cpp WASM generate() — yields tokens via callback
  await _model.generate({
    prompt,
    maxTokens:     LLM_CONFIG.maxTokens,
    temperature:   LLM_CONFIG.temperature,
    topP:          LLM_CONFIG.topP,
    repeatPenalty: LLM_CONFIG.repeatPenalty,
    onToken: (token, tokenIndex) => {
      outputText += token;
      // Rough progress: assume ~300 tokens for full output
      const pct = 10 + Math.min(85, Math.round((tokenIndex / 300) * 85));
      onProgress?.(pct, 'Extracting clinical data...');

      // Early stop: once we see a closing brace at depth 0 after the first {,
      // the JSON is complete — no need to generate more tokens
      const firstBrace = outputText.indexOf('{');
      if (firstBrace !== -1) {
        let depth = 0;
        for (const ch of outputText.slice(firstBrace)) {
          if (ch === '{') depth++;
          else if (ch === '}') depth--;
          if (depth === 0) return false; // signal stop to llama.cpp
        }
      }
    },
  });

  onProgress?.(95, 'Parsing output...');
  return outputText;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extracts structured clinical data from a transcript or typed medic note.
 *
 * @param {string} transcriptText  - The raw transcript from Whisper or typed input
 * @param {Function} [onProgress]  - Optional (percent: number, stage: string) => void
 * @returns {Promise<object>}      - Normalised intermediate JSON (see prompt-template.md)
 * @throws {Error}                 - On model load failure or unparseable LLM output
 */
async function llmExtract(transcriptText, onProgress) {
  if (!transcriptText || !transcriptText.trim()) {
    throw new Error('llmExtract: transcriptText cannot be empty');
  }

  // Phase A: load model (skipped if already loaded)
  if (!_model) {
    await loadWasm(p => onProgress?.(Math.round(p * 0.6), 'Loading AI model...'));
  }

  // Phase B: inference
  const prompt = buildPrompt(transcriptText);

  let rawOutput;
  try {
    rawOutput = await runInference(
      prompt,
      (p, stage) => onProgress?.(60 + Math.round(p * 0.4), stage),
    );
  } catch (err) {
    throw new Error(`LLM inference failed: ${err.message}`);
  }

  // Phase C: parse + normalise
  let parsed;
  try {
    parsed = parseJsonOutput(rawOutput);
  } catch (err) {
    // Attach raw output to error so app.js can show it in the UI
    const e = new Error(`JSON parse failed: ${err.message}`);
    e.rawOutput = rawOutput;
    throw e;
  }

  onProgress?.(100, 'Extraction complete');
  return normaliseOutput(parsed);
}

// Expose on window for app.js (no bundler in this PWA)
window.llmExtract = llmExtract;

// Also expose model preload so app.js can warm it up on idle
window.llmPreload = (onProgress) => loadWasm(onProgress);

export { llmExtract };