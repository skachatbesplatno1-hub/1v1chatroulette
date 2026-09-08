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

/* ICE-кандидаты, которые пришли
   до установки remoteDescription */
let pendingCandidates = [];


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

        console.error("Ошибка камеры/микрофона:", error);

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

            localStream.removeTrack(
                oldVideoTrack
            );

        }


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

    if (peerConnection) {

        return peerConnection;

    }


    console.log("Создаём WebRTC соединение");


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


    /* Получаем видео и звук собеседника */

    peerConnection.ontrack = event => {

        console.log(
            "Получен remote track:",
            event.track.kind
        );


        const stream =
            event.streams[0];

        if (stream) {

            remoteVideo.srcObject =
                stream;

            waitingText.style.display =
                "none";

            statusText.textContent =
                "Соединение установлено";

        }

    };


    /* ICE */

    peerConnection.onicecandidate =
        event => {

            if (!event.candidate) {

                console.log(
                    "ICE-сбор завершён"
                );

                return;

            }


            console.log(
                "Отправляем ICE-кандидат"
            );


            socket.emit("signal", {

                type: "candidate",

                candidate:
                    event.candidate

            });

        };


    /* Состояние соединения */

    peerConnection.onconnectionstatechange =
        () => {

            if (!peerConnection) return;


            console.log(
                "WebRTC connectionState:",
                peerConnection.connectionState
            );


            if (
                peerConnection.connectionState ===
                "connected"
            ) {

                statusText.textContent =
                    "Соединение установлено";

            }


            if (
                peerConnection.connectionState ===
                "failed"
            ) {

                statusText.textContent =
                    "Не удалось установить соединение";

                console.error(
                    "WebRTC connection FAILED"
                );

            }


            if (
                peerConnection.connectionState ===
                "disconnected"
            ) {

                console.warn(
                    "WebRTC disconnected"
                );

            }

        };


    /* ICE-состояние */

    peerConnection.oniceconnectionstatechange =
        () => {

            if (!peerConnection) return;


            console.log(
                "WebRTC ICE state:",
                peerConnection.iceConnectionState
            );

        };


    return peerConnection;

}


/* =========================
   ОТЛОЖЕННЫЕ ICE
========================= */

async function flushPendingCandidates() {

    if (!peerConnection) return;

    if (!peerConnection.remoteDescription) return;


    console.log(
        "Добавляем отложенные ICE:",
        pendingCandidates.length
    );


    for (
        const candidate of pendingCandidates
    ) {

        try {

            await peerConnection.addIceCandidate(
                candidate
            );

        } catch (error) {

            console.error(
                "Ошибка отложенного ICE:",
                error
            );

        }

    }


    pendingCandidates = [];

}


/* =========================
   OFFER
========================= */

async function createOffer() {

    if (!peerConnection) {

        console.error(
            "Нельзя создать offer: peerConnection отсутствует"
        );

        return;

    }


    try {

        console.log(
            "Создаём OFFER"
        );


        const offer =
            await peerConnection.createOffer();


        await peerConnection.setLocalDescription(
            offer
        );


        console.log(
            "Отправляем OFFER"
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

    console.log(
        "Получен SIGNAL:",
        data.type
    );


    if (!peerConnection) {

        createPeerConnection();

    }


    try {

        /* =====================
           OFFER
        ===================== */

        if (data.type === "offer") {

            console.log(
                "Получен OFFER"
            );


            await peerConnection.setRemoteDescription(
                data.offer
            );


            await flushPendingCandidates();


            const answer =
                await peerConnection.createAnswer();


            await peerConnection.setLocalDescription(
                answer
            );


            console.log(
                "Отправляем ANSWER"
            );


            socket.emit("signal", {

                type: "answer",

                answer

            });

        }


        /* =====================
           ANSWER
        ===================== */

        else if (data.type === "answer") {

            console.log(
                "Получен ANSWER"
            );


            await peerConnection.setRemoteDescription(
                data.answer
            );


            await flushPendingCandidates();

        }


        /* =====================
           ICE
        ===================== */

        else if (data.type === "candidate") {

            if (!data.candidate) return;


            if (
                peerConnection.remoteDescription
            ) {

                console.log(
                    "Добавляем ICE-кандидат сразу"
                );


                await peerConnection.addIceCandidate(
                    data.candidate
                );

            } else {

                console.log(
                    "ICE пришёл слишком рано — сохраняем"
                );


                pendingCandidates.push(
                    data.candidate
                );

            }

        }

    } catch (error) {

        console.error(
            "Ошибка WebRTC сигнализации:",
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


        if (searching) {

            return;

        }


        searching = true;

        currentPartner = null;

        pendingCandidates = [];


        closePeerConnection();


        remoteVideo.srcObject =
            null;


        waitingText.style.display =
            "flex";


        statusText.textContent =
            "Ищем собеседника...";


        startButton.disabled =
            true;


        console.log(
            "Отправляем join-search"
        );


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

    console.log(
        "СОБЕСЕДНИК НАЙДЕН:",
        data
    );


    searching = false;

    currentPartner =
        data.partnerId;


    statusText.textContent =
        "Собеседник найден";


    waitingText.style.display =
        "flex";


    startButton.disabled =
        true;


    pendingCandidates = [];


    closePeerConnection();

    createPeerConnection();


    if (data.initiator) {

        console.log(
            "Я INITIATOR — создаём OFFER"
        );


        await createOffer();

    } else {

        console.log(
            "Я НЕ initiator — жду OFFER"
        );

    }

});


/* =========================
   ПОИСК
========================= */

socket.on("searching", () => {

    searching = true;

    statusText.textContent =
        "Ищем собеседника...";


    console.log(
        "Сервер сказал: продолжаем поиск"
    );

});


/* =========================
   СОБЕСЕДНИК ОТКЛЮЧИЛСЯ
========================= */

socket.on(
    "partner-disconnected",
    () => {

        console.log(
            "Собеседник отключился"
        );


        currentPartner = null;

        searching = true;

        pendingCandidates = [];


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

        pendingCandidates = [];


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

        console.log(
            "Закрываем старое WebRTC соединение"
        );


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
   SOCKET.IO
========================= */

socket.on("connect", () => {

    console.log(
        "Socket.IO подключён:",
        socket.id
    );

});


socket.on("disconnect", reason => {

    console.warn(
        "Socket.IO отключён:",
        reason
    );

});


socket.on("connect_error", error => {

    console.error(
        "Socket.IO ошибка подключения:",
        error
    );

});


/* =========================
   ЗАПУСК
========================= */

console.log(
    "1v1ChatRoulette загружен"
);
