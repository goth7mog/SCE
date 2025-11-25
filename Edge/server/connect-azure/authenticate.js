const { Client } = require('azure-iot-device');
const { Mqtt } = require('azure-iot-device-mqtt');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });


module.exports = () => {
    const iotHubHostname = process.env.IOTHUB_HOSTNAME || 'sce-iothub-01.azure-devices.net';
    const deviceId = process.env.DEVICE_ID || 'edge-gateway-3';
    const certPath = process.env.X509_CERT_PATH || './certificates/edge-gateway-3.cert.pem';
    const keyPath = process.env.X509_KEY_PATH || './certificates/edge-gateway-3.key.pem';

    const x509 = {
        cert: fs.readFileSync(certPath, 'utf-8'),
        key: fs.readFileSync(keyPath, 'utf-8'),
    };

    const connectionString = `HostName=${iotHubHostname};DeviceId=${deviceId};x509=true`;
    const client = Client.fromConnectionString(connectionString, Mqtt);
    client.setOptions(x509);

    return client;

};