const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },

   transports: [
    "polling"
]
});


const PORT = process.env.PORT || 10000;


/* =========================
   ПОЛЬЗОВАТЕЛИ
========================= */

const users = new Map();


/* =========================
   СТАТИЧЕСКИЕ ФАЙЛЫ
========================= */

app.use(express.static("public"));


app.get("/", (req, res) => {

    res.send("1v1ChatRoulette server работает");

});


/* =========================
   ПРОВЕРКА СОВМЕСТИМОСТИ
========================= */

function isCompatible(userA, userB) {

    const aWantsB =
        userA.searchGender === "any" ||
        userA.searchGender === userB.gender;


    const bWantsA =
        userB.searchGender === "any" ||
        userB.searchGender === userA.gender;


    return aWantsB && bWantsA;

}


/* =========================
   УБРАТЬ ИЗ ПОИСКА
========================= */

function removeFromSearch(socketId) {

    const user = users.get(socketId);

    if (!user) return;

    user.searching = false;

}


/* =========================
   НАЙТИ СОБЕСЕДНИКА
========================= */

function findPartner(socketId) {

    const user = users.get(socketId);

    if (!user) return null;


    for (const [otherId, otherUser] of users) {

        if (otherId === socketId) continue;

        if (!otherUser.searching) continue;

        if (otherUser.partner) continue;

        if (!isCompatible(user, otherUser)) continue;

        return otherId;

    }


    return null;

}


/* =========================
   SOCKET.IO
========================= */

io.on("connection", socket => {

    console.log("=================================");
    console.log("ПОЛЬЗОВАТЕЛЬ ПОДКЛЮЧИЛСЯ:", socket.id);
    console.log("Transport:", socket.conn.transport.name);
    console.log("=================================");


    users.set(socket.id, {

        gender: null,

        searchGender: "any",

        searching: false,

        partner: null

    });


    /* =========================
       СМЕНА TRANSPORT
    ========================= */

    socket.conn.on("upgrade", () => {

        console.log(
            "TRANSPORT UPGRADE:",
            socket.id,
            "->",
            socket.conn.transport.name
        );

    });


    /* =========================
       ПОИСК
    ========================= */

    socket.on("join-search", data => {

        const user = users.get(socket.id);

        if (!user) return;


        console.log("=================================");
        console.log("ПОИСК ОТ:", socket.id);
        console.log("ДАННЫЕ:", data);


        user.gender =
            data.gender || "male";

        user.searchGender =
            data.searchGender || "any";

        user.searching = true;

        user.partner = null;


        const partnerId =
            findPartner(socket.id);


        if (!partnerId) {

            console.log(
                "Подходящего собеседника пока нет:",
                socket.id
            );

            socket.emit("searching");

            return;

        }


        const partner =
            users.get(partnerId);


        if (!partner) {

            socket.emit("searching");

            return;

        }


        /* Создаём пару */

        user.searching = false;

        partner.searching = false;


        user.partner =
            partnerId;

        partner.partner =
            socket.id;


        console.log("=================================");
        console.log(
            "НАЙДЕН СОБЕСЕДНИК:",
            socket.id,
            "<->",
            partnerId
        );
        console.log("=================================");


        /*
         * Один пользователь создаёт OFFER.
         * Второй принимает.
         */

        socket.emit("matched", {

            partnerId,

            initiator: true

        });


        io.to(partnerId).emit(
            "matched",
            {

                partnerId: socket.id,

                initiator: false

            }
        );

    });


    /* =========================
       СИГНАЛ WEBRTC
    ========================= */

    socket.on("signal", data => {

        const user =
            users.get(socket.id);


        if (!user) return;

        if (!user.partner) return;


        console.log(
            "SIGNAL:",
            socket.id,
            "->",
            user.partner,
            data.type
        );


        io.to(user.partner).emit(
            "signal",
            data
        );

    });


    /* =========================
       СЛЕДУЮЩИЙ
    ========================= */

    socket.on("next", () => {

        const user =
            users.get(socket.id);

        if (!user) return;


        console.log(
            "NEXT:",
            socket.id
        );


        const oldPartnerId =
            user.partner;


        user.partner = null;

        user.searching = true;


        /*
         * Старого собеседника
         * возвращаем в поиск.
         */

        if (oldPartnerId) {

            const oldPartner =
                users.get(oldPartnerId);


            if (oldPartner) {

                oldPartner.partner =
                    null;

                oldPartner.searching =
                    true;


                io.to(oldPartnerId).emit(
                    "partner-disconnected"
                );

            }

        }


        const partnerId =
            findPartner(socket.id);


        if (!partnerId) {

            socket.emit("searching");

            return;

        }


        const partner =
            users.get(partnerId);


        if (!partner) {

            socket.emit("searching");

            return;

        }


        user.searching = false;

        partner.searching = false;


        user.partner =
            partnerId;

        partner.partner =
            socket.id;


        socket.emit("matched", {

            partnerId,

            initiator: true

        });


        io.to(partnerId).emit(
            "matched",
            {

                partnerId: socket.id,

                initiator: false

            }
        );

    });


    /* =========================
       ЖАЛОБА
    ========================= */

    socket.on("report-user", () => {

        const user =
            users.get(socket.id);


        if (!user) return;


        console.log(
            "ЖАЛОБА:",
            socket.id,
            "на",
            user.partner
        );


        socket.emit(
            "report-confirmed",
            "Жалоба отправлена."
        );

    });


    /* =========================
       ОТКЛЮЧЕНИЕ
    ========================= */

    socket.on("disconnect", reason => {

        console.log("=================================");
        console.log(
            "ПОЛЬЗОВАТЕЛЬ ОТКЛЮЧИЛСЯ:",
            socket.id
        );
        console.log(
            "Причина:",
            reason
        );
        console.log("=================================");


        const user =
            users.get(socket.id);


        if (!user) return;


        const partnerId =
            user.partner;


        users.delete(socket.id);


        if (partnerId) {

            const partner =
                users.get(partnerId);


            if (partner) {

                partner.partner =
                    null;

                partner.searching =
                    false;


                io.to(partnerId).emit(
                    "partner-disconnected"
                );

            }

        }


        console.log(
            "Пользователей осталось:",
            users.size
        );

    });

});


/* =========================
   ЗАПУСК
========================= */

server.listen(PORT, "0.0.0.0", () => {

    console.log("=================================");
    console.log("1v1ChatRoulette запущен");
    console.log("PORT:", PORT);
    console.log("=================================");

});
