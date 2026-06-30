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
const pythonPath = path.join(__dirname, "venv", "bin", "python");

app.use(cors());
app.use(express.json());

// ----------------------
// Create uploads folder
// ----------------------
if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
}

// ----------------------
// Multer Storage
// ----------------------
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
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
        message: "MedicAssist Backend Running 🚑",
    });
});

// ----------------------
// Speech-to-Text Route
// ----------------------
app.post("/api/transcribe", upload.single("audio"), (req, res) => {

    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: "No audio uploaded"
        });
    }

    console.log("\n========== AUDIO RECEIVED ==========");
    console.log(req.file.path);

    execFile(pythonPath, ["transcribe.py", req.file.path], { cwd: __dirname }, (err, stdout, stderr) => {

        if (err) {

            console.error(err);

            return res.status(500).json({
                success: false,
                message: err.message
            });

        }

        const transcript = stdout.trim();

        console.log("\n========== TRANSCRIPT ==========");
        console.log(transcript);

        execFile(pythonPath, ["llm.py", transcript], { cwd: __dirname }, (llmErr, llmOut, llmStdErr) => {

            if (llmErr) {

                console.error(llmErr);

                return res.status(500).json({
                    success: false,
                    message: llmErr.message
                });

            }

            console.log("\n========== MEDICAL JSON ==========");
            console.log(llmOut);

            let medicalJson;

            try {

                medicalJson = JSON.parse(llmOut);

            } catch {

                medicalJson = {
                    rawNote: transcript
                };

            }

            res.json({

                success: true,

                transcript,

                medicalJson

            });

        });

    });

});

// ----------------------
// Clinical Extraction Route (for manual text notes)
// ----------------------
app.post("/api/extract", (req, res) => {

    const { notes } = req.body;

    if (!notes) {
        return res.status(400).json({
            success: false,
            message: "No notes provided"
        });
    }

    console.log("\n========== MANUAL NOTES RECEIVED ==========");
    console.log(notes);

    execFile(pythonPath, ["llm.py", notes], { cwd: __dirname }, (llmErr, llmOut, llmStdErr) => {

        if (llmErr) {

            console.error(llmErr);

            return res.status(500).json({
                success: false,
                message: llmErr.message
            });

        }

        console.log("\n========== MEDICAL JSON ==========");
        console.log(llmOut);

        let medicalJson;

        try {

            medicalJson = JSON.parse(llmOut);

        } catch {

            medicalJson = {
                rawNote: notes
            };

        }

        res.json({
            success: true,
            medicalJson
        });

    });

});
      
// ----------------------
// Start Server
// ----------------------
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});