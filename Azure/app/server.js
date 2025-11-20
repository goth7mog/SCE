
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const path = require('path');
global.approute = path.resolve(__dirname);

const port = process.env.PORT || 8080;
const express = require('express');
const cors = require('cors');

const connectRedis = async () => {
    try {
        const Client = require(global.approute + '/redis_client/client.js');
        global.client = await Client();
        console.log('Redis connection is running');
    } catch (err) {
        console.log(err);
    }
}



const app = new express();
app.use(express.json());
app.use(cors());


const gatewayRouter = require(global.approute + '/routers/gatewayRouter.js');
const timeseries = require('./routers/timeseries.js');


app.use('/api/v1/connect-to-gateway', gatewayRouter);
app.use('/api/v1/timeseries', timeseries);

app.get('/api/v1/info', (req, res) => {
    res.json({
        code: 1,
        message: `${process.env.npm_package_name} is running`,
        data: {
            NAME: process.env.npm_package_name,
            VERSION: process.env.npm_package_version,
            REDIS_HOST: process.env.REDIS_HOST,
            REDIS_PORT: process.env.REDIS_PORT,
        },
        error: null
    });
});

const startup = async () => {
    try {
        // await connectRedis();
        app.emit('ready');
    } catch (err) {
        console.log(err);
    }
}

app.on('ready', () => {
    app.listen(port, () => {
        console.log('server is running  on port ' + port);
        console.log('VERSION', process.env.npm_package_version);
        console.log('REDIS_HOST =', process.env.REDIS_HOST);
        console.log('REDIS_PORT =', process.env.REDIS_PORT);
    });

    (() => {
        const { triggerDirectMethod } = require('./automate.js');

        setInterval(async () => {
            try {
                const result = await triggerDirectMethod('edge-gateway-2', 'getSensorData', { request: 'latest' });
                console.log('Direct Method response from edge-gateway-2', result);
            } catch (err) {
                console.error('Direct Method error on edge-gateway-2', err);
            }
        }, 30000);
    })();
});

startup();
