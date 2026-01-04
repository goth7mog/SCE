const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const client = jwksClient({
    jwksUri: `https://login.microsoftonline.com/common/discovery/v2.0/keys`
});

function getKey(header, callback) {
    client.getSigningKey(header.kid, (err, key) => {
        if (err) return callback(err);
        const signingKey = key.getPublicKey();
        callback(null, signingKey);
    });
}

function validateAzureADToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.substring(7);

    jwt.verify(token, getKey, {
        audience: process.env.AZURE_CLIENT_ID, // Your App Registration client ID
        issuer: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0`,
        algorithms: ['RS256']
    }, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid token', details: err.message });
        }
        // Check app role
        if (!decoded.roles || !decoded.roles.includes('DataCollector.ReadWrite')) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        req.user = decoded;
        next();
    });
}

module.exports = validateAzureADToken;