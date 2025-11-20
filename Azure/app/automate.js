const iothub = require('azure-iothub');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const connectionString = process.env.IOTHUB_CONNECTION_STRING;

const serviceClient = iothub.Client.fromConnectionString(connectionString);

async function triggerDirectMethod(deviceId, methodName, payload = {}) {
    return new Promise((resolve, reject) => {
        const methodParams = {
            methodName,
            payload,
            responseTimeoutInSeconds: 10
        };
        serviceClient.invokeDeviceMethod(deviceId, methodParams, (err, result) => {
            if (err) {
                console.error('Failed to invoke method:', err.message);
                reject(err);
            } else {
                console.log('Direct Method result:', result);
                resolve(result);
            }
        });
    });
}

module.exports = { triggerDirectMethod };
