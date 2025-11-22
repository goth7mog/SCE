const { Client } = require('azure-iot-device');
const { Mqtt } = require('azure-iot-device-mqtt');
const express = require('express');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

// Connection string for edge-gateway-2
const connectionString = process.env.EDGE_GATEWAY_2_CONNECTION_STRING;
// console.log('IoT Hub connection string:', connectionString);

const client = Client.fromConnectionString(connectionString, Mqtt);

// Register Direct Method handler
client.onDeviceMethod('getSensorData', (request, response) => {
    console.log(`Direct Method called: ${request.methodName}`);
    // Example payload
    const sensorData = {
        temperature: 22.5,
        humidity: 60,
        timestamp: new Date().toISOString()
    };
    response.send(200, sensorData, (err) => {
        if (err) {
            console.error('Error sending response:', err.message);
        } else {
            console.log('Response sent successfully:', sensorData);
        }
    });
});

// Express server setup
const app = express();
app.use(express.json());

app.get('/status', (req, res) => {
    res.json({ status: 'online', timestamp: new Date().toISOString() });
});

app.get('/sensor', (req, res) => {
    res.json({
        temperature: 22.5,
        humidity: 60,
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.EXPRESS_PORT || 8081;


app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`);
});

console.log('Listening for Direct Methods and HTTP requests...');
