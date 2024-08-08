// index.js

const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const session = require("express-session");
const sharedSession = require("socket.io-express-session");
const formatMessage = require("./helpers/formatDate");
const {
    getActiveUser,
    exitRoom,
    activeUser,
    getIndividualRoomUsers,
} = require("./helpers/userHelper");
const mysql = require("mysql2");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "public"));

//body parser for POST requests
var bodyParser = require("body-parser");
app.use(bodyParser.json()); // to support JSON-encoded bodies
app.use(
    bodyParser.urlencoded({
        // to support URL-encoded bodies
        extended: true,
    })
);
// Thiết lập session
const sessionMiddleware = session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Đặt thành true nếu sử dụng HTTPS
});
app.use(sessionMiddleware);
// Share session with Socket.io
io.use(
    sharedSession(sessionMiddleware, {
        autoSave: true,
    })
);

// Tạo kết nối đến cơ sở dữ liệu
const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "messapp",
    port: 3306,
});
// Kết nối đến cơ sở dữ liệu
connection.connect((err) => {
    if (err) {
        console.log("Error connecting to Db", err);
        return;
    }
    console.log("Connection established");
});
// Lấy dữ liệu từ bảng users

app.post("/login", (req, res) => {
    const { username, password } = req.body;
    connection.query(
        `SELECT * FROM users WHERE username='${username}' and password='${password}'`,
        (err, rows) => {
            if (err) {
                console.error("Error executing query", err);
                res.status(500).send("Error executing query");
                return;
            }
            if (rows.length === 0) {
                console.log("Username or password is incorrect");
                res.status(401).send("Username or password is incorrect");
                return;
            }
            //Luu vao session
            req.session.user = {
                uid: rows[0].id,
                username: username,
            };
            //tra ve ket qua la thanh cong
            console.log(username, "Login success");
            res.send({ user: req.session.user });
        }
    );
});

app.get("/chat", (req, res) => {
    const user = req.session.user;
    if (!user) {
        res.redirect("/index.html");
        return;
    }
    res.render("chat", user);
});

// this block will run when the client connects
io.on("connection", (socket) => {
    let user = socket.handshake.session.user;
    user = {
        ...socket.handshake.session.user,
        socketId: socket.id,
    };
    socket.handshake.session.user = user;
    socket.handshake.session.save();

    //Listen for login, emit rooms
    socket.on("login", () => {
        console.log("login", user.socketId);
        connection.query(
            `SELECT g.id, g.name FROM user_group ug JOIN \`groups\` g on ug.group_id=g.id WHERE ug.user_id = ${user.uid}`,
            (err, rooms) => {
                if (err) {
                    console.error("Error executing query", err);
                    return;
                }
                /* PROBLEM */
                //Join all rooms
                rooms.forEach((room) => {
                    socket.join(room.id);
                });
                /* */
                socket.emit("rooms", rooms);
            }
        );
    });

    // Listen for joining a room
    socket.on("joinRoom", ({ room_id }) => {
        user = { ...user, room: room_id };
        socket.handshake.session.user = user;
        socket.handshake.session.save();
        //Emit reply to client
        // General welcome
        socket.emit(
            "message",
            formatMessage("WebCage", "Messages are limited to this room! "),
            "other",
            room_id
        );
        //Get messages in room_id from database
        connection.query(
            `SELECT u.id as uid, username, \`text\`, sent_at FROM messages m join users u ON m.user_id = u.id WHERE group_id = '${room_id}'`,
            (err, messages) => {
                if (err) {
                    console.error("Error executing query", err);
                    return;
                }
                const formattedMessages = messages.map((message) =>
                    formatMessage(
                        message.uid == user.uid ? "You" : message.username,
                        message.text,
                        message.sent_at
                    )
                );
                socket.emit(
                    "messages",
                    formattedMessages,
                    socket.id == user.socketId ? "you" : "other"
                );
            }
        );
        // Debug only: Broadcast everytime users connects
        // socket.broadcast
        //     .to(room_id)
        //     .emit(
        //         "log",
        //         formatMessage(
        //             "WebCage",
        //             `${user.username} has joined the room`
        //         ),
        //         "other",
        //         room_id
        //     );
    });

    // Listen for client message
    socket.on("chatMessage", (msg) => {
        console.log("chatMessage", msg);
        const formattedMessage = formatMessage(user.username, msg);
        socket.broadcast
            .to(user.room)
            .emit("message", formattedMessage, "other", user.room);
        socket.emit("message", formattedMessage, "you", user.room);
    });

    // Runs when client disconnects
    socket.on("disconnect", () => {
        if (user) {
            io.to(user.room).emit(
                "message",
                formatMessage("WebCage", `${user.username} has left the room`)
            );
        }
    });
});

app.get("/index.html", (req, res) => {
    const user = req.session.user;
    if (user) {
        res.redirect(`/chat`);
        return;
    }
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/logout", (req, res) => {
    console.log(req.session.user.username, "Logout");
    req.session.destroy();
    res.redirect("/index.html");
});

// Set public folder
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 8000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
