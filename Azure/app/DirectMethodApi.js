const iothub = require('azure-iothub');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const connectionString = process.env.IOTHUB_CONNECTION_STRING;

const serviceClient = iothub.Client.fromConnectionString(connectionString);

async function triggerDirectMethod(gatewayId, methodName, payload = {}) {
    return new Promise((resolve, reject) => {
        const methodParams = {
            methodName,
            payload,
            responseTimeoutInSeconds: 30
        };
        serviceClient.invokeDeviceMethod(gatewayId, methodParams, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

module.exports = { triggerDirectMethod };
