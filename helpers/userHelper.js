const users = [];

// Join user to chat
function activeUser(socketId, uid, username, room) {
    const user = { socketId, uid, username, room };

    users.push(user);

    return;
}

// Get current user
function getActiveUser(uid) {
    return users.find((user) => user.uid === uid);
}

// User leaves chat
function exitRoom(uid) {
    const index = users.findIndex((user) => user.uid === uid);

    if (index !== -1) {
        return users.splice(index, 1)[0];
    }
}

// Get users from room
function getIndividualRoomUsers(room) {
    return users.filter((user) => user.room === room);
}

module.exports = {
    activeUser,
    getActiveUser,
    exitRoom,
    getIndividualRoomUsers,
};
