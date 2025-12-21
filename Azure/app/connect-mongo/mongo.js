module.exports = async (database, retries = 3, delay = 2000) => {
    const { MongoClient, ServerApiVersion } = require("mongodb");
    let URL = '';

    if (process.env.MONGO_PASSWORD !== undefined && process.env.MONGO_PASSWORD !== '' && process.env.MONGO_PASSWORD !== null) {
        URL = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_HOST}/?retryWrites=true&w=majority`;
    } else {
        URL = `mongodb://${process.env.MONGO_HOST}:${process.env.MONGO_PORT}`;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            // Connect to the MongoDB
            const client = await MongoClient.connect(URL, {
                // useUnifiedTopology: true,
                serverApi: {
                    version: ServerApiVersion.v1,
                    strict: true,
                    deprecationErrors: true,
                }
            });

            const DB = client.db(database);

            // Send a ping to confirm a successful connection
            await DB.command({ ping: 1 });

            console.log(`MONGO_HOST: ${process.env.MONGO_HOST}, MONGO_PORT: ${process.env.MONGO_PORT}`);

            return DB;
        } catch (err) {
            console.log(`MongoDB connection attempt ${attempt} failed:`, err.message);
            if (attempt < retries) {
                console.log(`Retrying in ${delay / 1000} seconds...`);
                await new Promise(res => setTimeout(res, delay));
            } else {
                console.log('All MongoDB connection attempts failed.');
                throw err;
            }
        }
    }
};