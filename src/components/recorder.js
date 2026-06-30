let mediaRecorder = null;
let audioChunks = [];
let stream = null;

let timer = null;
let seconds = 0;

export async function startRecording() {

    try {

        stream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

      const options = {};
     const supportedTypes = [
    "audio/mp4",
    "audio/webm",
    ""
];

let selectedType = "";

for (const type of supportedTypes) {

    if (type === "" || MediaRecorder.isTypeSupported(type)) {

        selectedType = type;

        break;

    }

}

mediaRecorder = selectedType
    ? new MediaRecorder(stream, { mimeType: selectedType })
    : new MediaRecorder(stream);

console.log("Recorder MIME:", mediaRecorder.mimeType);

mediaRecorder = new MediaRecorder(stream, options);
console.log("Recorder MIME Type:", mediaRecorder.mimeType);

        audioChunks = [];
        seconds = 0;

        updateTimer();

        timer = setInterval(() => {
            seconds++;
            updateTimer();
        }, 1000);

        mediaRecorder.ondataavailable = (event) => {

    console.log("Chunk:", event.data.type, event.data.size);

    if (event.data.size > 0) {

        audioChunks.push(event.data);

    }

};

        mediaRecorder.start();

        return true;

    } catch (err) {

        console.error(err);

        alert("Unable to access microphone.");

        return false;

    }

}

export function pauseRecording() {

    if (!mediaRecorder) return;

    if (mediaRecorder.state === "recording") {

        mediaRecorder.pause();

        clearInterval(timer);

    }

}

export function resumeRecording() {

    if (!mediaRecorder) return;

    if (mediaRecorder.state === "paused") {

        mediaRecorder.resume();

        timer = setInterval(() => {

            seconds++;

            updateTimer();

        }, 1000);

    }

}

export function stopRecording() {

    return new Promise((resolve) => {

        if (!mediaRecorder) {

            resolve(null);

            return;

        }

        clearInterval(timer);

        mediaRecorder.onstop = () => {

            const blob = new Blob(audioChunks, {
    type: mediaRecorder.mimeType || audioChunks[0]?.type || "application/octet-stream"
});

console.log("Recorder MIME:", mediaRecorder.mimeType);
console.log("Blob MIME:", blob.type);
console.log("Blob Size:", blob.size);

const url = URL.createObjectURL(blob);
            if (stream) {

                stream.getTracks().forEach(track => track.stop());

            }

            resolve({
                blob,
                url,
                duration: seconds
            });

        };
        mediaRecorder.requestData();
        mediaRecorder.stop();

    });

}

function updateTimer() {

    const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
    const secs = String(seconds % 60).padStart(2, "0");

    const timerElement = document.getElementById("recordingTime");

    if (timerElement) {

        timerElement.textContent = `${mins}:${secs}`;

    }

}