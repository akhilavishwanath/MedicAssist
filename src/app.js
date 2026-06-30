import { buildFhirBundle } from "./fhir-builder.js";
import { extractMedicalNote, transcribeAudio } from "./api-client.js";

import {
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording
} from "./components/recorder.js";

import { showToast } from "./components/utils.js";
import { copyJsonToClipboard, downloadJsonFile } from "./components/exportUtils.js";
import { saveRecord } from "./db.js";
import { renderRecordsList } from "./components/records.js";

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
    showFHIR,
    clearFHIR
} from "./components/fhirViewer.js";

document.addEventListener("DOMContentLoaded", () => {

    // -------------------------
    // Elements
    // -------------------------

    const startBtn = document.getElementById("startRecording");
    const stopBtn = document.getElementById("stopRecording");
    const pauseBtn = document.getElementById("pauseRecording");

    const againBtn = document.getElementById("recordAgain");
    const submitBtn = document.getElementById("submitAudio");

    const recordingResult =
        document.getElementById("recordingResult");

    const audioPlayer =
        document.getElementById("audioPreview");

    const indicator =
        document.getElementById("recordingIndicator");

    const duration =
        document.getElementById("recordDuration");

    const timer =
        document.getElementById("recordingTime");

    const generateBtn =
        document.getElementById("generateBtn");

    const audioUpload =
        document.getElementById("audioUpload");

    const medicalText =
        document.getElementById("medicalText");

    const copyJsonBtn =
        document.getElementById("copyJson");

    const downloadJsonBtn =
        document.getElementById("downloadJson");

    let recordedBlob = null;
    let paused = false;
    let processing = false;

    // -------------------------
    // Initial UI
    // -------------------------

    resetStatus();
    clearTranscript();
    clearFHIR();
    renderRecordsList();

    recordingResult.classList.add("hidden");

    indicator.innerHTML = "⚪ Ready to Record";

    timer.textContent = "00:00";

    duration.textContent = "";

    audioPlayer.pause();
    audioPlayer.removeAttribute("src");
    audioPlayer.load();

    startBtn.disabled = false;
    pauseBtn.disabled = true;
    stopBtn.disabled = true;

    function setProcessing(isProcessing) {
        processing = isProcessing;
        submitBtn.disabled = isProcessing || !recordedBlob;
        generateBtn.disabled = isProcessing;
        audioUpload.disabled = isProcessing;
    }

    async function renderMedicalJson(medicalJson) {
        if (!medicalJson) {
            updateLLMStatus("Failed");
            updateFHIRStatus("Failed");
            showToast("Clinical extraction returned empty output", "error");
            return;
        }

        updateLLMStatus("Completed");
        updateFHIRStatus("Generating...");

        const fhirBundle = buildFhirBundle(medicalJson);
        showFHIR(fhirBundle);
        updateFHIRStatus("Completed");
        showToast("FHIR JSON Generated Successfully!");

        await saveRecord(fhirBundle);
        await renderRecordsList();
    }

    async function submitAudioSource(audioSource) {
        try {
            setProcessing(true);
            clearTranscript();
            clearFHIR();
            updateSpeechStatus("Uploading Audio...");
            updateLLMStatus("Waiting...");
            updateFHIRStatus("Waiting...");

            const result = await transcribeAudio(audioSource);

            showTranscript(result.transcript || "No transcript received");
            updateSpeechStatus("Completed");
            updateLLMStatus("Extracting...");

            await renderMedicalJson(result.medicalJson);
        } catch (err) {
            console.error("Backend Error:", err);
            updateSpeechStatus("Failed");
            updateLLMStatus("Failed");
            updateFHIRStatus("Failed");
            showToast(err.message || "Backend Connection Failed", "error");
        } finally {
            setProcessing(false);
        }
    }

    // -------------------------
    // START
    // -------------------------

    startBtn.addEventListener("click", async () => {
        console.log("START RECORDING CLICKED");
        const started = await startRecording();

        if (!started) return;

        paused = false;

        recordedBlob = null;
        setProcessing(false);

        recordingResult.classList.add("hidden");

        audioPlayer.pause();
        audioPlayer.removeAttribute("src");
        audioPlayer.load();

        duration.textContent = "";

        indicator.innerHTML = "🔴 Recording...";

        timer.textContent = "00:00";

        updateSpeechStatus("Recording...");

        pauseBtn.innerHTML =
            '<i class="fa-solid fa-pause"></i> Pause';

        startBtn.disabled = true;
        pauseBtn.disabled = false;
        stopBtn.disabled = false;

        showToast("Recording Started");

    });

    // -------------------------
    // PAUSE
    // -------------------------

    pauseBtn.addEventListener("click", () => {

        if (!paused) {

            pauseRecording();

            paused = true;

            indicator.innerHTML =
                "⏸ Recording Paused";

            pauseBtn.innerHTML =
                '<i class="fa-solid fa-play"></i> Resume';

            showToast("Recording Paused");

        } else {

            resumeRecording();

            paused = false;

            indicator.innerHTML =
                "🔴 Recording...";

            pauseBtn.innerHTML =
                '<i class="fa-solid fa-pause"></i> Pause';

            showToast("Recording Resumed");

        }

    });

    // -------------------------
    // STOP
    // -------------------------

    stopBtn.addEventListener("click", async () => {
        console.log("STOP RECORDING CLICKED");
        const result = await stopRecording();

        if (!result) {

            showToast("Recording failed", "error");

            return;

        }

        recordedBlob = result.blob;
        setProcessing(false);

        audioPlayer.src = result.url;

        audioPlayer.load();

        recordingResult.classList.remove("hidden");

        indicator.innerHTML =
            "✅ Recording Completed";

        duration.textContent =
            `(${result.duration} sec)`;

        timer.textContent =
            `${String(Math.floor(result.duration / 60)).padStart(2, "0")}:${String(result.duration % 60).padStart(2, "0")}`;

        startBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;

        updateSpeechStatus("Completed");

        showToast("Recording Saved");

    });

    // -------------------------
    // RECORD AGAIN
    // -------------------------

    againBtn.addEventListener("click", () => {

        recordedBlob = null;
        setProcessing(false);

        audioPlayer.pause();

        audioPlayer.removeAttribute("src");

        audioPlayer.load();

        recordingResult.classList.add("hidden");

        indicator.innerHTML =
            "⚪ Ready to Record";

        duration.textContent = "";

        timer.textContent = "00:00";

        paused = false;

        pauseBtn.innerHTML =
            '<i class="fa-solid fa-pause"></i> Pause';

        startBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;

        updateSpeechStatus("Waiting...");

        showToast("Ready for new recording");

    });

    // -------------------------
// SUBMIT AUDIO
// -------------------------

submitBtn.addEventListener("click", async () => {
    console.log("SUBMIT AUDIO CLICKED");
    if (processing) return;

    if (!recordedBlob) {
        showToast("Please record or upload audio first.", "error");
        return;
    }

    await submitAudioSource(recordedBlob);

});

    audioUpload.addEventListener("change", async () => {

        const file = audioUpload.files?.[0];

        if (!file) return;

        recordedBlob = file;
        audioPlayer.src = URL.createObjectURL(file);
        audioPlayer.load();
        recordingResult.classList.remove("hidden");
        indicator.innerHTML = "✅ Audio Uploaded";
        duration.textContent = "";
        clearTranscript();
        clearFHIR();
        resetStatus();
        setProcessing(false);

        showToast("Audio ready. Press Submit Audio to process.");

    });
    // -------------------------
    // MOCK FHIR
    // -------------------------

    generateBtn.addEventListener("click", async () => {
        if (processing) return;

        const input = medicalText.value.trim();

        if (!input) {

            showToast("Please enter medical notes.", "error");

            return;

        }

        try {
            setProcessing(true);
            clearFHIR();
            updateSpeechStatus("Completed");
            updateLLMStatus("Extracting...");
            updateFHIRStatus("Generating...");
            showTranscript(input);

            const result = await extractMedicalNote(input);
            await renderMedicalJson(result.medicalJson);
        } catch (err) {
            console.error("Backend Error:", err);
            updateLLMStatus("Failed");
            updateFHIRStatus("Failed");
            showToast(err.message || "Backend Connection Failed", "error");
        } finally {
            setProcessing(false);
        }

    });

    // -------------------------
    // COPY / DOWNLOAD HANDLERS
    // -------------------------
    copyJsonBtn.addEventListener("click", () => {
        copyJsonToClipboard();
    });

    downloadJsonBtn.addEventListener("click", () => {
        downloadJsonFile();
    });

});

// -------------------------
// Service Worker Registration
// -------------------------
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js")
            .then(reg => console.log("Service Worker registered successfully:", reg.scope))
            .catch(err => console.error("Service Worker registration failed:", err));
    });
}
