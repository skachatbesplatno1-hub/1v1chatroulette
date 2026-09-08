const socket = io("https://onev1chatroulette.onrender.com");

/* =========================
   ЭЛЕМЕНТЫ
========================= */

const ageModal = document.getElementById("ageModal");
const termsCheck = document.getElementById("termsCheck");
const enterButton = document.getElementById("enterButton");
const app = document.getElementById("app");

const statusText = document.getElementById("status");

const myGender = document.getElementById("myGender");
const searchGender = document.getElementById("searchGender");

const startButton = document.getElementById("startButton");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const localCameraOff = document.getElementById("localCameraOff");
const waitingText = document.getElementById("waitingText");

const cameraButton = document.getElementById("cameraButton");
const switchCameraButton = document.getElementById("switchCameraButton");
const micButton = document.getElementById("micButton");

const nextButton = document.getElementById("nextButton");
const reportButton = document.getElementById("reportButton");


/* =========================
   ПЕРЕМЕННЫЕ
========================= */

let localStream = null;
let peerConnection = null;

let currentPartner = null;

let searching = false;

let cameraEnabled = true;
let micEnabled = true;

let currentCameraIndex = 0;
let cameras = [];


/* =========================
   18+
========================= */

termsCheck.addEventListener("change", () => {

    enterButton.disabled = !termsCheck.checked;

});


enterButton.addEventListener("click", () => {

    if (!termsCheck.checked) return;

    ageModal.classList.add("hidden");
    app.classList.remove("hidden");

    statusText.textContent = "Готов к поиску";

});


/* =========================
   КАМЕРА И МИКРОФОН
========================= */

async function startCamera() {

    try {

        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        localVideo.srcObject = localStream;

        cameraEnabled = true;
        micEnabled = true;

        updateCameraButton();
        updateMicButton();

        await updateCameraList();

        console.log("Камера и микрофон запущены");

    } catch (error) {

        console.error(error);

        alert(
            "Не удалось получить доступ к камере или микрофону.\n\n" +
            "Разреши браузеру использовать камеру и микрофон."
        );

    }

}


/* =========================
   СПИСОК КАМЕР
========================= */

async function updateCameraList() {

    try {

        const devices =
            await navigator.mediaDevices.enumerateDevices();

        cameras = devices.filter(
            device => device.kind === "videoinput"
        );

        console.log("Камеры:", cameras);

    } catch (error) {

        console.error(
            "Не удалось получить список камер:",
            error
        );

    }

}


/* =========================
   СМЕНА КАМЕРЫ
========================= */

async function switchCamera() {

    if (!localStream) {

        alert("Сначала включи камеру.");

        return;

    }

    await updateCameraList();

    if (cameras.length < 2) {

        alert("На этом устройстве доступна только одна камера.");

        return;

    }

    currentCameraIndex++;

    if (currentCameraIndex >= cameras.length) {
        currentCameraIndex = 0;
    }

    const camera = cameras[currentCameraIndex];

    try {

        const newStream =
            await navigator.mediaDevices.getUserMedia({

                video: {
                    deviceId: {
                        exact: camera.deviceId
                    }
                },

                audio: false

            });


        const newVideoTrack =
            newStream.getVideoTracks()[0];


        const oldVideoTrack =
            localStream.getVideoTracks()[0];


        /*
         * Меняем видеотрек внутри
         * существующего WebRTC соединения.
         */

        if (peerConnection) {

            const sender =
                peerConnection
                    .getSenders()
                    .find(
                        s =>
                            s.track &&
                            s.track.kind === "video"
                    );

            if (sender) {

                await sender.replaceTrack(
                    newVideoTrack
                );

            }

        }


        if (oldVideoTrack) {
            oldVideoTrack.stop();
        }


        localStream.removeTrack(
            oldVideoTrack
        );

        localStream.addTrack(
            newVideoTrack
        );


        localVideo.srcObject =
            localStream;


        cameraEnabled = true;

        updateCameraButton();


        console.log(
            "Камера переключена:",
            camera.label
        );

    } catch (error) {

        console.error(
            "Ошибка смены камеры:",
            error
        );

        alert(
            "Не удалось переключить камеру."
        );

    }

}


/* =========================
   КАМЕРА ON/OFF
========================= */

function toggleCamera() {

    if (!localStream) return;

    const track =
        localStream.getVideoTracks()[0];

    if (!track) return;

    cameraEnabled = !cameraEnabled;

    track.enabled = cameraEnabled;

    updateCameraButton();

}


function updateCameraButton() {

    if (cameraEnabled) {

        cameraButton.textContent =
            "📹 Камера";

        localCameraOff.classList.remove(
            "active"
        );

    } else {

        cameraButton.textContent =
            "📷 Камера выключена";

        localCameraOff.classList.add(
            "active"
        );

    }

}


/* =========================
   МИКРОФОН
========================= */

function toggleMicrophone() {

    if (!localStream) return;

    const track =
        localStream.getAudioTracks()[0];

    if (!track) return;

    micEnabled = !micEnabled;

    track.enabled = micEnabled;

    updateMicButton();

}


function updateMicButton() {

    if (micEnabled) {

        micButton.textContent =
            "🎤 Микрофон";

    } else {

        micButton.textContent =
            "🔇 Микрофон выключен";

    }

}


/* =========================
   WEBRTC
========================= */

function createPeerConnection() {

    peerConnection =
        new RTCPeerConnection({

            iceServers: [

                {
                    urls:
                        "stun:stun.l.google.com:19302"
                }

            ]

        });


    /* Отправляем свои треки */

    if (localStream) {

        localStream
            .getTracks()
            .forEach(track => {

                peerConnection.addTrack(
                    track,
                    localStream
                );

            });

    }


    /* Получаем видео собеседника */

    peerConnection.ontrack = event => {

        const stream =
            event.streams[0];

        if (stream) {

            remoteVideo.srcObject =
                stream;

            waitingText.style.display =
                "none";

        }

    };


    /* ICE */

    peerConnection.onicecandidate =
        event => {

            if (!event.candidate) return;

            socket.emit("signal", {

                type: "candidate",

                candidate:
                    event.candidate

            });

        };


    peerConnection.onconnectionstatechange =
        () => {

            console.log(
                "WebRTC:",
                peerConnection.connectionState
            );

        };

}


/* =========================
   ПЕРЕСОЕДИНЕНИЕ
========================= */

async function createOffer() {

    if (!peerConnection) return;

    try {

        const offer =
            await peerConnection.createOffer();

        await peerConnection.setLocalDescription(
            offer
        );

        socket.emit("signal", {

            type: "offer",

            offer

        });

    } catch (error) {

        console.error(
            "Ошибка создания offer:",
            error
        );

    }

}


/* =========================
   СИГНАЛИЗАЦИЯ
========================= */

socket.on("signal", async data => {

    if (!peerConnection) {

        createPeerConnection();

    }


    try {

        if (data.type === "offer") {

            await peerConnection.setRemoteDescription(
                data.offer
            );


            const answer =
                await peerConnection.createAnswer();


            await peerConnection.setLocalDescription(
                answer
            );


            socket.emit("signal", {

                type: "answer",

                answer

            });

        }


        else if (data.type === "answer") {

            await peerConnection.setRemoteDescription(
                data.answer
            );

        }


        else if (data.type === "candidate") {

            if (
                data.candidate &&
                peerConnection.remoteDescription
            ) {

                await peerConnection.addIceCandidate(
                    data.candidate
                );

            }

        }

    } catch (error) {

        console.error(
            "Ошибка WebRTC:",
            error
        );

    }

});


/* =========================
   НАЙТИ СОБЕСЕДНИКА
========================= */

startButton.addEventListener(
    "click",
    async () => {

        if (!localStream) {

            await startCamera();

            if (!localStream) {
                return;
            }

        }


        if (searching) return;


        searching = true;

        currentPartner = null;


        closePeerConnection();


        remoteVideo.srcObject = null;

        waitingText.style.display =
            "flex";


        statusText.textContent =
            "Ищем собеседника...";


        startButton.disabled =
            true;


        socket.emit("join-search", {

            gender:
                myGender.value,

            searchGender:
                searchGender.value

        });

    }
);


/* =========================
   MATCH
========================= */

socket.on("matched", async data => {

    searching = false;

    currentPartner =
        data.partnerId;


    statusText.textContent =
        "Собеседник найден";


    waitingText.style.display =
        "none";


    startButton.disabled =
        true;


    createPeerConnection();


    if (data.initiator) {

        await createOffer();

    }

});


/* =========================
   ПОИСК
========================= */

socket.on("searching", () => {

    searching = true;

    statusText.textContent =
        "Ищем собеседника...";

});


/* =========================
   СОБЕСЕДНИК ОТКЛЮЧИЛСЯ
========================= */

socket.on(
    "partner-disconnected",
    () => {

        currentPartner = null;

        searching = true;


        closePeerConnection();


        remoteVideo.srcObject =
            null;


        waitingText.style.display =
            "flex";


        statusText.textContent =
            "Собеседник отключился. Ищем нового...";


        setTimeout(() => {

            if (searching) {

                socket.emit(
                    "join-search",
                    {

                        gender:
                            myGender.value,

                        searchGender:
                            searchGender.value

                    }
                );

            }

        }, 500);

    }
);


/* =========================
   NEXT
========================= */

nextButton.addEventListener(
    "click",
    () => {

        if (!localStream) {

            alert(
                "Сначала найди собеседника."
            );

            return;

        }


        searching = true;

        currentPartner = null;


        closePeerConnection();


        remoteVideo.srcObject =
            null;


        waitingText.style.display =
            "flex";


        statusText.textContent =
            "Ищем нового собеседника...";


        socket.emit("next");

    }
);


/* =========================
   ЖАЛОБА
========================= */

reportButton.addEventListener(
    "click",
    () => {

        if (!currentPartner) {

            alert(
                "Сейчас нет собеседника."
            );

            return;

        }


        const confirmed =
            confirm(
                "Отправить жалобу на этого пользователя?"
            );


        if (!confirmed) return;


        socket.emit(
            "report-user"
        );


        statusText.textContent =
            "Жалоба отправлена.";

    }
);


socket.on(
    "report-confirmed",
    message => {

        alert(message);

    }
);


/* =========================
   ЗАКРЫТИЕ WEBRTC
========================= */

function closePeerConnection() {

    if (peerConnection) {

        peerConnection.close();

        peerConnection = null;

    }

}


/* =========================
   КНОПКИ
========================= */

cameraButton.addEventListener(
    "click",
    toggleCamera
);

switchCameraButton.addEventListener(
    "click",
    switchCamera
);

micButton.addEventListener(
    "click",
    toggleMicrophone
);


/* =========================
   ЗАПУСК
========================= */

console.log(
    "1v1ChatRoulette загружен"
);