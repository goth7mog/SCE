/* OPC UA connector starts in the edge server when `OPCUA_ENDPOINT` is set; use `OPCUA_MONITORED_NODES_JSON` or `OPCUA_NODE_IDS` to choose the monitored nodes */





const {
    OPCUAClient,
    AttributeIds,
    ClientSubscription,
    ClientMonitoredItem,
    MessageSecurityMode,
    SecurityPolicy,
    TimestampsToReturn
} = require('node-opcua');

const DEFAULT_RECONNECT_DELAY_MS = 5000;
const DEFAULT_PUBLISHING_INTERVAL_MS = 1000;

const opcuaState = {
    status: 'disabled',
    endpoint: null,
    monitoredNodes: [],
    lastError: null,
    lastValueAt: null
};

let activeClient = null;
let activeSession = null;
let activeSubscription = null;
let reconnectTimer = null;
let shuttingDown = false;

function sanitizeKeyPart(value) {
    return String(value || '')
        .trim()
        .replace(/[^a-zA-Z0-9:_-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function parseMonitoredNodes() {
    const rawJson = process.env.OPCUA_MONITORED_NODES_JSON;
    if (rawJson) {
        try {
            const parsed = JSON.parse(rawJson);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        } catch (err) {
            console.warn('Invalid OPCUA_MONITORED_NODES_JSON, falling back to comma-separated node ids');
        }
    }

    const rawNodes = process.env.OPCUA_NODE_IDS;
    if (!rawNodes) {
        return [];
    }

    return rawNodes
        .split(',')
        .map(nodeId => nodeId.trim())
        .filter(Boolean)
        .map((nodeId, index) => ({
            nodeId,
            metric: `value_${index + 1}`
        }));
}

function buildClientOptions() {
    const securityPolicyName = process.env.OPCUA_SECURITY_POLICY || 'None';
    const securityModeName = process.env.OPCUA_SECURITY_MODE || 'None';

    return {
        endpointMustExist: false,
        connectionStrategy: {
            initialDelay: 2000,
            maxDelay: 10000,
            maxRetry: 0
        },
        securityPolicy: SecurityPolicy[securityPolicyName] || SecurityPolicy.None,
        securityMode: MessageSecurityMode[securityModeName] || MessageSecurityMode.None,
        keepSessionAlive: true
    };
}

async function persistReading(redisClient, reading) {
    if (!redisClient) {
        return;
    }

    const redisKey = reading.seriesKey;
    const latestKey = `${redisKey}:latest`;
    const valueAsString = String(reading.value);

    if (Number.isFinite(reading.value)) {
        await redisClient.sendCommand([
            'TS.ADD',
            redisKey,
            String(reading.timestamp),
            valueAsString
        ]);
    }

    await redisClient.sendCommand([
        'SET',
        latestKey,
        valueAsString
    ]);
}

function cleanupConnection() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    if (activeSubscription) {
        try {
            activeSubscription.terminate();
        } catch (err) {
            // best effort cleanup
        }
        activeSubscription = null;
    }

    if (activeSession) {
        try {
            activeSession.close();
        } catch (err) {
            // best effort cleanup
        }
        activeSession = null;
    }

    if (activeClient) {
        try {
            activeClient.disconnect();
        } catch (err) {
            // best effort cleanup
        }
        activeClient = null;
    }
}

function scheduleReconnect(redisClient) {
    if (shuttingDown) {
        return;
    }

    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
    }

    opcuaState.status = 'reconnecting';
    reconnectTimer = setTimeout(() => {
        startOpcUaConnector({ redisClient }).catch(err => {
            opcuaState.lastError = err.message;
        });
    }, DEFAULT_RECONNECT_DELAY_MS);
}

async function connectMonitoredNodes(redisClient, monitoredNodes) {
    const endpointUrl = process.env.OPCUA_ENDPOINT;
    const username = process.env.OPCUA_USERNAME;
    const password = process.env.OPCUA_PASSWORD;
    const client = OPCUAClient.create(buildClientOptions());

    activeClient = client;
    opcuaState.endpoint = endpointUrl;
    opcuaState.monitoredNodes = monitoredNodes;

    client.on('connection_lost', () => {
        opcuaState.status = 'disconnected';
        scheduleReconnect(redisClient);
    });

    client.on('backoff', (retryNumber, delay) => {
        opcuaState.status = 'reconnecting';
        opcuaState.lastError = `OPC UA reconnect attempt ${retryNumber} in ${delay}ms`;
    });

    await client.connect(endpointUrl);

    activeSession = username
        ? await client.createSession({ userName: username, password })
        : await client.createSession();

    opcuaState.status = 'connected';
    opcuaState.lastError = null;

    if (!monitoredNodes.length) {
        return;
    }

    activeSubscription = ClientSubscription.create(activeSession, {
        requestedPublishingInterval: Number(process.env.OPCUA_PUBLISHING_INTERVAL_MS || DEFAULT_PUBLISHING_INTERVAL_MS),
        requestedLifetimeCount: 60,
        requestedMaxKeepAliveCount: 10,
        maxNotificationsPerPublish: 100,
        publishingEnabled: true,
        priority: 1
    });

    activeSubscription.on('started', () => {
        opcuaState.status = 'subscribed';
    });

    activeSubscription.on('terminated', () => {
        opcuaState.status = 'disconnected';
        scheduleReconnect(redisClient);
    });

    for (const [index, nodeConfig] of monitoredNodes.entries()) {
        if (!nodeConfig || !nodeConfig.nodeId) {
            continue;
        }

        const seriesKey = nodeConfig.seriesKey || [
            sanitizeKeyPart(nodeConfig.deviceId || 'opcua'),
            sanitizeKeyPart(nodeConfig.metric || `node_${index + 1}`),
            'value'
        ].filter(Boolean).join(':');

        const monitoredItem = ClientMonitoredItem.create(
            activeSubscription,
            {
                nodeId: nodeConfig.nodeId,
                attributeId: AttributeIds.Value
            },
            {
                samplingInterval: Number(nodeConfig.samplingInterval || process.env.OPCUA_SAMPLING_INTERVAL_MS || DEFAULT_PUBLISHING_INTERVAL_MS),
                discardOldest: true,
                queueSize: Number(nodeConfig.queueSize || 10)
            },
            TimestampsToReturn.Both
        );

        monitoredItem.on('changed', async (dataValue) => {
            const value = dataValue && dataValue.value ? dataValue.value.value : null;
            const timestamp = (dataValue && dataValue.sourceTimestamp instanceof Date)
                ? dataValue.sourceTimestamp.getTime()
                : Date.now();

            opcuaState.lastValueAt = new Date(timestamp).toISOString();

            try {
                await persistReading(redisClient, {
                    seriesKey,
                    value,
                    timestamp
                });
            } catch (err) {
                opcuaState.lastError = `Redis write failed for ${seriesKey}: ${err.message}`;
            }
        });
    }
}

async function startOpcUaConnector({ redisClient } = {}) {
    const endpointUrl = process.env.OPCUA_ENDPOINT;

    if (!endpointUrl) {
        opcuaState.status = 'disabled';
        opcuaState.endpoint = null;
        opcuaState.monitoredNodes = [];
        return { success: false, skipped: true, reason: 'OPCUA_ENDPOINT is not configured' };
    }

    const monitoredNodes = parseMonitoredNodes();

    cleanupConnection();
    shuttingDown = false;
    opcuaState.status = 'connecting';
    opcuaState.lastError = null;

    try {
        await connectMonitoredNodes(redisClient, monitoredNodes);
        return {
            success: true,
            status: opcuaState.status,
            monitoredNodes: monitoredNodes.length
        };
    } catch (err) {
        opcuaState.status = 'error';
        opcuaState.lastError = err.message;
        cleanupConnection();
        scheduleReconnect(redisClient);
        throw err;
    }
}

async function stopOpcUaConnector() {
    shuttingDown = true;
    cleanupConnection();
    opcuaState.status = 'stopped';
}

module.exports = {
    opcuaState,
    startOpcUaConnector,
    stopOpcUaConnector
};