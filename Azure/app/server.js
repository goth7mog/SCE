
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const path = require('path');
global.approute = path.resolve(__dirname);

const port = process.env.PORT || 8080;
const express = require('express');
const cors = require('cors');
const { setUpMQTT, downsampleEdgeData } = require('./operations.js');


// const SENSOR_DATA_PULL_INTERVAL = 35000; /** */
const SENSOR_DATA_PULL_INTERVAL = 15 * 60 * 1000; /** */

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
        data: {
            NAME: process.env.npm_package_name,
            VERSION: process.env.npm_package_version,
            REDIS_HOST: process.env.REDIS_HOST,
            REDIS_PORT: process.env.REDIS_PORT,
            MONGO_HOST: process.env.MONGO_HOST,
            MONGO_PORT: process.env.MONGO_PORT,
            IOTHUB_STATUS: global.iotHubClient && global.iotHubClient.isConnected ? 'connected' : 'not connected'
        },
        error: null
    });
});

app.get("/mqtt/start-up", async (req, res) => {
    try {

        /** SETTING UP MQTT SUBSCRIPTIONS */
        const result = await setUpMQTT();

        res.status(200).json({ message: "setUpMQTT called", result: result });

    } catch (error) {
        // console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.get("/collect-sensor-data", async (req, res) => {
    /** PULLING SENSOR DATA */
    // const timePeriod = 60 * 60 * 1000; // Query data for the last hour. Nonetheless, this value is supposed to be the same as SENSOR_DATA_PULL_INTERVAL
    // const bucketSize = 15 * 60 * 1000; // Aggregate data in 15-minute buckets
    try {
        const timePeriod = req.query.timePeriod || null;
        const bucketSize = req.query.bucketSize || null;

        const result = await downsampleEdgeData(timePeriod, bucketSize);

        res.status(200).json({ success: true, result: result });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// app.get("/collect-data/start", async (req, res) => {
//     try {

//         /** PULLING SENSOR DATA */
//         global.intervalId = setInterval(async () => {
//             const timePeriod = 60 * 60 * 1000; // Query data for the last hour. Nonetheless, this value is supposed to be the same as SENSOR_DATA_PULL_INTERVAL
//             const bucketSize = 15 * 60 * 1000; // Aggregate data in 15-minute buckets
//             try {
//                 await downsampleEdgeData(timePeriod, bucketSize);
//             } catch (err) {
//                 console.log('Error pulling sensor data:', err);
//             }
//         }, SENSOR_DATA_PULL_INTERVAL);

//         res.status(200).json({ success: true, message: "Started" });

//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ success: false, message: "Error starting data collection", error: error.message });
//     }
// });


// app.get("/collect-data/stop", async (req, res) => {
//     try {
//         clearInterval(global.intervalId);

//         res.status(200).json({ success: true, message: "Stopped" });

//     } catch (error) {
//         // console.error(error);
//         res.status(500).json({ success: false, message: "Error stopping data collection", error: error.message });
//     }
// });

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

    // /** SETTING UP MQTT SUBSCRIPTIONS */
    // setUpMQTT();

    // //
    // /** PULLING SENSOR DATA */
    // setInterval(async () => {
    //     const timePeriod = 60 * 60 * 1000; // Query data for the last hour. Nonetheless, this value is supposed to be the same as SENSOR_DATA_PULL_INTERVAL
    //     const bucketSize = 15 * 60 * 1000; // Aggregate data in 15-minute buckets
    //     try {
    //         await downsampleEdgeData(timePeriod, bucketSize);
    //     } catch (err) {
    //         console.log('Error pulling sensor data:', err);
    //     }
    // }, SENSOR_DATA_PULL_INTERVAL);
});

startup();

