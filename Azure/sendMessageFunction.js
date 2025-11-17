const { Client } = require('azure-iothub');

// Timer trigger function to send a message every 30 seconds
module.exports = async function (context, myTimer) {
    const connectionString = process.env.IOTHUB_CONNECTION_STRING; // Set in Azure Function App settings
    const targetDevice = 'edge-gateway-1'; // Change to your device ID
    const client = Client.fromConnectionString(connectionString);

    const message = new Message('Hello from Azure Function!');

    try {
        await client.open();
        await client.send(targetDevice, message);
        context.log(`Message sent to device: ${targetDevice}`);
    } catch (err) {
        context.log.error('Error sending message:', err.message);
    } finally {
        await client.close();
    }
};
