const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { DefaultAzureCredential } = require('@azure/identity');
const { nanoid } = require('nanoid');

// --- Cosmos DB setup (Managed Identity — no connection string needed in production) ---
let container;
function getContainer() {
    if (!container) {
        const client = process.env.COSMOS_CONNECTION_STRING
            ? new CosmosClient(process.env.COSMOS_CONNECTION_STRING)  // local dev fallback
            : new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, aadCredentials: new DefaultAzureCredential() });
        const database = client.database(process.env.COSMOS_DATABASE || 'alergenics');
        container = database.container(process.env.COSMOS_CONTAINER || 'trackers');
    }
    return container;
}

// --- Rate limiting (in-memory, per instance) ---
const rateLimits = new Map();

function checkRateLimit(ip, bucket, maxRequests, windowMs) {
    const key = `${bucket}:${ip}`;
    const now = Date.now();
    let entry = rateLimits.get(key);

    if (!entry || now - entry.windowStart > windowMs) {
        entry = { windowStart: now, count: 0 };
        rateLimits.set(key, entry);
    }

    entry.count++;
    return entry.count <= maxRequests;
}

// Clean up old entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimits) {
        if (now - entry.windowStart > 3600000) rateLimits.delete(key);
    }
}, 300000);

// --- Validation ---
function validateTracker(data) {
    if (!data || typeof data !== 'object') return 'Body must be a JSON object';
    if (!Array.isArray(data.allergens)) return 'allergens must be an array';
    if (data.allergens.length > 100) return 'Too many allergens (max 100)';

    for (const item of data.allergens) {
        if (typeof item.name !== 'string' || item.name.length === 0 || item.name.length > 100) {
            return 'Each allergen must have a name (string, 1-100 chars)';
        }
        if (typeof item.freqValue !== 'number' || item.freqValue < 1 || item.freqValue > 30) {
            return 'freqValue must be a number between 1 and 30';
        }
        if (item.lastDone !== null && typeof item.lastDone !== 'string') {
            return 'lastDone must be an ISO date string or null';
        }
        if (typeof item.nextDue !== 'string') {
            return 'nextDue must be an ISO date string';
        }
    }
    return null;
}

function getClientIp(request) {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown';
}

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };
}

// --- OPTIONS (CORS preflight) ---
app.http('trackersOptions', {
    methods: ['OPTIONS'],
    authLevel: 'anonymous',
    route: 'trackers/{id?}',
    handler: async () => {
        return { status: 204, headers: corsHeaders() };
    }
});

// --- POST /api/trackers ---
app.http('createTracker', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'trackers',
    handler: async (request, context) => {
        const ip = getClientIp(request);
        if (!checkRateLimit(ip, 'create', 5, 3600000)) {
            return {
                status: 429,
                headers: corsHeaders(),
                jsonBody: { error: 'Too many trackers created. Try again later.' }
            };
        }

        try {
            const trackerId = nanoid(6);
            const trackerData = {
                id: trackerId,
                allergens: [],
                createdAt: new Date().toISOString(),
            };
            await getContainer().items.create(trackerData);
            return {
                status: 201,
                headers: corsHeaders(),
                jsonBody: { trackerId }
            };
        } catch (err) {
            context.log('Create tracker error:', err);
            return {
                status: 500,
                headers: corsHeaders(),
                jsonBody: { error: 'Failed to create tracker' }
            };
        }
    }
});

// --- GET /api/trackers/:id ---
app.http('getTracker', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'trackers/{id}',
    handler: async (request, context) => {
        const ip = getClientIp(request);
        if (!checkRateLimit(ip, 'general', 30, 60000)) {
            return {
                status: 429,
                headers: corsHeaders(),
                jsonBody: { error: 'Too many requests. Slow down.' }
            };
        }

        const trackerId = request.params.id;
        try {
            const { resource } = await getContainer().item(trackerId, trackerId).read();
            if (!resource) {
                return {
                    status: 404,
                    headers: corsHeaders(),
                    jsonBody: { error: 'Tracker not found' }
                };
            }
            return {
                headers: corsHeaders(),
                jsonBody: { allergens: resource.allergens }
            };
        } catch (err) {
            if (err.code === 404) {
                return {
                    status: 404,
                    headers: corsHeaders(),
                    jsonBody: { error: 'Tracker not found' }
                };
            }
            context.log('Read tracker error:', err);
            return {
                status: 500,
                headers: corsHeaders(),
                jsonBody: { error: 'Failed to read tracker' }
            };
        }
    }
});

// --- PUT /api/trackers/:id ---
app.http('updateTracker', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'trackers/{id}',
    handler: async (request, context) => {
        const ip = getClientIp(request);
        if (!checkRateLimit(ip, 'general', 30, 60000)) {
            return {
                status: 429,
                headers: corsHeaders(),
                jsonBody: { error: 'Too many requests. Slow down.' }
            };
        }

        const trackerId = request.params.id;

        let body;
        try {
            body = await request.json();
        } catch {
            return {
                status: 400,
                headers: corsHeaders(),
                jsonBody: { error: 'Invalid JSON' }
            };
        }

        // Size check (~10KB)
        const bodyStr = JSON.stringify(body);
        if (bodyStr.length > 10240) {
            return {
                status: 400,
                headers: corsHeaders(),
                jsonBody: { error: 'Payload too large (max 10KB)' }
            };
        }

        const validationError = validateTracker(body);
        if (validationError) {
            return {
                status: 400,
                headers: corsHeaders(),
                jsonBody: { error: validationError }
            };
        }

        try {
            const { resource } = await getContainer().item(trackerId, trackerId).read();
            if (!resource) {
                return {
                    status: 404,
                    headers: corsHeaders(),
                    jsonBody: { error: 'Tracker not found' }
                };
            }

            resource.allergens = body.allergens;
            resource.updatedAt = new Date().toISOString();
            await getContainer().item(trackerId, trackerId).replace(resource);

            return {
                headers: corsHeaders(),
                jsonBody: { ok: true }
            };
        } catch (err) {
            if (err.code === 404) {
                return {
                    status: 404,
                    headers: corsHeaders(),
                    jsonBody: { error: 'Tracker not found' }
                };
            }
            context.log('Update tracker error:', err);
            return {
                status: 500,
                headers: corsHeaders(),
                jsonBody: { error: 'Failed to update tracker' }
            };
        }
    }
});

// --- Health check ---
app.http('health', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'health',
    handler: async () => {
        return { headers: corsHeaders(), jsonBody: { status: 'ok' } };
    }
});
