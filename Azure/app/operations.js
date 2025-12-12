const { triggerDirectMethod } = require('./DirectMethodApi.js');
const fs = require('fs');


module.exports.setUpMQTT = async () => {
    try {
        const sitesCollection = global.mongoDB.collection('sites');
        const devicesCollection = global.mongoDB.collection('devices');

        // Scan through 'sites' collection
        const sites = await sitesCollection.find({}).toArray();
        if (sites.length === 0) {
            // throw new Error('No sites found');
            console.log('setUpMQTT warning: No sites found in database.');
            return;
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
        console.error('setUpMQTT error:', err);
    }
};


module.exports.downsampleEdgeData = async (timePeriod, bucketSize) => {
    try {
        const now = new Date();
        const fromTimestamp = (new Date(now.getTime() - timePeriod)).getTime(); // ms since epoch
        const toTimestamp = now.getTime();

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
            const payload = {};

            /* Commands array for downsampling time-series data */
            payload.commandsArray = devices.map(device => ([
                'TS.MRANGE',
                String(fromTimestamp),
                String(toTimestamp),
                'AGGREGATION', 'avg', String(bucketSize),
                'WITHLABELS',
                'FILTER', `device=${device.name}`
            ]));

            try {
                const result = await triggerDirectMethod(site.name, 'remoteExecuteRedis', payload.commandsArray);
                // const sizeInBytes = Buffer.byteLength(JSON.stringify(result), 'utf8');
                // console.log('The payload size in bytes:', sizeInBytes); /** Around ~ 5 KB */

                // fs.writeFileSync('payload_edge-gateway-3.json', JSON.stringify(result, null, 2), 'utf8');

                /* Process and store it in the cloud Redis instance */
                if (result && result.payload) {
                    for (const siteSeries of result.payload) {
                        for (const series of siteSeries) {
                            const key = series[0];
                            const labels = series[1];
                            const datapoints = series[2];
                            for (const [timestamp, value] of datapoints) {
                                await global.redisClient.sendCommand([
                                    'TS.ADD',
                                    `${site.name}:${key}`,
                                    String(timestamp),
                                    String(value),
                                    'ON_DUPLICATE', 'LAST'
                                ]);
                            }
                        }
                    }

                } else {
                    throw new Error('No result from remoteExecuteRedis method');
                }

            } catch (err) {
                throw new Error(`remoteExecuteRedis error for site ${site.name}: ${err}`);
            }
        }
    } catch (err) {
        throw err;
    }
};