
// console.log("hi");
const { Client } = require('azure-iot-device');
const { Mqtt } = require('azure-iot-device-mqtt');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

// Connection string for edge-gateway-2
const connectionString = process.env.EDGE_GATEWAY_2_CONNECTION_STRING;

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

    // Send response back to IoT Hub
    response.send(200, sensorData, (err) => {
        if (err) {
            console.error('Error sending response:', err.message);
        } else {
            console.log('Response sent successfully:', sensorData);
        }
    });
});

// Keep the process alive
console.log('Listening for Direct Methods...');