export function showTranscript(text) {
    document.getElementById("transcriptOutput").textContent = text;
}

export function clearTranscript() {
    document.getElementById("transcriptOutput").textContent =
        "Waiting for transcript...";
}