console.log("🚑 MedicAssist app.js loaded");
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

    const generateBtn = document.getElementById("generateBtn");
    const medicalText = document.getElementById("medicalText");

    // Initial State
    resetStatus();
    clearTranscript();
    clearFHIR();

    generateBtn.addEventListener("click", () => {

        const input = medicalText.value.trim();

        if (!input) {
            showToast("Please enter medical notes first.", "error");
            return;
        }

        // Show loading
        document.getElementById("loading-overlay").classList.remove("hidden");

        updateSpeechStatus("Completed");
        updateLLMStatus("Processing...");
        updateFHIRStatus("Generating...");

        showTranscript(input);

        // Mock FHIR JSON
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
                        resourceType: "Encounter",
                        status: "in-progress"
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

            document.getElementById("loading-overlay").classList.add("hidden");

            showToast("FHIR JSON Generated Successfully!");

        }, 1200);

    });

});