import {
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording
} from "./components/recorder.js";

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

    const medicalText =
        document.getElementById("medicalText");

    let recordedBlob = null;
    let paused = false;

    // -------------------------
    // Initial UI
    // -------------------------

    resetStatus();
    clearTranscript();
    clearFHIR();

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

    // -------------------------
    // START
    // -------------------------

    startBtn.addEventListener("click", async () => {

        const started = await startRecording();

        if (!started) return;

        paused = false;

        recordedBlob = null;

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

        const result = await stopRecording();

        if (!result) {

            showToast("Recording failed", "error");

            return;

        }

        recordedBlob = result.blob;

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
    // SUBMIT
    // -------------------------

    submitBtn.addEventListener("click", () => {

        if (!recordedBlob) {

            showToast("Please record audio first.", "error");

            return;

        }

        updateSpeechStatus("Audio Submitted");

        showToast("Audio submitted successfully!");

        // TODO:
        // Send recordedBlob to backend

    });

    // -------------------------
    // MOCK FHIR
    // -------------------------

    generateBtn.addEventListener("click", () => {

        const input = medicalText.value.trim();

        if (!input) {

            showToast("Please enter medical notes.", "error");

            return;

        }

        updateSpeechStatus("Completed");

        updateLLMStatus("Processing...");

        updateFHIRStatus("Generating...");

        showTranscript(input);

        const mockFHIR = {

            resourceType: "Bundle",

            type: "collection",

            timestamp: new Date().toISOString(),

            entry: [

                {
                    resource: {
                        resourceType: "Patient",
                        gender: "unknown"
                    }
                },

                {
                    resource: {
                        resourceType: "Condition",
                        code: {
                            text: input
                        }
                    }
                }

            ]

        };

        setTimeout(() => {

            updateLLMStatus("Completed");

            updateFHIRStatus("Completed");

            showFHIR(mockFHIR);

            showToast("FHIR JSON Generated Successfully!");

        }, 1000);

    });

});