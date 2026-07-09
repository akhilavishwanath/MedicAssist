import { showToast } from "./components/utils.js";
import {
    updateSpeechStatus,
    updateLLMStatus,
    updateFHIRStatus,
    resetStatus
} from "./components/status.js";

import {
    showTranscript,
    clearTranscript
} from "./components/transcript.js";
import {
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording
} from "./components/recorder.js";

import {
    showFHIR,
    clearFHIR
} from "./components/fhirViewer.js";
import { extractMedicalNote, transcribeAudio } from "./api-client.js?v=5";
import { buildFhirBundle } from "./fhir-builder.js?v=5";

document.addEventListener("DOMContentLoaded", () => {

    const generateBtn = document.getElementById("generateBtn");
    const medicalText = document.getElementById("medicalText");
    

const startBtn = document.getElementById("startRecording");
const stopBtn = document.getElementById("stopRecording");
const pauseBtn = document.getElementById("pauseRecording");
const submitAudioBtn = document.getElementById("submitAudio");
const audioUpload = document.getElementById("audioUpload");

const audioPlayer = document.getElementById("audioPreview");
const recordingResult = document.getElementById("recordingResult");
const indicator = document.getElementById("recordingIndicator");
const duration = document.getElementById("recordDuration");

const againBtn = document.getElementById("recordAgain");

let recordedAudio = null;
let paused = false;

async function getSelectedAudio() {
    if (recordedAudio && recordedAudio.size > 0) {
        return recordedAudio;
    }

    if (audioUpload.files && audioUpload.files[0]) {
        return audioUpload.files[0];
    }

    if (audioPlayer.src && audioPlayer.src.startsWith("blob:")) {
        const response = await fetch(audioPlayer.src);
        const blob = await response.blob();

        if (blob.size > 0) {
            return blob;
        }
    }

    return null;
}

    resetStatus();
    clearTranscript();
    clearFHIR();
        // =============================
// Start Recording
// =============================

startBtn.addEventListener("click", async () => {

    await startRecording();

    indicator.innerHTML = "🔴 Recording...";

    recordingResult.classList.add("hidden");

    paused = false;

    pauseBtn.innerHTML =
        '<i class="fa-solid fa-pause"></i> Pause';

    updateSpeechStatus("Recording");

    showToast("Recording Started");

});

// =============================
// Pause / Resume
// =============================

pauseBtn.addEventListener("click", () => {

    if (!paused) {

        pauseRecording();

        paused = true;

        indicator.innerHTML = "⏸ Recording Paused";

        pauseBtn.innerHTML =
            '<i class="fa-solid fa-play"></i> Resume';

    } else {

        resumeRecording();

        paused = false;

        indicator.innerHTML = "🔴 Recording...";

        pauseBtn.innerHTML =
            '<i class="fa-solid fa-pause"></i> Pause';

    }

});

// =============================
// Stop Recording
// =============================

stopBtn.addEventListener("click", async () => {
const result = await stopRecording();

if (!result || !result.blob || result.blob.size === 0) {
    showToast("Recording did not save audio. Please record again.", "error");
    return;
}

recordedAudio = result.blob;
    indicator.innerHTML = "✅ Recording Completed";

    duration.innerText = `(${result.duration} sec)`;

    audioPlayer.src = result.url;
    recordingResult.querySelectorAll(".download-recording").forEach(link => link.remove());
    const link = document.createElement("a");
link.href = result.url;
link.download = "recording";
link.className = "download-recording";
link.textContent = "Download Recording";
document.getElementById("recordingResult").appendChild(link);

    recordingResult.classList.remove("hidden");

    updateSpeechStatus("Completed");

    showToast(`Recording Saved (${result.duration}s)`);

});

// =============================
// Record Again
// =============================

againBtn.addEventListener("click", () => {

    audioPlayer.src = "";

    recordingResult.classList.add("hidden");

    document.getElementById("recordingTime").innerText = "00:00";

    indicator.innerHTML = "⚪ Ready to Record";

    recordedAudio = null;

});

submitAudioBtn.addEventListener("click", async () => {
    const audio = await getSelectedAudio();

    if (!audio) {
        showToast("No audio selected. Record or upload an audio file first.", "error");
        return;
    }

    submitAudioBtn.disabled = true;
    submitAudioBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting Audio...';
    updateSpeechStatus("Transcribing...");
    updateLLMStatus("Waiting...");
    updateFHIRStatus("Waiting...");

    try {
        const result = await transcribeAudio(audio);
        const bundle = buildFhirBundle(result.medicalJson);
        showTranscript(result.transcript);
        showFHIR(bundle);
        updateSpeechStatus("Completed");
        updateLLMStatus("Completed");
        updateFHIRStatus("Completed");
        showToast("Audio processed successfully!");
    } catch (error) {
        updateSpeechStatus("Failed");
        updateLLMStatus("Failed");
        updateFHIRStatus("Failed");
        showToast(error.message || "Unable to process the audio.", "error");
    } finally {
        submitAudioBtn.disabled = false;
        submitAudioBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Submit Audio';
    }
});

    generateBtn.addEventListener("click", async () => {

        const input = medicalText.value.trim();

        if (!input) {
            showToast("Please enter medical notes first.", "error");
            return;
        }

        updateSpeechStatus("Completed");
        updateLLMStatus("Processing...");
        updateFHIRStatus("Generating...");

        showTranscript(input);

        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

        try {
            const result = await extractMedicalNote(input);
            const bundle = buildFhirBundle(result.medicalJson);
            updateLLMStatus("Completed");
            updateFHIRStatus("Completed");
            showFHIR(bundle);
            showToast("FHIR JSON Generated Successfully!");
        } catch (error) {
            updateLLMStatus("Failed");
            updateFHIRStatus("Failed");
            showToast(error.message || "Unable to process the medical note.", "error");
        } finally {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Medical Note';
        }

    });

});
