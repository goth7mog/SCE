const express = require('express');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });


// Create Global Directory to use throughout the app
const path = require('path');
const { create } = require('domain');
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

    const automate = require('./automate');
    await automate.trigger();
});


//----------------------------RUN APP------------------------------//
startup();
