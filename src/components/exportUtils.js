import { showToast } from "./utils.js";

export function copyJsonToClipboard() {
    const jsonOutput = document.getElementById("jsonOutput").textContent;
    if (!jsonOutput || jsonOutput.includes("Waiting for") || jsonOutput.trim() === "") {
        showToast("No FHIR JSON to copy", "error");
        return;
    }
    
    navigator.clipboard.writeText(jsonOutput)
        .then(() => showToast("Copied to clipboard!"))
        .catch(err => {
            console.error("Clipboard copy failed:", err);
            showToast("Failed to copy to clipboard", "error");
        });
}

export function downloadJsonFile() {
    const jsonOutput = document.getElementById("jsonOutput").textContent;
    if (!jsonOutput || jsonOutput.includes("Waiting for") || jsonOutput.trim() === "") {
        showToast("No FHIR JSON to download", "error");
        return;
    }

    try {
        const bundle = JSON.parse(jsonOutput);
        const triage = bundle._meta?.triageLevel || "unknown";
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `fhir-bundle-${triage}-${timestamp}.json`;

        const blob = new Blob([jsonOutput], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast("Download started!");
    } catch (err) {
        console.error("Download failed:", err);
        showToast("Failed to download JSON", "error");
    }
}
