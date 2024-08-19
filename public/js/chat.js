const chatForm = document.getElementById("chat-form");
const chatMessages = document.querySelector(".chat-messages");
const roomName = document.getElementById("room-name");
const userList = document.getElementById("users");
const sidebar = document.getElementById("group-sidebar");
const btnToggleConnnection = document.getElementById("btn-toggle-connection");
const roomTasks = document.getElementById("room-tasks");

// Get username and room from URL
const { uid, room } = Qs.parse(location.search, {
    ignoreQueryPrefix: true,
});

const socket = io({
    auth: {
        currentRoom: null,
        last_message_time: null,
    },
});

// Login
console.log("login");
socket.emit("login");

socket.on("rooms", (rooms) => {
    console.log("get rooms", rooms);
    // rooms.forEach((room) => {
    //     socket.emit("joinRoom", { uid, room: room.room_name });
    // });
    outputRoom(rooms);
});

socket.on("log", (message, sender, room) => {
    console.log("log", { message, sender, room });
});

// Recieve New Message from server
socket.on("message", (message, sender, room) => {
    const currentRoom = socket.auth.currentRoom;
    console.log("new message", { message, sender, room });
    if (room !== currentRoom) {
        room = document.getElementById("room-" + room);
        room.classList.add("new-message");
        return;
    }
    outputMessage(message, sender === "you");

    socket.auth.last_message_time = message.time;

    // Scroll down
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

// send a message, emit "chatMessage" event
chatForm.addEventListener("submit", (e) => {
    e.preventDefault();

    // Get message text
    let msg = e.target.elements.msg.value;

    msg = msg.trim();

    if (!msg) {
        return false;
    }

    // Emit message to server
    socket.emit("chatMessage", { msg, room: currentRoom });

    // Clear input
    e.target.elements.msg.value = "";
    e.target.elements.msg.focus();
});

// Output message to DOM
function outputMessage(message, isYour) {
    const div = document.createElement("div");
    div.classList.add("message");
    if (isYour) {
        div.classList.add("your-message");
    } else {
        div.classList.add("other-message");
    }
    const p = document.createElement("p");
    p.classList.add("meta");
    p.innerText = isYour ? "You" : message.username;
    p.innerHTML += `<span>${message.time}</span>`;
    div.appendChild(p);
    const para = document.createElement("p");
    para.classList.add("text");
    para.innerText = message.text;
    div.appendChild(para);
    document.querySelector(".chat-messages").appendChild(div);

    // Scroll down
    document.querySelector(".chat-messages-bg").scrollTop =
        document.querySelector(".chat-messages-bg").scrollHeight;
}

// Add users to DOM
function outputUsers(users) {
    console.log({ users });
    userList.innerHTML = "";
    users.forEach((user) => {
        const li = document.createElement("li");
        li.innerText = user.username;
        userList.appendChild(li);
    });
}

function outputRoom(rooms) {
    sidebar.innerHTML = "";
    rooms.forEach((room) => {
        const li = document.createElement("li");
        li.id = "room-" + room.id;
        li.onclick = (event) => {
            handleClickGroup(event, room);
        };
        li.innerHTML = `<i class="fas fa-users"></i>
                        <div class="room-name">${room.name}</div>
                        <div class="last-message">An: hello</div>`;
        sidebar.appendChild(li);
    });
}

//Prompt the user before leave chat room, emit "disconnect" event automatically
document.getElementById("leave-btn").addEventListener("click", () => {
    const leaveRoom = confirm("Are you sure you want to leave the chatroom?");
    if (leaveRoom) {
        window.location.href = "/logout";
    }
});

function handleClickGroup(event, room) {
    if (socket.auth.currentRoom != null && socket.auth.currentRoom == room.id) {
        return;
    }
    socket.auth.currentRoom = room.id;
    document.querySelectorAll(".chat-sidebar li").forEach((li) => {
        li.classList.remove("selected");
    });
    event.currentTarget.classList.add("selected");

    console.log("joining room", { room_id: room.id });
    socket.emit("joinRoom", { room_id: room.id });
    chatMessages.innerHTML = "";
    roomName.innerText = room.name;

    // Get room users
    roomTasks.onclick = (event) => {
        handleClickRoomTasks(event, room);
    };
}

function handleClickRoomTasks(event, room) {
    console.log("handleClickRoomTasks");
    //TODO: show all user in room
    socket.emit("room-users", room.id);
}

btnToggleConnnection.addEventListener("click", () => {
    if (!socket.connected) {
        socket.connect();
        btnToggleConnnection.innerText = "Disconnect";
    } else {
        socket.disconnect();
        btnToggleConnnection.innerText = "Connect";
    }
});

socket.on("room-users", (users) => {
    console.log("room-users", users);
});
