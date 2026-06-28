export function showFHIR(bundle) {
    document.getElementById("jsonOutput").textContent =
        JSON.stringify(bundle, null, 2);
}

export function clearFHIR() {
    document.getElementById("jsonOutput").textContent =
        "Waiting for medical input...";
}