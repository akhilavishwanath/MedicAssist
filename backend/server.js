import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "uploads");
const defaultPythonPath = process.env.PYTHON_BIN || "python3";
const pythonPath = process.env.PYTHON_BIN || defaultPythonPath;
const speechTimeoutMs = Number(process.env.SPEECH_TIMEOUT_MS || 300000);
const extractionTimeoutMs = Number(process.env.EXTRACTION_TIMEOUT_MS || 60000);
const allowedOrigins = (
    process.env.CORS_ORIGIN ||
    "http://localhost:8080,http://127.0.0.1:8080,https://medic-assist-oqco6urvp-akhila-vishwanath-s-projects.vercel.app"
)
.split(",")
.map(origin => origin.trim())
.filter(Boolean);
app.use(cors({
    origin(origin, callback) {
        if (!origin) {
            return callback(null, true);
        }

        if (
            origin === "http://localhost:8080" ||
            origin === "http://127.0.0.1:8080" ||
            origin.endsWith(".vercel.app")
        ) {
            return callback(null, true);
        }

        callback(new Error(`CORS blocked origin: ${origin}`));
    }
}));
app.use(express.json());

// ----------------------
// Create uploads folder
// ----------------------
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// ----------------------
// Multer Storage
// ----------------------
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        cb(
            null,
            Date.now() + path.extname(file.originalname || ".webm")
        );
    },
});

const upload = multer({ storage });

// ----------------------
// Home Route
// ----------------------
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "MedicAssist Backend Running",
    });
});

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        service: "medicassist-backend",
        python: pythonPath
    });
});

function runPython(script, args, timeoutMs) {
    return new Promise((resolve, reject) => {
        execFile(pythonPath, [script, ...args], {
            cwd: __dirname,
            timeout: timeoutMs,
            killSignal: "SIGTERM"
        }, (err, stdout, stderr) => {
            if (err) {
                err.stderr = stderr;
                reject(err);
                return;
            }

            resolve(stdout.trim());
        });
    });
}

function parseMedicalJson(llmOut, fallbackNote) {
    try {
        return JSON.parse(llmOut);
    } catch {
        return buildFallbackMedicalJson(fallbackNote);
    }
}

function buildFallbackMedicalJson(note) {
    const text = String(note || "");
    const lower = text.toLowerCase();
    const ageMatch = lower.match(/\b(?:age\s*)?(\d{1,3})\s*(?:-?\s*(?:year|yr)s?(?:-?\s*old)?|y\/o|yo|male|female|m|f)\b/);
    const timeMatch = lower.match(/\b([01]?\d|2[0-3])[:.]?([0-5]\d)\b/);
    const bodySiteMatch = lower.match(/\b(?:left|right)?\s*(?:thigh|arm|leg|hand|foot|head|chest|abdomen|shoulder|hip|neck|back)\b/);

    let gender = "unknown";
    if (/\b(male|man|boy|gentleman)\b/.test(lower)) gender = "male";
    if (/\b(female|woman|girl|lady)\b/.test(lower)) gender = "female";

    let triageLevel = "Unknown";
    if (/\b(red|immediate|critical|life[-\s]?threatening)\b/.test(lower)) triageLevel = "Red";
    if (/\b(yellow|delayed|urgent)\b/.test(lower)) triageLevel = "Yellow";
    if (/\b(green|minor|walking wounded)\b/.test(lower)) triageLevel = "Green";
    if (/\b(black|deceased|expectant)\b/.test(lower)) triageLevel = "Black";

    const conditions = [];
    const injuryTerms = [
        "laceration",
        "bleeding",
        "fracture",
        "burn",
        "unconscious",
        "pain",
        "wound",
        "trauma"
    ];
    const matchedInjury = injuryTerms.find(term => lower.includes(term));
    if (matchedInjury) {
        conditions.push({
            description: text,
            bodysite: bodySiteMatch ? bodySiteMatch[0].trim() : null,
            severity: /\b(severe|heavy|critical|red|immediate)\b/.test(lower) ? "severe" : null
        });
    }

    const vitals = [];
    const bp = text.match(/\b(?:bp|blood pressure)\s*[:\-]?\s*(\d{2,3}\/\d{2,3})\b/i);
    if (bp) {
        vitals.push({ type: "blood_pressure", value: bp[1], unit: "mmHg", time: null });
    }

    const hr = text.match(/\b(?:hr|heart rate|pulse)\s*[:\-]?\s*(\d{2,3})\b/i);
    if (hr) {
        vitals.push({ type: "heart_rate", value: hr[1], unit: "bpm", time: null });
    }

    const procedures = [];
    if (/\btourniquet\b/.test(lower)) {
        procedures.push({
            description: "Tourniquet application",
            time: timeMatch ? `${String(timeMatch[1]).padStart(2, "0")}:${timeMatch[2]}` : null,
            status: "completed"
        });
    }
    if (/\biv\b|\bsaline\b/.test(lower)) {
        procedures.push({
            description: "IV access or saline administration",
            time: null,
            status: lower.includes("running") ? "in-progress" : "completed"
        });
    }

    return {
        patient: {
            estimatedAge: ageMatch ? Number(ageMatch[1]) : null,
            gender,
            id: null
        },
        encounter: {
            triageLevel,
            triageTime: timeMatch ? `${String(timeMatch[1]).padStart(2, "0")}:${timeMatch[2]}` : null,
            location: null
        },
        conditions,
        vitals,
        procedures,
        rawNote: text
    };
}

async function extractMedicalJson(note) {
    try {
        const llmOut = await runPython("llm.py", [note], extractionTimeoutMs);
        console.log("\n========== MEDICAL JSON ==========");
        console.log(llmOut);
        return parseMedicalJson(llmOut, note);
    } catch (err) {
        console.error("Clinical extraction failed, using fallback parser:");
        console.error(err.stderr || err.message);
        return buildFallbackMedicalJson(note);
    }
}

// ----------------------
// Speech-to-Text Route
// ----------------------
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {

    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: "No audio uploaded"
        });
    }

    console.log("\n========== AUDIO RECEIVED ==========");
    console.log(req.file.path);

    try {
        const transcript = await runPython("transcribe.py", [req.file.path], speechTimeoutMs);

        console.log("\n========== TRANSCRIPT ==========");
        console.log(transcript);

        const medicalJson = await extractMedicalJson(transcript);

        res.json({
            success: true,
            transcript,
            medicalJson
        });
    } catch (err) {
        console.error(err.stderr || err.message);
        res.status(500).json({
            success: false,
            message: err.stderr?.trim() || err.message
        });
    }

});

// ----------------------
// Clinical Extraction Route (for manual text notes)
// ----------------------
app.post("/api/extract", async (req, res) => {

    const { notes } = req.body;

    if (!notes) {
        return res.status(400).json({
            success: false,
            message: "No notes provided"
        });
    }

    console.log("\n========== MANUAL NOTES RECEIVED ==========");
    console.log(notes);

    const medicalJson = await extractMedicalJson(notes);

    res.json({
        success: true,
        medicalJson
    });

});
      
// ----------------------
// Start Server
// ----------------------
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
});

server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use. Set PORT to another value or stop the existing process.`);
    } else {
        console.error(err);
    }

    process.exit(1);
});
