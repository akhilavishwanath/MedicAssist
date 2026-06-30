let mediaRecorder = null;
let audioChunks = [];
let stream = null;

let timer = null;
let seconds = 0;

// --------------------------
// Start Recording
// --------------------------

export async function startRecording() {

    try {

        stream = await navigator.mediaDevices.getUserMedia({
            audio: true
        });

        mediaRecorder = new MediaRecorder(stream);

        audioChunks = [];
        seconds = 0;

        updateTimer();

        timer = setInterval(() => {

            seconds++;

            updateTimer();

        }, 1000);

        mediaRecorder.ondataavailable = (event) => {

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

// --------------------------
// Pause
// --------------------------

export function pauseRecording() {

    if (!mediaRecorder) return;

    if (mediaRecorder.state === "recording") {

        mediaRecorder.pause();

        clearInterval(timer);

    }

}

// --------------------------
// Resume
// --------------------------

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

// --------------------------
// Stop
// --------------------------

export function stopRecording() {

    return new Promise((resolve) => {

        if (!mediaRecorder) {

            resolve(null);

            return;

        }

        clearInterval(timer);

        mediaRecorder.onstop = () => {

            const blob = new Blob(audioChunks, {
                type: mediaRecorder.mimeType
            });

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

        mediaRecorder.stop();

    });

}

// --------------------------
// Timer
// --------------------------

function updateTimer() {

    const mins = String(Math.floor(seconds / 60)).padStart(2, "0");

    const secs = String(seconds % 60).padStart(2, "0");

    const timerElement = document.getElementById("recordingTimer");

    if (timerElement) {

        timerElement.textContent = `${mins}:${secs}`;

    }

}