const moment = require("moment");

function formatMessage(username, text, timestamp) {
    return {
        username,
        text,
        time: timestamp
            ? moment(timestamp).format("DD/MM h:mm a")
            : moment().format("DD/MM h:mm a"),
    };
}

module.exports = formatMessage;
