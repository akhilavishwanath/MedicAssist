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

    resetStatus();
    clearTranscript();
    clearFHIR();

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