const mosquitto = require('./connect-mqtt/mosquitto');


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

module.exports.subscribeToTopics = subscribeToTopics;
