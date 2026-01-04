const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const client = jwksClient({
    jwksUri: `https://${process.env.OKTA_DOMAIN}.okta.com/oauth2/default/v1/keys`
});

function getKey(header, callback) {
    client.getSigningKey(header.kid, (err, key) => {
        if (err) return callback(err);
        const signingKey = key.getPublicKey();
        callback(null, signingKey);
    });
}

function validateAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.substring(7);

    jwt.verify(token, getKey, {
        audience: process.env.OKTA_AUDIENCE,
        issuer: `https://${process.env.OKTA_DOMAIN}.okta.com/oauth2/default`,
        algorithms: ['RS256']
    }, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid token', details: err.message });
        }
        // Check for required scope or role (adjust based on Okta setup; e.g., check scopes or groups)
        if (!decoded.scp || !decoded.scp.includes(process.env.SCP_PERMISSION)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        req.user = decoded;
        next();
    });
}

module.exports = validateAuth;