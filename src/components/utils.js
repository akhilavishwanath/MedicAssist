// ===============================
// Toast Notification
// ===============================

export function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");

    const toast = document.createElement("div");

    toast.className = "toast";

    toast.style.background = type === "success" ? "#2e7d32" : "#c62828";
    toast.style.color = "white";
    toast.style.padding = "12px 18px";
    toast.style.borderRadius = "8px";
    toast.style.boxShadow = "0 5px 15px rgba(0,0,0,.2)";

    toast.innerText = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// ===============================
// Format Date
// ===============================

export function getCurrentTime() {
    return new Date().toLocaleString();
}

// ===============================
// Generate Record ID
// ===============================

export function generateRecordId() {
    return "MED-" + Date.now();
}