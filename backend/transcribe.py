from faster_whisper import WhisperModel
import sys
import os

# Load Whisper model
model = WhisperModel(
    os.getenv("WHISPER_MODEL_SIZE", "tiny.en"),
    device="cpu",
    compute_type="int8",
    cpu_threads=2,
)

# Check if audio file path is provided
if len(sys.argv) < 2:
    print("Usage: python transcribe.py <audio_file>")
    sys.exit(1)

audio_file = sys.argv[1]

# Transcribe audio
segments, info = model.transcribe(audio_file)

# Combine all segments into one transcript
transcript = ""

for segment in segments:
    transcript += segment.text + " "

# Print transcript (Express will read this output later)
print(transcript.strip())
