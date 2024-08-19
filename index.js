// index.js

const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const session = require("express-session");
const formatMessage = require("./helpers/formatDate");
const {
    activeUser,
    getActiveUserByUID,
    getActiveUserBySocketID,
    signOut,
} = require("./helpers/userHelper");
const mysql = require("mysql2");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "public"));

//body parser for POST requests
var bodyParser = require("body-parser");
const { stat } = require("fs");
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
// Chia sẻ sessionMiddleware với Socket.IO
io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next); //
});

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
    const session = socket.request.session;
    const user = session.user;
    socket.user = user;

    async function getUsersInRoom(room_id) {
        const users = [];
        const onlineUser = Array.from(io.sockets.sockets.values()).map(
            (socket) => socket.user.uid
        );

        try {
            const rows = await new Promise((resolve, reject) => {
                connection.query(
                    `SELECT u.id, u.username FROM users u join user_group ug on u.id = ug.user_id WHERE u.id != ${user.uid} and group_id=${room_id}`,
                    (err, results) => {
                        if (err) {
                            return reject(err);
                        }
                        resolve(results);
                    }
                );
            });

            rows.forEach((row) => {
                let status = "offline";
                if (onlineUser.includes(row.id)) {
                    status = "online";
                }
                users.push({ uid: row.id, username: row.username, status });
            });

            return users;
        } catch (err) {
            console.error("Error executing query", err);
            return [];
        }
    }

    //Listen for login, emit rooms
    socket.on("login", () => {
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
                messages.forEach((message) => {
                    socket.emit(
                        "message",
                        formatMessage(
                            message.uid == user.uid ? "You" : message.username,
                            message.text,
                            message.sent_at
                        ),
                        message.uid == user.uid ? "you" : "other",
                        room_id
                    );
                });
            }
        );
    });

    // Listen for client message
    socket.on("chatMessage", ({ msg, room }) => {
        //save to database
        connection.query(
            `INSERT INTO messages (user_id, group_id, \`text\`) VALUES (${user.uid}, ${room}, '${msg}')`,
            (err, result) => {
                if (err) {
                    console.error("Error executing query", err);
                    return;
                }
                console.log("chatMessage", msg);
            }
        );
        const formattedMessage = formatMessage(user.username, msg);
        socket.broadcast
            .to(room)
            .emit("message", formattedMessage, "other", room);
        socket.emit("message", formattedMessage, "you", room);
    });

    socket.on("room-users", async (room_id) => {
        const users = await getUsersInRoom(room_id);
        socket.emit("room-users", users);
    });

    // Runs when client disconnects
    socket.on("disconnect", () => {
        //
    });

    if (!socket.recovered) {
        const offset =
            socket.handshake.auth.last_message_time || "2020-01-01 00:00:00";
        const room = socket.handshake.auth.currentRoom;
        if (!room) return;
        connection.query(
            `SELECT * FROM messages WHERE group_id = ${room} and sent_at > '${offset}'`,
            (err, messages) => {
                if (err) {
                    console.error("Error executing query", err);
                    return;
                }
                messages.forEach((message) => {
                    socket.emit(
                        "message",
                        formatMessage(
                            message.uid == user.uid ? "You" : message.username,
                            message.text,
                            message.sent_at
                        ),
                        message.uid == user.uid ? "you" : "other",
                        room
                    );
                });
            }
        );
    }
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
