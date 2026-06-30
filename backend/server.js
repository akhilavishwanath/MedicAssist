import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import path from "path";
import { exec } from "child_process";

dotenv.config();

const app = express();

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

    const whisperCmd =
        `/Users/akhilavishwanath/Desktop/field-medic-assistant/backend/venv/bin/python transcribe.py "${req.file.path}"`;

    exec(whisperCmd, { cwd: process.cwd() }, (err, stdout, stderr) => {

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

        const llmCmd =
            `/Users/akhilavishwanath/Desktop/field-medic-assistant/backend/venv/bin/python llm.py "${transcript.replace(/"/g, '\\"')}"`;

        exec(llmCmd, { cwd: process.cwd() }, (llmErr, llmOut, llmStdErr) => {

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
// Start Server
// ----------------------
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});