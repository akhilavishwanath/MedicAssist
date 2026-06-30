import { listRecords, deleteRecord } from "../db.js";
import { summariseBundle, triageColour } from "../fhir-builder.js";
import { showFHIR } from "./fhirViewer.js";
import { showToast } from "./utils.js";

export async function renderRecordsList() {
    const container = document.getElementById("recordsList");
    if (!container) return;

    try {
        const records = await listRecords();
        
        if (records.length === 0) {
            container.innerHTML = "<p>No records saved.</p>";
            return;
        }

        container.innerHTML = "";
        
        records.forEach(rec => {
            const bundle = rec.bundle;
            const summary = summariseBundle(bundle);
            const color = triageColour(bundle);
            
            const card = document.createElement("div");
            card.className = "record-item";
            card.style.borderLeft = `5px solid ${getTriageColorHex(color)}`;
            card.style.display = "flex";
            card.style.justifyContent = "space-between";
            card.style.alignItems = "center";
            card.style.padding = "12px";
            card.style.margin = "10px 0";
            card.style.borderRadius = "8px";
            card.style.background = "#ffffff";
            card.style.boxShadow = "0 2px 5px rgba(0,0,0,0.05)";
            card.style.cursor = "pointer";
            card.style.transition = "transform 0.2s, box-shadow 0.2s";

            // Hover micro-animations
            card.addEventListener("mouseenter", () => {
                card.style.transform = "translateY(-1px)";
                card.style.boxShadow = "0 4px 8px rgba(0,0,0,0.08)";
            });
            card.addEventListener("mouseleave", () => {
                card.style.transform = "none";
                card.style.boxShadow = "0 2px 5px rgba(0,0,0,0.05)";
            });

            // Click card to load FHIR JSON
            card.addEventListener("click", (e) => {
                if (e.target.closest(".btn-delete")) return;
                showFHIR(bundle);
                showToast("Loaded record details");
            });

            const content = document.createElement("div");
            content.style.flex = "1";
            content.style.fontSize = "13px";
            content.style.overflow = "hidden";

            const headerLine = document.createElement("div");
            headerLine.style.display = "flex";
            headerLine.style.justifyContent = "space-between";
            headerLine.style.alignItems = "center";
            headerLine.style.fontWeight = "bold";
            headerLine.style.marginBottom = "6px";

            const triageBadge = document.createElement("span");
            triageBadge.className = `badge-triage triage-${color}`;
            triageBadge.textContent = summary.triageDisplay;
            triageBadge.style.fontSize = "10px";
            triageBadge.style.padding = "3px 8px";
            triageBadge.style.borderRadius = "4px";
            triageBadge.style.color = "white";
            triageBadge.style.fontWeight = "600";
            triageBadge.style.textTransform = "uppercase";
            triageBadge.style.background = getTriageColorHex(color);

            const timeSpan = document.createElement("span");
            timeSpan.style.color = "#888";
            timeSpan.style.fontSize = "11px";
            timeSpan.textContent = new Date(rec.timestamp).toLocaleString([], { 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
            });

            headerLine.appendChild(triageBadge);
            headerLine.appendChild(timeSpan);

            const detailsLine = document.createElement("div");
            detailsLine.style.fontWeight = "600";
            detailsLine.style.color = "#333";
            detailsLine.style.marginBottom = "4px";
            detailsLine.textContent = summary.patientSummary;

            const conditionLine = document.createElement("div");
            conditionLine.style.color = "#666";
            conditionLine.style.whiteSpace = "nowrap";
            conditionLine.style.overflow = "hidden";
            conditionLine.style.textOverflow = "ellipsis";
            conditionLine.textContent = summary.conditionSummary;

            content.appendChild(headerLine);
            content.appendChild(detailsLine);
            content.appendChild(conditionLine);

            const deleteBtn = document.createElement("button");
            deleteBtn.className = "btn-delete";
            deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
            deleteBtn.style.background = "none";
            deleteBtn.style.border = "none";
            deleteBtn.style.color = "#c62828";
            deleteBtn.style.cursor = "pointer";
            deleteBtn.style.padding = "8px";
            deleteBtn.style.marginLeft = "12px";
            deleteBtn.style.fontSize = "14px";
            deleteBtn.style.display = "flex";
            deleteBtn.style.alignItems = "center";
            deleteBtn.style.justifyContent = "center";
            deleteBtn.style.borderRadius = "50%";
            deleteBtn.style.transition = "background-color 0.2s";

            deleteBtn.addEventListener("mouseenter", () => {
                deleteBtn.style.backgroundColor = "#ffebee";
            });
            deleteBtn.addEventListener("mouseleave", () => {
                deleteBtn.style.backgroundColor = "transparent";
            });

            deleteBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                if (confirm("Are you sure you want to delete this record?")) {
                    await deleteRecord(rec.id);
                    showToast("Record deleted", "error");
                    renderRecordsList();
                }
            });

            card.appendChild(content);
            card.appendChild(deleteBtn);
            container.appendChild(card);
        });
    } catch (err) {
        console.error("Failed to render records list:", err);
        container.innerHTML = "<p class='error'>Error loading records.</p>";
    }
}

function getTriageColorHex(color) {
    const map = {
        red: "#c62828",
        yellow: "#f2a104",
        green: "#2e7d32",
        black: "#212121",
        unknown: "#757575"
    };
    return map[color] || "#757575";
}
