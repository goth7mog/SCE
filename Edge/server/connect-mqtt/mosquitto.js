const mqtt = require("mqtt");
const { logSecurityEvent } = require("../logger/Logger");
const server = 'mqtt://mosquitto:1883';
const options = {
    clientId: 'edge-server',
    // clean: true,        /* Default is 'true' nevertheless */
    // username: '',         
    // password: '',         
    connectTimeout: 5000
    // rejectUnauthorized: true 
}

// MQTT Connect
module.exports.connect = function () {
    return new Promise((resolve, reject) => {
        global.mqttClient = mqtt.connect(server, options);
        global.mqttClient.on('connect', () => {
            const msg = 'Connected to MQTT broker';
            console.log(msg);
            logSecurityEvent(msg);
            resolve({ success: true, message: msg });
        });
        global.mqttClient.on('error', (error) => {
            const errMsg = `MQTT error: ${error && error.message ? error.message : error}`;
            console.error(errMsg);
            logSecurityEvent(errMsg);
            reject(error);
        });
    });
}

// MQTT Subscribe
module.exports.subscribe = function (topic) {
    return new Promise((resolve, reject) => {
        if (!global.mqttClient) return reject(new Error('MQTT client not connected'));
        global.mqttClient.subscribe(topic, (err, granted) => {
            if (err) return reject(err);
            resolve({ success: true, message: `Subscribed to Topic ${topic}`, data: granted });
        });
    });
}

// MQTT Publish
module.exports.publish = function (topic, data) {
    return new Promise((resolve, reject) => {
        if (!global.mqttClient) return reject(new Error('MQTT client not connected'));
        let payload = JSON.stringify(data);
        global.mqttClient.publish(topic, payload, (err) => {
            if (err) return reject(err);
            resolve({ success: true, message: `Published to Topic ${topic}` });
        });
    });
}