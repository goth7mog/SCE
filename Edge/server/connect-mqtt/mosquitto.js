const mqtt = require("mqtt");
const server = 'mqtt://mosquitto:1883';
const options = {
    clientId: 'edge-server',
    clean: true,
    // username: '',         
    // password: '',         
    connectTimeout: 4000
    // rejectUnauthorized: true 
}

// MQTT Connect
let client = null;
module.exports.connect = function () {
    return new Promise((resolve, reject) => {
        client = mqtt.connect(server, options);
        client.on('connect', () => {
            console.log('Connected to MQTT broker');
            global.mqttClient = client;
            resolve(client);
        });
        client.on('error', (error) => {
            console.error('MQTT error:', error);
            reject(error);
        });
    });
}

// MQTT Subscribe
module.exports.subscribe = function (topic) {
    return new Promise((resolve, reject) => {
        if (!client) return reject(new Error('MQTT client not connected'));
        client.subscribe(topic, (err, granted) => {
            if (err) return reject(err);
            resolve({ success: true, message: `Subscribed to Topic ${topic}`, data: granted });
        });
    });
}

// MQTT Publish
module.exports.publish = function (topic, data) {
    return new Promise((resolve, reject) => {
        if (!client) return reject(new Error('MQTT client not connected'));
        let payload = JSON.stringify(data);
        client.publish(topic, payload, (err) => {
            if (err) return reject(err);
            resolve({ success: true, message: `Published to Topic ${topic}` });
        });
    });
}