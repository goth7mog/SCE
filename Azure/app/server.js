
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const path = require('path');
global.approute = path.resolve(__dirname);

const port = process.env.PORT || 8080;
const express = require('express');
const cors = require('cors');
const { setUpMQTT, downsampleEdgeData } = require('./operations.js');


const SENSOR_DATA_PULL_INTERVAL = 30000; // each 5 minutes

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

    /** SETTING UP MQTT SUBSCRIPTIONS */
    // setUpMQTT();

    //
    /** PULLING SENSOR DATA */
    setInterval(async () => {
        const timePeriod = 60 * 60 * 1000; // Query data for the last hour. Nonetheless, this value is supposed to be the same as SENSOR_DATA_PULL_INTERVAL
        const bucketSize = 15 * 60 * 1000; // Aggregate data in 15-minute buckets
        try {
            await downsampleEdgeData(timePeriod, bucketSize);
        } catch (err) {
            console.log('Error pulling sensor data:', err);
        }
    }, SENSOR_DATA_PULL_INTERVAL);
});

startup();
