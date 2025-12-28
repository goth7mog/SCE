const mosquitto = require('./connect-mqtt/mosquitto');

function setupMQTTListener() {
    // Set up a callback for incoming messages first
    global.mqttClient.on('message', async (topic, message) => {
        console.log(`Received on ${topic}:`, message.toString());

        /*** Processing telemetry from Raspberries and storing it in Redis Time Series ***/
        if (/\/node\/.+?\/data$/.test(topic)) {
            try {
                const data = JSON.parse(message.toString());
                const timestamp = data.timestamp;
                const extract = topic.match(/\/node\/(.+?)\/data/);
                const deviceId = extract ? extract[1] : 'unknown';
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


        /*** Receiving status of Pis and storing it in Redis ***/
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
}


// Handler for setupMQTT direct method
async function subscribeToTopics(payload) {
    try {
        let SUBSCRIBE_RESULT = [];

        if (payload.length === 0) {
            // Subscribes to all topics if no payload provided
            const topics = [
                '/node/+/data',
                '/node/+/status'
            ];
            for (const topic of topics) {
                const result = await mosquitto.subscribe(topic);
                SUBSCRIBE_RESULT.push(result.message);
            }

        } else {
            for (const device of payload) {
                if (!device.name) continue;
                // Subscribe to data and status topics for each device
                const dataTopic = `/node/${device.name}/data`;
                const statusTopic = `/node/${device.name}/status`;

                const subscribeDataResult = await mosquitto.subscribe(dataTopic);
                SUBSCRIBE_RESULT.push(subscribeDataResult.message);

                const subscribeStatusResult = await mosquitto.subscribe(statusTopic);
                SUBSCRIBE_RESULT.push(subscribeStatusResult.message);

            }
        }


        return SUBSCRIBE_RESULT;

    } catch (err) {
        console.error('setupMQTT handler error:', err);
        return { error: err.message };
    }
}

module.exports = {
    setupMQTTListener,
    subscribeToTopics
};
