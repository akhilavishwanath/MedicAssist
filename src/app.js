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

    const audioPlayer = document.getElementById("audioPreview");
    const recordingResult = document.getElementById("recordingResult");
    const indicator = document.getElementById("recordingIndicator");
    const duration = document.getElementById("recordDuration");

    const generateBtn = document.getElementById("generateBtn");
    const medicalText = document.getElementById("medicalText");

    let paused = false;
    let recordedBlob = null;

    // -------------------------
    // Initial State
    // -------------------------

    resetStatus();
    clearTranscript();
    clearFHIR();

    // -------------------------
    // Start Recording
    // -------------------------

    startBtn.addEventListener("click", async () => {

        const started = await startRecording();

        if (!started) return;

        paused = false;

        indicator.innerHTML = "🔴 Recording...";

        recordingResult.classList.add("hidden");

        updateSpeechStatus("Recording");

        pauseBtn.innerHTML =
            '<i class="fa-solid fa-pause"></i> Pause';

        showToast("Recording Started");

    });

    // -------------------------
    // Pause / Resume
    // -------------------------

    pauseBtn.addEventListener("click", () => {

        if (!paused) {

            pauseRecording();

            paused = true;

            indicator.innerHTML = "⏸ Recording Paused";

            pauseBtn.innerHTML =
                '<i class="fa-solid fa-play"></i> Resume';

            showToast("Recording Paused");

        } else {

            resumeRecording();

            paused = false;

            indicator.innerHTML = "🔴 Recording...";

            pauseBtn.innerHTML =
                '<i class="fa-solid fa-pause"></i> Pause';

            showToast("Recording Resumed");

        }

    });

    // -------------------------
    // Stop Recording
    // -------------------------

    stopBtn.addEventListener("click", async () => {

        const result = await stopRecording();

        if (!result) return;

        recordedBlob = result.blob;

        audioPlayer.src = result.url;

        audioPlayer.load();

        indicator.innerHTML = "✅ Recording Completed";

        duration.innerHTML = `(${result.duration} sec)`;

        recordingResult.classList.remove("hidden");

        updateSpeechStatus("Completed");

        showToast("Recording Saved");

    });

    // -------------------------
    // Record Again
    // -------------------------

    againBtn.addEventListener("click", () => {

        recordingResult.classList.add("hidden");

        audioPlayer.src = "";

        indicator.innerHTML = "⚪ Ready to Record";

        document.getElementById("recordingTimer").textContent = "00:00";

    });

    // -------------------------
    // Generate Mock FHIR
    // -------------------------

    generateBtn.addEventListener("click", () => {

        const input = medicalText.value.trim();

        if (!input) {

            showToast("Please enter medical notes first.", "error");

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