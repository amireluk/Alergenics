/**
 * Alergenics — API Integration Tests
 *
 * Plain Node.js, no test framework. Calls the live Azure Functions API.
 * Run:  node tests/api.test.js
 *
 * Uses a fixed test tracker (EvN9Df) that lives in Cosmos DB.
 * Override: TEST_TRACKER_ID=abc123 node tests/api.test.js
 */

const API_URL = 'https://alergenics-api-dubnd2d7d2ahfwfy.israelcentral-01.azurewebsites.net';

// ── helpers ────────────────────────────────────────────────────────────────

const trackerId = process.env.TEST_TRACKER_ID || 'EvN9Df';

async function GET(id) {
    const r = await fetch(`${API_URL}/api/trackers/${id ?? trackerId}`);
    return { status: r.status, body: await r.json() };
}

async function PUT(allergens) {
    const r = await fetch(`${API_URL}/api/trackers/${trackerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allergens }),
    });
    return { status: r.status, body: await r.json() };
}

function allergen(overrides = {}) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return { id: Date.now(), name: 'חלב', freqValue: 3, freqUnit: 'days',
             lastDone: null, nextDue: today.toISOString(), ...overrides };
}

let passed = 0, failed = 0;

async function test(name, fn) {
    try {
        await fn();
        console.log(`  ✓  ${name}`);
        passed++;
    } catch (e) {
        console.error(`  ✗  ${name}`);
        console.error(`     ${e.message}`);
        failed++;
    }
}

function assert(condition, msg) {
    if (!condition) throw new Error(msg || 'assertion failed');
}

function assertEqual(a, b, msg) {
    if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

// ── setup: verify tracker exists ──────────────────────────────────────────

async function ensureTracker() {
    const { status } = await GET(trackerId);
    if (status !== 200) throw new Error(`Test tracker "${trackerId}" not found in Cosmos DB (status ${status})`);
    console.log(`  tracker: ${trackerId}\n`);
}

// ── tests ──────────────────────────────────────────────────────────────────

async function run() {
    console.log('Alergenics API Tests\n');

    await ensureTracker();

    await test('health check returns ok', async () => {
        const r = await fetch(`${API_URL}/api/health`);
        assertEqual(r.status, 200);
        const body = await r.json();
        assertEqual(body.status, 'ok');
    });

    await test('GET tracker returns 200 and allergens array', async () => {
        const { status, body } = await GET();
        assertEqual(status, 200);
        assert(Array.isArray(body.allergens), 'allergens should be an array');
    });

    await test('reset tracker to empty', async () => {
        const { status, body } = await PUT([]);
        assertEqual(status, 200);
        assert(body.ok === true);
        const get = await GET();
        assertEqual(get.body.allergens.length, 0, 'should be empty after reset');
    });

    await test('add one allergen', async () => {
        const { status } = await PUT([allergen({ name: 'חלב', freqValue: 3 })]);
        assertEqual(status, 200);
        const get = await GET();
        assertEqual(get.body.allergens.length, 1);
        assertEqual(get.body.allergens[0].name, 'חלב');
        assertEqual(get.body.allergens[0].freqValue, 3);
    });

    await test('add second allergen', async () => {
        const { body: current } = await GET();
        const updated = [...current.allergens, allergen({ id: Date.now() + 1, name: 'ביצים', freqValue: 7 })];
        await PUT(updated);
        const get = await GET();
        assertEqual(get.body.allergens.length, 2);
        const names = get.body.allergens.map(a => a.name);
        assert(names.includes('חלב'), 'should contain חלב');
        assert(names.includes('ביצים'), 'should contain ביצים');
    });

    await test('remove one allergen (חלב)', async () => {
        const { body: current } = await GET();
        await PUT(current.allergens.filter(a => a.name !== 'חלב'));
        const get = await GET();
        assertEqual(get.body.allergens.length, 1);
        assertEqual(get.body.allergens[0].name, 'ביצים');
    });

    await test('mark allergen as done — updates lastDone and nextDue', async () => {
        const { body: current } = await GET();
        const a = current.allergens[0];
        const now = new Date();
        const nextDue = new Date(now);
        nextDue.setDate(now.getDate() + a.freqValue);
        nextDue.setHours(0, 0, 0, 0);

        await PUT([{ ...a, lastDone: now.toISOString(), nextDue: nextDue.toISOString() }]);

        const get = await GET();
        const saved = get.body.allergens[0];
        assert(saved.lastDone !== null, 'lastDone should be set');
        assertEqual(new Date(saved.nextDue).toDateString(), nextDue.toDateString(), 'nextDue mismatch');
    });

    await test('update cadence (freqValue)', async () => {
        const { body: current } = await GET();
        await PUT(current.allergens.map(a => ({ ...a, freqValue: 14 })));
        const get = await GET();
        assertEqual(get.body.allergens[0].freqValue, 14);
    });

    await test('add 20 allergens (stress)', async () => {
        const many = Array.from({ length: 20 }, (_, i) =>
            allergen({ id: i + 1, name: `אלרגן${i + 1}`, freqValue: (i % 7) + 1 })
        );
        const { status } = await PUT(many);
        assertEqual(status, 200);
        const get = await GET();
        assertEqual(get.body.allergens.length, 20);
    });

    await test('rejects freqValue out of range (999)', async () => {
        const { status, body } = await PUT([allergen({ freqValue: 999 })]);
        assertEqual(status, 400);
        assert(body.error.toLowerCase().includes('freqvalue'), `unexpected error: ${body.error}`);
    });

    await test('rejects empty allergen name', async () => {
        const { status, body } = await PUT([allergen({ name: '' })]);
        assertEqual(status, 400);
        assert(body.error.toLowerCase().includes('name'), `unexpected error: ${body.error}`);
    });

    await test('returns 404 for non-existent tracker', async () => {
        const { status } = await GET('XXXXXX');
        assertEqual(status, 404);
    });

    await test('cleanup — reset tracker to empty', async () => {
        const { status } = await PUT([]);
        assertEqual(status, 200);
        const get = await GET();
        assertEqual(get.body.allergens.length, 0);
    });

    // ── summary ──
    console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
