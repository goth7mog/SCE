const { Client } = require('azure-iot-device');
const { Mqtt } = require('azure-iot-device-mqtt');
require('dotenv').config();

// Use connection string from .env or hardcoded for demo
const connectionString = process.env.IOTHUB_CONNECTION_STRING;

const client = Client.fromConnectionString(connectionString, Mqtt);

async function triggerDirectMethod(deviceId, methodName, payload = {}) {
    return new Promise((resolve, reject) => {
        client.invokeDeviceMethod(deviceId, {
            methodName,
            payload,
            responseTimeoutInSeconds: 10
        }, (err, result) => {
            if (err) {
                console.error('Failed to invoke method:', err.message);
                reject(err);
            } else {
                console.log('Direct Method result:', result);
                resolve(result);
            }
        });
    });
}

module.exports = { triggerDirectMethod };
