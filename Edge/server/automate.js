const mosquitto = require('./connect-mqtt/mosquitto');

async function trigger() {
    try {
        await mosquitto.connect();
        // const topics = [
        // '/node/Pi-livingroom-f8e7d6c5b4a39281/data',
        // '/node/Pi-hall-1b2c3d4e5f6a7b8c/data',
        // '/node/Pi-checkin-9e8f7d6c5b4a3e2d/data'
        // ];
        // const topics = [
        //     // '#'
        //     // '/node/Pi-livingroom-f8e7d6c5b4a39281/status',
        //     // '/node/Pi-hall-1b2c3d4e5f6a7b8c/status',
        //     // '/node/Pi-checkin-9e8f7d6c5b4a3e2d/status'
        // ];


        const topics = [
            '/node/+/data',
            '/node/+/status'
        ];
        for (const topic of topics) {
            const result = await mosquitto.subscribe(topic);
            console.log(result.message);
        }

        // Handle incoming messages
        global.mqttClient.on('message', async (topic, message) => {
            console.log(`Received on ${topic}:`, message.toString());

            /*** Processing telemetry from Raspberries and storing it in Redis Time Series ***/
            if (/\/node\/.+?\/data$/.test(topic)) {
                try {
                    const data = JSON.parse(message.toString());
                    const timestamp = data.timestamp;
                    const deviceIdMatch = topic.match(/\/node\/(.+?)\/data/);
                    const deviceId = deviceIdMatch ? deviceIdMatch[1] : 'unknown';
                    for (const circuit of ['circuitA', 'circuitB', 'circuitC']) {
                        if (data[circuit]) {
                            // Temperature
                            await global.redisClient.sendCommand([
                                'TS.ADD',
                                `${deviceId}:${circuit}:temperature`,
                                String(timestamp),
                                String(data[circuit].temperature)
                            ]);
                            // Humidity
                            await global.redisClient.sendCommand([
                                'TS.ADD',
                                `${deviceId}:${circuit}:humidity`,
                                String(timestamp),
                                String(data[circuit].humidity)
                            ]);
                        }
                    }
                } catch (err) {
                    console.error('Failed to store in Redis Time Series:', err);
                }

            }


            /*** Receiving status of Pis and storing itin Redis ***/
            if (/\/node\/.+?\/status$/.test(topic)) {
                console.log(`Status received on ${topic}:`, message.toString());
                const deviceIdMatch = topic.match(/\/node\/(.+?)\/status/);
                const deviceId = deviceIdMatch ? deviceIdMatch[1] : 'unknown';
                const status = message.toString().trim();
                try {
                    await global.redisClient.sendCommand([
                        'SET',
                        `${deviceId}:status`,
                        status
                    ]);
                } catch (err) {
                    console.error('Failed to store device status in Redis:', err);
                }
            }
        });
    } catch (err) {
        console.error('Error:', err);
    }
}

module.exports = { trigger };
