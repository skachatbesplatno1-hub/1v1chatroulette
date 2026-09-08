/* =========================
   SOCKET.IO
========================= */

const socket = io(
    "https://onev1chatroulette.onrender.com",
    {

        transports: [
            "websocket",
            "polling"
        ],

        reconnection: true,

        reconnectionAttempts: Infinity,

        reconnectionDelay: 1000,

        timeout: 20000

    }
);


/* =========================
   ЭЛЕМЕНТЫ
========================= */

const ageModal =
    document.getElementById("ageModal");

const termsCheck =
    document.getElementById("termsCheck");

const enterButton =
    document.getElementById("enterButton");

const app =
    document.getElementById("app");

const statusText =
    document.getElementById("status");

const myGender =
    document.getElementById("myGender");

const searchGender =
    document.getElementById("searchGender");

const startButton =
    document.getElementById("startButton");

const localVideo =
    document.getElementById("localVideo");

const remoteVideo =
    document.getElementById("remoteVideo");

const localCameraOff =
    document.getElementById("localCameraOff");

const waitingText =
    document.getElementById("waitingText");

const cameraButton =
    document.getElementById("cameraButton");

const switchCameraButton =
    document.getElementById("switchCameraButton");

const micButton =
    document.getElementById("micButton");

const nextButton =
    document.getElementById("nextButton");

const reportButton =
    document.getElementById("reportButton");


/* =========================
   ПЕРЕМЕННЫЕ
========================= */

let localStream = null;

let peerConnection = null;

let searching = false;

let currentPartner = null;

let cameraEnabled = true;

let micEnabled = true;

let cameras = [];

let currentCameraIndex = 0;

let pendingCandidates = [];


/* =========================
   SOCKET СОСТОЯНИЕ
========================= */

socket.on("connect", () => {

    console.log(
        "Socket.IO подключён:",
        socket.id
    );


    if (
        !searching &&
        !currentPartner
    ) {

        statusText.textContent =
            "Готов к поиску";

    }

});


socket.on("disconnect", reason => {

    console.log(
        "Socket.IO отключён:",
        reason
    );


    statusText.textContent =
        "Переподключение к серверу...";

});


socket.on("connect_error", error => {

    console.error(
        "Ошибка Socket.IO:",
        error
    );


    statusText.textContent =
        "Ошибка подключения к серверу";

});


/* =========================
   ВХОД
========================= */

termsCheck.addEventListener(
    "change",
    () => {

        enterButton.disabled =
            !termsCheck.checked;

    }
);


enterButton.addEventListener(
    "click",
    () => {

        if (!termsCheck.checked) {

            return;

        }


        ageModal.classList.add(
            "hidden"
        );

        app.classList.remove(
            "hidden"
        );


        statusText.textContent =
            socket.connected
                ? "Готов к поиску"
                : "Подключение к серверу...";

    }
);


/* =========================
   КАМЕРА
========================= */

async function startCamera() {

    try {

        localStream =
            await navigator.mediaDevices.getUserMedia(
                {

                    video: true,

                    audio: true

                }
            );


        localVideo.srcObject =
            localStream;


        cameraEnabled = true;

        micEnabled = true;


        updateCameraButton();

        updateMicButton();


        await updateCameraList();


        console.log(
            "Камера и микрофон запущены"
        );

    } catch (error) {

        console.error(
            "Ошибка камеры:",
            error
        );


        alert(
            "Не удалось получить доступ к камере или микрофону."
        );

    }

}


/* =========================
   СПИСОК КАМЕР
========================= */

async function updateCameraList() {

    try {

        const devices =
            await navigator.mediaDevices
                .enumerateDevices();


        cameras =
            devices.filter(
                device =>
                    device.kind ===
                    "videoinput"
            );


        console.log(
            "Камеры:",
            cameras
        );

    } catch (error) {

        console.error(
            "Ошибка списка камер:",
            error
        );

    }

}


/* =========================
   СМЕНА КАМЕРЫ
========================= */

async function switchCamera() {

    if (!localStream) {

        alert(
            "Сначала включи камеру."
        );

        return;

    }


    await updateCameraList();


    if (cameras.length < 2) {

        alert(
            "На устройстве доступна только одна камера."
        );

        return;

    }


    currentCameraIndex++;


    if (
        currentCameraIndex >=
        cameras.length
    ) {

        currentCameraIndex = 0;

    }


    const camera =
        cameras[currentCameraIndex];


    try {

        const newStream =
            await navigator.mediaDevices
                .getUserMedia(
                    {

                        video: {

                            deviceId: {

                                exact:
                                    camera.deviceId

                            }

                        },

                        audio: false

                    }
                );


        const newVideoTrack =
            newStream
                .getVideoTracks()[0];


        const oldVideoTrack =
            localStream
                .getVideoTracks()[0];


        if (peerConnection) {

            const sender =
                peerConnection
                    .getSenders()
                    .find(
                        sender =>
                            sender.track &&
                            sender.track.kind ===
                                "video"
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


    } catch (error) {

        console.error(
            "Ошибка смены камеры:",
            error
        );

    }

}


/* =========================
   КАМЕРА ON/OFF
========================= */

function toggleCamera() {

    if (!localStream) return;


    const track =
        localStream
            .getVideoTracks()[0];


    if (!track) return;


    cameraEnabled =
        !cameraEnabled;


    track.enabled =
        cameraEnabled;


    updateCameraButton();

}


function updateCameraButton() {

    if (cameraEnabled) {

        cameraButton.textContent =
            "📹 Камера";


        localCameraOff
            .classList
            .remove("active");

    }

    else {

        cameraButton.textContent =
            "📷 Камера выключена";


        localCameraOff
            .classList
            .add("active");

    }

}


/* =========================
   МИКРОФОН
========================= */

function toggleMicrophone() {

    if (!localStream) return;


    const track =
        localStream
            .getAudioTracks()[0];


    if (!track) return;


    micEnabled =
        !micEnabled;


    track.enabled =
        micEnabled;


    updateMicButton();

}


function updateMicButton() {

    if (micEnabled) {

        micButton.textContent =
            "🎤 Микрофон";

    }

    else {

        micButton.textContent =
            "🔇 Микрофон выключен";

    }

}


/* =========================
   WEBRTC
========================= */

function createPeerConnection() {

    closePeerConnection();


    pendingCandidates = [];


    console.log(
        "Создаём WebRTC соединение"
    );


    peerConnection =
        new RTCPeerConnection(
            {

                iceServers: [

                    {

                        urls:
                            "stun:stun.l.google.com:19302"

                    }

                ]

            }
        );


    if (localStream) {

        localStream
            .getTracks()
            .forEach(
                track => {

                    peerConnection.addTrack(
                        track,
                        localStream
                    );

                }
            );

    }


    peerConnection.ontrack =
        event => {

            console.log(
                "Получен поток собеседника"
            );


            remoteVideo.srcObject =
                event.streams[0];


            waitingText.style.display =
                "none";

        };


    peerConnection.onicecandidate =
        event => {

            if (!event.candidate) {

                console.log(
                    "ICE-сбор завершён"
                );

                return;

            }


            socket.emit(
                "signal",
                {

                    type:
                        "candidate",

                    candidate:
                        event.candidate

                }
            );

        };


    peerConnection.onconnectionstatechange =
        () => {

            if (!peerConnection) return;


            console.log(
                "WebRTC состояние:",
                peerConnection.connectionState
            );


            if (
                peerConnection.connectionState ===
                "connected"
            ) {

                statusText.textContent =
                    "Вы общаетесь";

            }


            if (
                peerConnection.connectionState ===
                "failed"
            ) {

                statusText.textContent =
                    "Не удалось установить видеосвязь";

            }

        };

}


/* =========================
   OFFER
========================= */

async function createOffer() {

    if (!peerConnection) return;


    try {

        console.log(
            "Создаём OFFER"
        );


        const offer =
            await peerConnection
                .createOffer();


        await peerConnection
            .setLocalDescription(
                offer
            );


        console.log(
            "Отправляем OFFER"
        );


        socket.emit(
            "signal",
            {

                type:
                    "offer",

                offer:
                    peerConnection
                        .localDescription

            }
        );

    } catch (error) {

        console.error(
            "Ошибка OFFER:",
            error
        );

    }

}


/* =========================
   SIGNAL
========================= */

socket.on(
    "signal",
    async data => {

        console.log(
            "Получен SIGNAL:",
            data.type
        );


        try {

            if (
                !peerConnection
            ) {

                createPeerConnection();

            }


            if (
                data.type ===
                "offer"
            ) {

                await peerConnection
                    .setRemoteDescription(
                        data.offer
                    );


                for (
                    const candidate
                    of pendingCandidates
                ) {

                    await peerConnection
                        .addIceCandidate(
                            candidate
                        );

                }


                pendingCandidates = [];


                const answer =
                    await peerConnection
                        .createAnswer();


                await peerConnection
                    .setLocalDescription(
                        answer
                    );


                socket.emit(
                    "signal",
                    {

                        type:
                            "answer",

                        answer:
                            peerConnection
                                .localDescription

                    }
                );

            }


            else if (
                data.type ===
                "answer"
            ) {

                await peerConnection
                    .setRemoteDescription(
                        data.answer
                    );


                for (
                    const candidate
                    of pendingCandidates
                ) {

                    await peerConnection
                        .addIceCandidate(
                            candidate
                        );

                }


                pendingCandidates = [];

            }


            else if (
                data.type ===
                "candidate"
            ) {

                if (
                    peerConnection
                        .remoteDescription
                ) {

                    await peerConnection
                        .addIceCandidate(
                            data.candidate
                        );

                }

                else {

                    pendingCandidates.push(
                        data.candidate
                    );

                }

            }

        } catch (error) {

            console.error(
                "Ошибка WebRTC SIGNAL:",
                error
            );

        }

    }
);


/* =========================
   НАЧАТЬ ПОИСК
========================= */

startButton.addEventListener(
    "click",
    async () => {

        if (!socket.connected) {

            alert(
                "Нет подключения к серверу. Подожди несколько секунд."
            );

            return;

        }


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


        closePeerConnection();


        remoteVideo.srcObject =
            null;


        waitingText.textContent =
            "Ищем собеседника...";


        waitingText.style.display =
            "flex";


        statusText.textContent =
            "Ищем собеседника...";


        startButton.disabled =
            true;


        console.log(
            "Отправляем join-search"
        );


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
);


/* =========================
   ПОИСК
========================= */

socket.on(
    "searching",
    () => {

        console.log(
            "Сервер сказал: продолжаем поиск"
        );


        searching = true;


        statusText.textContent =
            "Ищем собеседника...";


        waitingText.textContent =
            "Ищем собеседника...";


        waitingText.style.display =
            "flex";


        startButton.disabled =
            true;

    }
);


/* =========================
   СОБЕСЕДНИК НАЙДЕН
========================= */

socket.on(
    "matched",
    async data => {

        console.log(
            "СОБЕСЕДНИК НАЙДЕН:",
            data
        );


        searching = false;


        currentPartner =
            data.partnerId;


        statusText.textContent =
            "Собеседник найден";


        waitingText.textContent =
            "Подключение к собеседнику...";


        waitingText.style.display =
            "flex";


        startButton.disabled =
            true;


        createPeerConnection();


        if (data.initiator) {

            console.log(
                "Я INITIATOR — создаём OFFER"
            );


            await createOffer();

        }

    }
);


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

        searching = false;


        closePeerConnection();


        remoteVideo.srcObject =
            null;


        waitingText.textContent =
            "Собеседник отключился";


        waitingText.style.display =
            "flex";


        statusText.textContent =
            "Готов к поиску";


        startButton.disabled =
            false;

    }
);


/* =========================
   NEXT
========================= */

nextButton.addEventListener(
    "click",
    () => {

        if (!socket.connected) {

            alert(
                "Нет подключения к серверу."
            );

            return;

        }


        if (!localStream) {

            alert(
                "Сначала включи камеру."
            );

            return;

        }


        closePeerConnection();


        currentPartner = null;


        remoteVideo.srcObject =
            null;


        searching = true;


        waitingText.textContent =
            "Ищем нового собеседника...";


        waitingText.style.display =
            "flex";


        statusText.textContent =
            "Ищем нового собеседника...";


        startButton.disabled =
            true;


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
                "Отправить жалобу?"
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


    pendingCandidates = [];

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
