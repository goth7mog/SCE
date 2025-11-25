const mosquitto = require('./connect-mqtt/mosquitto');

async function trigger() {
    try {
        await mosquitto.connect();
        // const topics = [
        //     '/node/Pi-livingroom-f8e7d6c5b4a39281/data',
        //     '/node/Pi-hall-1b2c3d4e5f6a7b8c/data',
        //     '/node/Pi-checkin-9e8f7d6c5b4a3e2d/data'
        // ];
        const topics = [
            // '#'
            // '/node/Pi-livingroom-f8e7d6c5b4a39281/status',
            // '/node/Pi-hall-1b2c3d4e5f6a7b8c/status',
            // '/node/Pi-checkin-9e8f7d6c5b4a3e2d/status',
            '/node/+/status'
        ];
        for (const topic of topics) {
            const result = await mosquitto.subscribe(topic);
            console.log(result.message);
        }
        // // Optionally, handle incoming messages
        global.mqttClient.on('message', (topic, message) => {
            console.log(`Received on ${topic}:`, message.toString());
        });
    } catch (err) {
        console.error('Error:', err);
    }
}

module.exports = { trigger };
