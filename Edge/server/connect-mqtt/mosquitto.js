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
module.exports.connect = function () {
    return new Promise((resolve, reject) => {
        global.mqttClient = mqtt.connect(server, options);
        global.mqttClient.on('connect', () => {
            console.log('Connected to MQTT broker');
            resolve({ success: true, message: 'Connected to MQTT broker' });
        });
        global.mqttClient.on('error', (error) => {
            console.error('MQTT error:', error);
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