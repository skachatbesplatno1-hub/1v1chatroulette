const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

/* =========================
   SOCKET.IO
========================= */

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: false
    },

    transports: ["polling", "websocket"],

    allowEIO3: true
});


/* =========================
   STATIC FILES
========================= */

app.use(express.static("public"));


/* =========================
   ПОЛЬЗОВАТЕЛИ
========================= */

const users = new Map();


/* =========================
   ПРОВЕРКА СОВМЕСТИМОСТИ
========================= */

function compatible(a, b) {

    const aWants =
        a.searchGender === "any" ||
        a.searchGender === b.gender;

    const bWants =
        b.searchGender === "any" ||
        b.searchGender === a.gender;

    return aWants && bWants;
}


/* =========================
   ПОИСК СОБЕСЕДНИКА
========================= */

function findPartner(id) {

    const user = users.get(id);

    if (!user) {
        console.log("ПОИСК: пользователь не найден:", id);
        return;
    }

    if (user.partner) {
        console.log(
            "ПОИСК: пользователь уже имеет партнёра:",
            id
        );
        return;
    }


    console.log(
        "Ищем партнёра для:",
        id,
        user
    );


    for (const [otherId, other] of users) {

        if (otherId === id) {
            continue;
        }

        if (other.partner) {
            continue;
        }

        if (!compatible(user, other)) {
            continue;
        }


        /* =====================
           ПАРА НАЙДЕНА
        ===================== */

        user.partner = otherId;
        other.partner = id;


        console.log(
            "================================="
        );

        console.log(
            "НАЙДЕН СОБЕСЕДНИК:",
            id,
            "<->",
            otherId
        );

        console.log(
            "================================="
        );


        io.to(id).emit(
            "matched",
            {
                partnerId: otherId,
                initiator: true
            }
        );


        io.to(otherId).emit(
            "matched",
            {
                partnerId: id,
                initiator: false
            }
        );


        return;
    }


    console.log(
        "Подходящего собеседника пока нет:",
        id
    );


    io.to(id).emit("searching");
}


/* =========================
   РАЗРЫВ ПАРЫ
========================= */

function disconnectPartner(id) {

    const user = users.get(id);

    if (!user) {
        return;
    }

    if (!user.partner) {
        return;
    }


    const partnerId = user.partner;

    const partner = users.get(partnerId);


    user.partner = null;


    if (partner) {

        partner.partner = null;


        console.log(
            "Партнёр отключён:",
            id,
            "->",
            partnerId
        );


        io.to(partnerId).emit(
            "partner-disconnected"
        );

    }
}


/* =========================
   SOCKET.IO CONNECTION
========================= */

io.on("connection", socket => {

    console.log("");
    console.log(
        "================================="
    );

    console.log(
        "ПОЛЬЗОВАТЕЛЬ ПОДКЛЮЧИЛСЯ:",
        socket.id
    );

    console.log(
        "Transport:",
        socket.conn.transport.name
    );

    console.log(
        "IP:",
        socket.handshake.address
    );

    console.log(
        "Origin:",
        socket.handshake.headers.origin
    );

    console.log(
        "================================="
    );



    /* =====================
       JOIN SEARCH
    ===================== */

    socket.on("join-search", data => {

        console.log("");
        console.log(
            "ПОИСК ОТ:",
            socket.id
        );

        console.log(
            "ДАННЫЕ:",
            data
        );


        if (
            !data ||
            !["male", "female"].includes(data.gender) ||
            !["male", "female", "any"].includes(
                data.searchGender
            )
        ) {

            console.log(
                "ОШИБКА: неправильные данные поиска"
            );

            return;
        }


        /* Если пользователь уже был в системе,
           удаляем старые данные */

        users.delete(socket.id);


        users.set(
            socket.id,
            {
                gender: data.gender,
                searchGender: data.searchGender,
                partner: null
            }
        );


        console.log(
            "ПОЛЬЗОВАТЕЛЬ ДОБАВЛЕН В ПОИСК:",
            socket.id
        );

        console.log(
            "СЕЙЧАС ПОЛЬЗОВАТЕЛЕЙ:",
            users.size
        );


        findPartner(socket.id);

    });



    /* =====================
       NEXT
    ===================== */

    socket.on("next", () => {

        console.log(
            "NEXT:",
            socket.id
        );


        disconnectPartner(socket.id);


        setTimeout(() => {

            if (!users.has(socket.id)) {
                return;
            }


            const user =
                users.get(socket.id);


            user.partner = null;


            findPartner(socket.id);

        }, 300);

    });



    /* =====================
       WEBRTC SIGNAL
    ===================== */

    socket.on("signal", data => {

        const user =
            users.get(socket.id);


        if (!user) {

            console.log(
                "SIGNAL: пользователь не найден:",
                socket.id
            );

            return;
        }


        if (!user.partner) {

            console.log(
                "SIGNAL: нет партнёра:",
                socket.id
            );

            return;
        }


        console.log(
            "SIGNAL:",
            socket.id,
            "->",
            user.partner,
            data?.type
        );


        io.to(user.partner).emit(
            "signal",
            data
        );

    });



    /* =====================
       ЖАЛОБА
    ===================== */

    socket.on("report-user", () => {

        const user =
            users.get(socket.id);


        if (!user || !user.partner) {

            return;

        }


        const partnerId =
            user.partner;


        console.log(
            "ЖАЛОБА:",
            socket.id,
            "на",
            partnerId
        );


        io.to(socket.id).emit(
            "report-confirmed",
            "Жалоба отправлена."
        );


        disconnectPartner(socket.id);


        setTimeout(() => {

            if (users.has(socket.id)) {

                findPartner(socket.id);

            }

        }, 500);

    });



    /* =====================
       SOCKET DISCONNECT
    ===================== */

    socket.on("disconnect", reason => {

        console.log("");
        console.log(
            "================================="
        );

        console.log(
            "ПОЛЬЗОВАТЕЛЬ ОТКЛЮЧИЛСЯ:",
            socket.id
        );

        console.log(
            "Причина:",
            reason
        );

        console.log(
            "================================="
        );


        disconnectPartner(socket.id);


        users.delete(socket.id);


        console.log(
            "Пользователей осталось:",
            users.size
        );

    });



    /* =====================
       ERROR
    ===================== */

    socket.on("error", error => {

        console.error(
            "SOCKET ERROR:",
            socket.id,
            error
        );

    });

});


/* =========================
   HTTP
========================= */

app.get("/health", (req, res) => {

    res.json({
        status: "ok",
        users: users.size,
        time: new Date().toISOString()
    });

});


/* =========================
   PORT
========================= */

const PORT =
    process.env.PORT || 3000;


server.listen(PORT, "0.0.0.0", () => {

    console.log("");
    console.log(
        "================================="
    );

    console.log(
        "1v1ChatRoulette запущен"
    );

    console.log(
        "PORT:",
        PORT
    );

    console.log(
        "================================="
    );

});
