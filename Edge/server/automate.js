const mosquitto = require('./connect-mqtt/mosquitto');

async function trigger() {
    try {
        await mosquitto.connect();
        // const topics = [
        //     '/node/Pi-livingroom-5f2d7a/data',
        //     '/node/Pi-hall-7b1f4d/data',
        //     '/node/Pi-checkin-a3c9e2/data'
        // ];
        const topics = [
            // '#'
            // '/node/Pi-livingroom-5f2d7a/status',
            // '/node/Pi-hall-7b1f4d/status',
            // '/node/Pi-checkin-a3c9e2/status',
            '/node/+/status'
        ];
        for (const topic of topics) {
            const result = await mosquitto.subscribe(topic);
            // console.log(result.message);
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
