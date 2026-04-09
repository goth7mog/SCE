const fs = require("fs");
const path = require("path");

// Ensure logs directory exists
const logDir = global.approute + "/logs";
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}
const logFile = path.join(logDir, "security.log");

function logSecurityEvent(message) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
}

module.exports = {
    logSecurityEvent
};
