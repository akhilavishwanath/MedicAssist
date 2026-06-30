let mediaRecorder;
let audioChunks = [];

let timer = null;
let seconds = 0;

export async function startRecording() {

    try {

        const stream = await navigator.mediaDevices.getUserMedia({
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
            audioChunks.push(event.data);
        };

        mediaRecorder.start();

        return true;

    } catch (error) {

        console.error(error);

        alert("Microphone permission denied.");

        return false;
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

            const audioBlob = new Blob(audioChunks, {

                type: "audio/webm"

            });

            resolve({
                blob: audioBlob,
                duration: seconds
            });

        };
        mediaRecorder.stop();

    });

}

function updateTimer() {

    const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");

    const secs = String(seconds % 60).padStart(2, "0");

    document.getElementById("recordingTimer").textContent =
        `${minutes}:${secs}`;

}