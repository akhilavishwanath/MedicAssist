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
    const audioPlayer = document.getElementById("audioPreview");
    const recordingResult = document.getElementById("recordingResult");
    // Hide recording section on page load
    recordingResult.style.display = "none";
    const indicator = document.getElementById("recordingIndicator");
    const duration = document.getElementById("recordDuration");

    const generateBtn = document.getElementById("generateBtn");
    const medicalText = document.getElementById("medicalText");
    // Hide recording controls initially
    audioPlayer.style.display = "none";
    submitBtn.style.display = "none";
    againBtn.style.display = "none";

    let paused = false;
    let recordedBlob = null;
    // -------------------------
    // Initial State
    // -------------------------

    resetStatus();
    clearTranscript();
    clearFHIR();

    // Reset UI
    recordingResult.classList.add("hidden");

    audioPlayer.pause();
    audioPlayer.removeAttribute("src");
    audioPlayer.load();

    indicator.innerHTML = "⚪ Ready to Record";

    duration.textContent = "";

    document.getElementById("recordingTime").textContent = "00:00";

    recordedBlob = null;
    paused = false;

    pauseBtn.innerHTML =
    '<i class="fa-solid fa-pause"></i> Pause';

    // Button states
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    stopBtn.disabled = true;
    // -------------------------
    // Start Recording
    // -------------------------
        startBtn.addEventListener("click", async () => {

    const started = await startRecording();

    if (!started) return;

    paused = false;

    // Reset previous recording
    recordingResult.style.display = "none";

    audioPlayer.pause();
    audioPlayer.removeAttribute("src");
    audioPlayer.load();

    recordedBlob = null;

    duration.textContent = "";

    indicator.innerHTML = "🔴 Recording...";

    document.getElementById("recordingTime").textContent = "00:00";

    updateSpeechStatus("Recording...");

    pauseBtn.innerHTML =
    '<i class="fa-solid fa-pause"></i> Pause';

    startBtn.disabled = true;
    pauseBtn.disabled = false;
    stopBtn.disabled = false;

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

    if (!result) {

        showToast("Recording failed!", "error");

        return;

    }

    console.log("Result:", result);
    console.log("Blob:", result.blob);
    console.log("URL:", result.url);

    recordedBlob = result.blob;

    // Set audio source
    audioPlayer.src = result.url;

    audioPlayer.load();

    // Show recording section
    recordingResult.classList.remove("hidden");

    // Show controls
    audioPlayer.style.display = "block";
    submitBtn.style.display = "inline-flex";
    againBtn.style.display = "inline-flex";

    // Update UI
    indicator.innerHTML = "✅ Recording Completed";

    duration.textContent = `(${result.duration} sec)`;

    document.getElementById("recordingTime").textContent =
        `${String(Math.floor(result.duration / 60)).padStart(2, "0")}:${String(result.duration % 60).padStart(2, "0")}`;

    startBtn.disabled = false;
    pauseBtn.disabled = true;
    stopBtn.disabled = true;

    updateSpeechStatus("Completed");

    showToast(`Recording Saved (${result.duration}s)`);

});

    // -------------------------
    // Record Again
    // -------------------------
        againBtn.addEventListener("click", () => {

    // Hide completed recording section
    recordingResult.classList.add("hidden");

    // Stop audio if playing
    audioPlayer.pause();

    // Clear previous recording
    audioPlayer.removeAttribute("src");
    audioPlayer.load();

    // Hide audio controls
    audioPlayer.style.display = "none";
    submitBtn.style.display = "none";
    againBtn.style.display = "none";

    recordedBlob = null;

    indicator.innerHTML = "⚪ Ready to Record";

    duration.textContent = "";

    document.getElementById("recordingTime").textContent = "00:00";

    pauseBtn.innerHTML =
        '<i class="fa-solid fa-pause"></i> Pause';

    paused = false;

    startBtn.disabled = false;
    pauseBtn.disabled = true;
    stopBtn.disabled = true;

    showToast("Ready for new recording");

});
   

    // -------------------------
// Submit Audio
// -------------------------

submitBtn.addEventListener("click", () => {

    if (!recordedBlob) {

        showToast("Please record audio first.", "error");

        return;

    }

    updateSpeechStatus("Audio Submitted");

    showToast("Audio submitted successfully! Waiting for transcription...");

    // TODO:
    // Send recordedBlob to Whisper.cpp backend here

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