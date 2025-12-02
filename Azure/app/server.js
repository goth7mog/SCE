
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const path = require('path');
global.approute = path.resolve(__dirname);

const port = process.env.PORT || 8080;
const express = require('express');
const cors = require('cors');
const { triggerDirectMethod } = require('./DirectMethodApi.js');

const connectRedis = async () => {
    try {
        const Client = require(global.approute + '/connect-redis/client.js');
        global.redisClient = await Client();
        console.log('Redis connection is running');
    } catch (err) {
        console.log(err);
        throw err;
    }
}

// Assign Mongo connection
const connectMongo = async () => {
    try {
        const connect = require(global.approute + '/connect-mongo/mongo.js');


        global.mongoDB = await connect(process.env.MONGO_DATABASE);

        console.log(`Connected: ${process.env.MONGO_DATABASE} database`);
    } catch (err) {
        console.log(err);
        throw err;
    }

}



const app = new express();
app.use(express.json());
app.use(cors());


// const gatewayRouter = require(global.approute + '/routers/gatewayRouter.js');
// const timeseries = require('./routers/timeseries.js');


// app.use('/api/v1/connect-to-gateway', gatewayRouter);
// app.use('/api/v1/timeseries', timeseries);

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
        await connectRedis();
        await connectMongo();

        app.emit('ready');
    } catch (err) {
        console.log(err);
    }
}

app.on('ready', () => {
    app.listen(port, () => {
        console.log('server is running  on port ' + port);
    });


    // setUpMQTT direct method: retrieve site name and send payload with device names and circuits
    const setUpMQTT = async () => {
        try {
            const sitesCollection = global.mongoDB.collection('sites');
            const devicesCollection = global.mongoDB.collection('devices');

            // Scan through 'sites' collection
            const sites = await sitesCollection.find({}).toArray();
            if (sites.length === 0) {
                throw new Error('No sites found');
            }

            for (const site of sites) {
                // Get devices for this site
                const devices = await devicesCollection.find({ site_id: site._id }).toArray();
                const payload = devices.map(device => ({
                    name: device.name,
                    circuits: device.circuits
                }));
                // Call the direct method with site name and payload
                try {
                    const result = await triggerDirectMethod(site.name, 'setUpMQTT', payload);
                    // console.log(`setUpMQTT called for site ${site.name}:`, result);
                    console.log(`setUpMQTT called for site ${site.name}.`, `Status: ${result.status}`);
                } catch (err) {
                    console.error(`setUpMQTT error for site ${site.name}:`, err);
                }
            }
        } catch (err) {
            console.error('Error in setUpMQTT:', err);
        }
    };

    setUpMQTT();

    setInterval(async () => {
        try {
            const result = await triggerDirectMethod('edge-gateway-3', 'getSensorData', { request: 'latest' });
            console.log('Direct Method response from edge-gateway-3', result);
        } catch (err) {
            console.error('Direct Method error on edge-gateway-3', err);
        }
    }, 300000);
});

startup();
