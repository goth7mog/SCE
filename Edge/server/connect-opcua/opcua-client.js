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
const MAX_RECONNECT_DELAY_MS = 60000;
const DEFAULT_PUBLISHING_INTERVAL_MS = 1000;

function sanitizeKeyPart(value) {
    return String(value || '')
        .trim()
        .replace(/[^a-zA-Z0-9:_-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function parsePositiveInt(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

class OpcUaConnector {
    constructor() {
        this.state = {
            status: 'disabled',
            endpoint: null,
            monitoredNodes: [],
            lastError: null,
            lastValueAt: null,
            reconnectAttempts: 0
        };

        this.redisClient = null;
        this.client = null;
        this.session = null;
        this.subscription = null;
        this.reconnectTimer = null;
        this.shuttingDown = false;
        this.connecting = false;
    }

    async start({ redisClient } = {}) {
        const endpointUrl = process.env.OPCUA_ENDPOINT;

        if (!endpointUrl) {
            this.state.status = 'disabled';
            this.state.endpoint = null;
            this.state.monitoredNodes = [];
            return { success: false, skipped: true, reason: 'OPCUA_ENDPOINT is not configured' };
        }

        if (this.connecting) {
            return { success: false, skipped: true, reason: 'OPC UA connector is already connecting' };
        }

        this.redisClient = redisClient;
        const monitoredNodes = parseMonitoredNodes();

        this.cleanup();
        this.shuttingDown = false;
        this.connecting = true;
        this.state.status = 'connecting';
        this.state.lastError = null;

        try {
            await this.connect(monitoredNodes);
            this.state.reconnectAttempts = 0;
            return {
                success: true,
                status: this.state.status,
                monitoredNodes: monitoredNodes.length
            };
        } catch (err) {
            this.state.status = 'error';
            this.state.lastError = err.message;
            this.cleanup();
            this.scheduleReconnect();
            return {
                success: false,
                error: err.message,
                monitoredNodes: monitoredNodes.length
            };
        } finally {
            this.connecting = false;
        }
    }

    async stop() {
        this.shuttingDown = true;
        this.cleanup();
        this.state.status = 'stopped';
    }

    cleanup() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.subscription) {
            try {
                this.subscription.terminate();
            } catch (err) {
                // best effort cleanup
            }
            this.subscription = null;
        }

        if (this.session) {
            try {
                this.session.close();
            } catch (err) {
                // best effort cleanup
            }
            this.session = null;
        }

        if (this.client) {
            try {
                this.client.disconnect();
            } catch (err) {
                // best effort cleanup
            }
            this.client = null;
        }
    }

    scheduleReconnect() {
        if (this.shuttingDown || this.reconnectTimer) {
            return;
        }

        this.state.status = 'reconnecting';
        this.state.reconnectAttempts += 1;

        const backoff = Math.min(
            DEFAULT_RECONNECT_DELAY_MS * 2 ** (this.state.reconnectAttempts - 1),
            MAX_RECONNECT_DELAY_MS
        );
        const jitter = Math.floor(Math.random() * 1000);

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.start({ redisClient: this.redisClient }).catch(err => {
                this.state.lastError = err.message;
            });
        }, backoff + jitter);
    }

    async persistReading(reading) {
        if (!this.redisClient) {
            return;
        }

        const redisKey = reading.seriesKey;
        const latestKey = `${redisKey}:latest`;
        const valueAsString = String(reading.value);

        if (Number.isFinite(reading.value)) {
            await this.redisClient.sendCommand([
                'TS.ADD',
                redisKey,
                String(reading.timestamp),
                valueAsString
            ]);
        }

        await this.redisClient.sendCommand([
            'SET',
            latestKey,
            valueAsString
        ]);
    }

    async connect(monitoredNodes) {
        const endpointUrl = process.env.OPCUA_ENDPOINT;
        const username = process.env.OPCUA_USERNAME;
        const password = process.env.OPCUA_PASSWORD;
        const client = OPCUAClient.create(buildClientOptions());

        this.client = client;
        this.state.endpoint = endpointUrl;
        this.state.monitoredNodes = monitoredNodes;

        client.on('connection_lost', () => {
            this.state.status = 'disconnected';
            this.scheduleReconnect();
        });

        client.on('backoff', (retryNumber, delay) => {
            this.state.status = 'reconnecting';
            this.state.lastError = `OPC UA reconnect attempt ${retryNumber} in ${delay}ms`;
        });

        await client.connect(endpointUrl);

        this.session = username
            ? await client.createSession({ userName: username, password })
            : await client.createSession();

        this.state.status = 'connected';
        this.state.lastError = null;

        if (!monitoredNodes.length) {
            return;
        }

        this.subscription = ClientSubscription.create(this.session, {
            requestedPublishingInterval: parsePositiveInt(process.env.OPCUA_PUBLISHING_INTERVAL_MS, DEFAULT_PUBLISHING_INTERVAL_MS),
            requestedLifetimeCount: 60,
            requestedMaxKeepAliveCount: 10,
            maxNotificationsPerPublish: 100,
            publishingEnabled: true,
            priority: 1
        });

        this.subscription.on('started', () => {
            this.state.status = 'subscribed';
        });

        this.subscription.on('terminated', () => {
            if (this.shuttingDown) {
                return;
            }
            this.state.status = 'disconnected';
            this.scheduleReconnect();
        });

        monitoredNodes.forEach((nodeConfig, index) => this.monitorNode(nodeConfig, index));
    }

    monitorNode(nodeConfig, index) {
        if (!nodeConfig || !nodeConfig.nodeId) {
            this.state.lastError = `Skipped invalid monitored node at index ${index}: missing nodeId`;
            return;
        }

        const seriesKey = nodeConfig.seriesKey || [
            sanitizeKeyPart(nodeConfig.deviceId || 'opcua'),
            sanitizeKeyPart(nodeConfig.metric || `node_${index + 1}`),
            'value'
        ].filter(Boolean).join(':');

        const monitoredItem = ClientMonitoredItem.create(
            this.subscription,
            {
                nodeId: nodeConfig.nodeId,
                attributeId: AttributeIds.Value
            },
            {
                samplingInterval: parsePositiveInt(nodeConfig.samplingInterval || process.env.OPCUA_SAMPLING_INTERVAL_MS, DEFAULT_PUBLISHING_INTERVAL_MS),
                discardOldest: true,
                queueSize: parsePositiveInt(nodeConfig.queueSize, 10)
            },
            TimestampsToReturn.Both
        );

        monitoredItem.on('err', (message) => {
            this.state.lastError = `Monitored item error for ${seriesKey}: ${message}`;
        });

        monitoredItem.on('changed', async (dataValue) => {
            if (dataValue && dataValue.statusCode && !dataValue.statusCode.isGood()) {
                this.state.lastError = `Bad status (${dataValue.statusCode.toString()}) for ${seriesKey}`;
                return;
            }

            const value = dataValue && dataValue.value ? dataValue.value.value : null;
            if (value === null || value === undefined) {
                return;
            }

            const timestamp = (dataValue && dataValue.sourceTimestamp instanceof Date)
                ? dataValue.sourceTimestamp.getTime()
                : Date.now();

            this.state.lastValueAt = new Date(timestamp).toISOString();

            try {
                await this.persistReading({ seriesKey, value, timestamp });
            } catch (err) {
                this.state.lastError = `Redis write failed for ${seriesKey}: ${err.message}`;
            }
        });
    }
}

module.exports = new OpcUaConnector();