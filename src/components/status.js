export function updateSpeechStatus(status) {
    document.getElementById("speechStatus").textContent = status;
}

export function updateLLMStatus(status) {
    document.getElementById("llmStatus").textContent = status;
}

export function updateFHIRStatus(status) {
    document.getElementById("fhirStatus").textContent = status;
}

export function resetStatus() {
    updateSpeechStatus("Waiting...");
    updateLLMStatus("Waiting...");
    updateFHIRStatus("Waiting...");
}