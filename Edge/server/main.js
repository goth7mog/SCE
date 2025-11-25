const express = require('express');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });


// Create Global Directory to use throughout the app
const path = require('path');
global.approute = path.resolve(__dirname);


const connectAzure = async () => {
    try {
        global.azureClient = require(global.approute + '/connect-azure/authenticate.js');

        console.log('Azure connection is running');
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
        app.emit('ready');

    } catch (err) {
        console.log(`Startup error: ${err}`);
    }
}

const PORT = process.env.EXPRESS_PORT || 8081;

app.on('ready', () => {
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
    automate.trigger();
});


//----------------------------RUN APP------------------------------//
startup();
