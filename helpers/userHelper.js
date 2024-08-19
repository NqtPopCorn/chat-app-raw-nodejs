const users = [];

function activeUser(socketId, uid, username) {
    const user = { socketId, uid, username };

    users.push(user);

    return;
}

function getActiveUserByUID(uid) {
    return users.find((user) => user.uid === uid);
}

function getActiveUserBySocketID(socketId) {
    return users.find((user) => user.socketId === socketId);
}

// User leaves chat
function signOut(uid) {
    const index = users.findIndex((user) => user.uid === uid);

    if (index !== -1) {
        return users.splice(index, 1)[0];
    }
}

module.exports = {
    activeUser,
    getActiveUserByUID,
    getActiveUserBySocketID,
    signOut,
};
