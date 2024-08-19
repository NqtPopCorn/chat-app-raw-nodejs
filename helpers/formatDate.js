const moment = require("moment");

function formatMessage(username, text, timestamp) {
    return {
        username,
        text,
        time: timestamp
            ? moment(timestamp).format("YYYY-MM-DD hh:mm:ss")
            : moment().format("YYYY-MM-DD hh:mm:ss"),
    };
}

module.exports = formatMessage;
