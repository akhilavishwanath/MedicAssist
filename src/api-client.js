const DEFAULT_API_BASE_URL = "http://localhost:3001";

export const API_BASE_URL = (
    window.MEDICASSIST_API_BASE_URL ||
    new URLSearchParams(window.location.search).get("api") ||
    DEFAULT_API_BASE_URL
).replace(/\/$/, "");

async function parseJsonResponse(response) {
    let data = null;

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok || data.success === false) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
    }

    return data;
}

export async function transcribeAudio(audioBlobOrFile) {
    if (!audioBlobOrFile || audioBlobOrFile.size === 0) {
        throw new Error("No audio selected");
    }

    const fileName = audioBlobOrFile.name || "recording.webm";
    const formData = new FormData();
    formData.append("audio", audioBlobOrFile, fileName);

    const response = await fetch(`${API_BASE_URL}/api/transcribe`, {
        method: "POST",
        body: formData
    });

    return parseJsonResponse(response);
}

export async function extractMedicalNote(notes) {
    if (!notes || !notes.trim()) {
        throw new Error("No notes provided");
    }

    const response = await fetch(`${API_BASE_URL}/api/extract`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ notes: notes.trim() })
    });

    return parseJsonResponse(response);
}
