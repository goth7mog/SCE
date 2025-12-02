const express = require('express');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });
const { subscribeToClients } = require('./automate');

global.MQTT_SETUP_STATUS = null;

const MQTT_SETUP_TIMEOUT = 300000; // 5 minutes

// Create Global Directory to use throughout the app
const path = require('path');
global.approute = path.resolve(__dirname);


const connectAzure = async () => {
    try {
        const createAzureClient = require(global.approute + '/connect-azure/authenticate.js');

        global.azureClient = await createAzureClient();

        console.log('Azure connection is running');
    } catch (err) {
        console.log(err);
        throw err;
    }
}

const connectRedis = async () => {
    try {
        const createRedisClient = require(global.approute + '/connect-redis/redis-client.js');

        global.redisClient = await createRedisClient();

        console.log('Redis connection is running');
    } catch (err) {
        console.log(err);
        throw err;
    }
}

// Express server setup
const app = express();
app.use(express.json());


app.get('/status', (req, res) => {
    res.json({ status: 'online', timestamp: new Date().toISOString() });
});

// Heartbeat API for health checks
app.get('/heartbeat', (req, res) => {
    res.json({
        heartbeat: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        platform: process.platform,
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
        redis: global.redisClient ? 'connected' : 'disconnected',
        azure: global.azureClient ? 'connected' : 'disconnected'
    });
});

app.get('/api/v1/load', (req, res) => {
    res.json({
        temperature: 22.5,
        humidity: 60,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/v1/usage', (req, res) => {
    res.json({
        temperature: 22.5,
        humidity: 60,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/v1/relay', (req, res) => {
    res.json({
        temperature: 22.5,
        humidity: 60,
        timestamp: new Date().toISOString()
    });
});

const startup = async () => {
    try {
        await connectAzure();
        await connectRedis();
        console.log('Startup complete');
        app.emit('ready');

    } catch (err) {
        console.log(`Startup error: ${err}`);
    }
}

const PORT = process.env.EXPRESS_PORT || 8081;

app.on('ready', async () => {
    app.listen(PORT, () => {
        console.log(`Express server running on port ${PORT}`);
    });

    // Register handler for setupMQTT direct method
    global.azureClient.onDeviceMethod('setUpMQTT', async (request, response) => {
        try {
            const result = await subscribeToClients(request.payload);

            global.MQTT_SETUP_STATUS = 'COMPLETE';

            response.send(200, result, err => {
                if (err) console.error('Failed to send method response:', err);
            });
        } catch (err) {
            global.MQTT_SETUP_STATUS = 'ERROR';
            response.send(500, { error: err.message }, () => { });
        }
    });

    // Timeout for MQTT setup
    setTimeout(async () => {
        try {
            if (!(global.MQTT_SETUP_STATUS === 'COMPLETE' || global.MQTT_SETUP_STATUS === 'DEFAULT')) {
                await subscribeToClients([]); // Defaults to subscribing to all topics
                global.MQTT_SETUP_STATUS = 'DEFAULT';
            }
        } catch (err) {
            global.MQTT_SETUP_STATUS = 'ERROR';
            console.error('MQTT setup timeout error:', err);
        }
    }, MQTT_SETUP_TIMEOUT);


    global.azureClient.onDeviceMethod('getSensorData', (request, response) => {
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

});


//----------------------------RUN APP------------------------------//
startup();
