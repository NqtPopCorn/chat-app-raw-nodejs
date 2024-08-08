const chatForm = document.getElementById("chat-form");
const chatMessages = document.querySelector(".chat-messages");
const roomName = document.getElementById("room-name");
const userList = document.getElementById("users");
const sidebar = document.getElementById("group-sidebar");

// Get username and room from URL
const { uid, room } = Qs.parse(location.search, {
    ignoreQueryPrefix: true,
});
var currentRoom = null;

console.log({ uid, room });

const socket = io();

// Login
console.log("login");
socket.emit("login");

socket.on("rooms", (rooms) => {
    console.log("get rooms", rooms);
    // rooms.forEach((room) => {
    //     socket.emit("joinRoom", { uid, room: room.room_name });
    // });
    sidebar.innerHTML = "";
    rooms.forEach((room) => {
        const li = document.createElement("li");
        li.onclick = (event) => {
            handleClickGroup(event, room.id);
        };
        li.innerHTML = `<i class="fas fa-users"></i>
                        <div class="room-name">${room.name}</div>
                        <div class="last-message">An: hello</div>`;
        sidebar.appendChild(li);
    });
});

//Get messages in a room
socket.on("messages", (messages) => {
    console.log("messages in room", { messages });
    messages.forEach((message) => {
        outputMessage(message);
    });
    // Scroll down
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on("log", (message, sender, room) => {
    console.log("log", { message, sender, room });
});

// Recieve New Message from server
socket.on("message", (message, sender, room) => {
    console.log("new message", { message, sender, room });
    if (room !== currentRoom) {
        return;
    }
    outputMessage(message, sender === "you");

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
    socket.emit("chatMessage", msg);

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

    // // Scroll down
    // document.querySelector(".chat-messages-bg").scrollTop =
    //     document.querySelector(".chat-messages-bg").scrollHeight;
}

// Add room name to DOM
function outputRoomName(room) {
    roomName.innerText = room;
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

//Prompt the user before leave chat room, emit "disconnect" event automatically
document.getElementById("leave-btn").addEventListener("click", () => {
    const leaveRoom = confirm("Are you sure you want to leave the chatroom?");
    if (leaveRoom) {
        window.location.href = "/logout";
    }
});

function handleClickGroup(event, data) {
    document.querySelectorAll(".chat-sidebar li").forEach((li) => {
        li.classList.remove("selected");
    });
    event.currentTarget.classList.add("selected");

    //xem cuoc tro chuyen voi ma la data
    if (currentRoom !== data) {
        console.log("joining room", { room_id: data });
        socket.emit("joinRoom", { room_id: data });
        chatMessages.innerHTML = "";
        currentRoom = data;
    }
}

function handleClickRoomTasks(event) {
    console.log("handleClickRoomTasks");
}
