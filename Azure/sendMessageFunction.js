// Function to send a message to IoT Hub
module.exports = async function (context) {
    try {
        const { Client } = require('azure-iothub');
        const connectionString = process.env.IOTHUB_CONNECTION_STRING; // Set in Azure Function App settings
        const targetDevice = 'edge-gateway-1'; // Change to your device ID
        const client = Client.fromConnectionString(connectionString);
        const message = new Message('Hello from Azure Function!');
        await client.open();
        await client.send(targetDevice, message);
        context.log(`Message sent to device: ${targetDevice}`);
    } catch (err) {
        context.log("Hi");
        context.log.error('Error sending message:', err.message);
    } finally {
        await client.close();
    }
};
