const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "https://1v1chatroulette.skachatbesplatno1.workers.dev",
        methods: ["GET", "POST"]
    }
});

app.use(express.static("public"));

const users = new Map();

function compatible(a, b) {
    const aWants =
        a.searchGender === "any" ||
        a.searchGender === b.gender;

    const bWants =
        b.searchGender === "any" ||
        b.searchGender === a.gender;

    return aWants && bWants;
}

function findPartner(id) {

    const user = users.get(id);

    if (!user || user.partner) return;

    for (const [otherId, other] of users) {

        if (otherId === id) continue;
        if (other.partner) continue;

        if (!compatible(user, other)) continue;

        user.partner = otherId;
        other.partner = id;

        io.to(id).emit("matched", {
            partnerId: otherId,
            initiator: true
        });

        io.to(otherId).emit("matched", {
            partnerId: id,
            initiator: false
        });

        return;
    }

    io.to(id).emit("searching");
}

function disconnectPartner(id) {

    const user = users.get(id);

    if (!user || !user.partner) return;

    const partnerId = user.partner;
    const partner = users.get(partnerId);

    user.partner = null;

    if (partner) {

        partner.partner = null;

        io.to(partnerId).emit(
            "partner-disconnected"
        );
    }
}

io.on("connection", socket => {

    console.log("Пользователь подключился:", socket.id);

    socket.on("join-search", data => {

        if (
            !data ||
            !["male", "female"].includes(data.gender) ||
            !["male", "female", "any"].includes(data.searchGender)
        ) {
            return;
        }

        users.set(socket.id, {
            gender: data.gender,
            searchGender: data.searchGender,
            partner: null
        });

        findPartner(socket.id);
    });


    socket.on("next", () => {

        disconnectPartner(socket.id);

        setTimeout(() => {

            if (users.has(socket.id)) {
                findPartner(socket.id);
            }

        }, 300);

    });


    socket.on("signal", data => {

        const user = users.get(socket.id);

        if (!user || !user.partner) return;

        io.to(user.partner).emit(
            "signal",
            data
        );

    });


    socket.on("report-user", () => {

        const user = users.get(socket.id);

        if (!user || !user.partner) return;

        console.log(
            "Жалоба:",
            socket.id,
            "на",
            user.partner
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


    socket.on("disconnect", () => {

        disconnectPartner(socket.id);

        users.delete(socket.id);

        console.log(
            "Пользователь отключился:",
            socket.id
        );

    });

});


const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {

    console.log(
        `1v1ChatRoulette запущен: http://localhost:${PORT}`
    );

});
