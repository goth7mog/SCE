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


module.exports.getAverageTemperatureOnSite = async (timePeriod, bucketSize) => {
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

            payload.commandsArray = devices.map(device => ([
                'TS.MRANGE',
                String(fromTimestamp),
                String(toTimestamp),
                'AGGREGATION', 'avg', String(bucketSize),
                'WITHLABELS',
                'FILTER', `device=${device.name}`, 'type=temperature'
            ]));

            try {
                const result = await triggerDirectMethod(site.name, 'remoteExecuteRedis', payload.commandsArray);
                const sizeInBytes = Buffer.byteLength(JSON.stringify(result), 'utf8');
                console.log('testTS size in bytes:', sizeInBytes);
                // // console.log(JSON.stringify(result, null, 2));

                // fs.writeFileSync(
                //     `payload_${site.name}.json`,
                //     JSON.stringify(result.payload, null, 2),
                //     'utf8'
                // );
                // console.log(`remoteExecuteRedis called for site ${site.name}.`, `Status: ${result.status}`);

                /** GET AVERAGE TEMPERATURES PER DEVICE (ACROSS ALL ITS CIRCUITS.) **/
                if (result && result.payload) {
                    const timeSeriesData = [];
                    const deviceBuckets = {};
                    for (const deviceGroup of result.payload) {
                        for (const entry of deviceGroup) {
                            const labels = entry[1];
                            const readings = entry[2];
                            const deviceLabel = labels.find(l => l[0] === 'device');
                            const deviceName = deviceLabel ? deviceLabel[1] : null;
                            if (!deviceName) continue;
                            if (!deviceBuckets[deviceName]) {
                                deviceBuckets[deviceName] = {};
                            }
                            for (const reading of readings) {
                                const timestamp = reading[0];
                                const value = parseFloat(reading[1]);
                                if (!isNaN(value)) {
                                    if (!deviceBuckets[deviceName][timestamp]) {
                                        deviceBuckets[deviceName][timestamp] = { sum: 0, count: 0 };
                                    }
                                    deviceBuckets[deviceName][timestamp].sum += value;
                                    deviceBuckets[deviceName][timestamp].count += 1;

                                    // Store temperature in Redis time-series ]
                                    await global.redisClient.sendCommand([
                                        'TS.ADD',
                                        `${deviceName}:temperature`,
                                        String(timestamp),
                                        String(value)
                                        // 'ON_DUPLICATE', 'LAST'
                                    ]);
                                }
                            }
                        }
                    }
                    // Build time-series array
                    for (const [device, buckets] of Object.entries(deviceBuckets)) {
                        for (const [timestamp, { sum, count }] of Object.entries(buckets)) {
                            if (count > 0) {
                                timeSeriesData.push({
                                    device,
                                    timestamp: Number(timestamp),
                                    value: sum / count
                                });
                            }
                        }
                    }
                    console.log('Average temperature calculated per device:', timeSeriesData);
                    // Optionally, write to file for Grafana ingestion
                    // fs.writeFileSync('timeseries.json', JSON.stringify(timeSeriesData, null, 2), 'utf8');
                    // Each entry in timeSeriesData is: { device, timestamp, value } where value is the average temperature.
                } else {
                    throw new Error('No result from remoteExecuteRedis method');
                }

            } catch (err) {
                console.error(`remoteExecuteRedis error for site ${site.name}:`, err);
            }
        }
    } catch (err) {
        console.error('Error in remoteExecuteRedis:', err);
    }
};