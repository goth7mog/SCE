const { createClient } = require('redis');

module.exports = async () => {
    try {
        // console.log(REDIS_HOST, REDIS_PORT);
        const host = process.env.REDIS_HOST || 'redis';
        const port = process.env.REDIS_PORT || 6379;
        const password = process.env.REDIS_PASSWORD;

        const url = password
            ? `redis://:${password}@${host}:${port}`
            : `redis://${host}:${port}`;

        const client = createClient({ url });

        client.on('error', (err) => {
            console.error('[Redis Debug] node-redis client error:', err);
        });
        client.on('end', () => {
            console.log('[Redis Debug] node-redis connection closed');
        });
        client.on('reconnecting', () => {
            console.log('[Redis Debug] node-redis client reconnecting');
        });

        await client.connect();
        return client;
    } catch (err) {
        console.error('[Redis Debug] Failed to connect to Redis:', err);
        throw err;
    }
};
