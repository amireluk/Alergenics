/**
 * Alergenics — Playwright E2E Tests
 *
 * Run:  npx playwright test
 * UI:   npx playwright test --ui
 *
 * The test suite spins up a local static server on port 3333 (via `serve`)
 * pointing at the `frontend/` directory. All calls to the Azure Functions API
 * are intercepted with page.route() mocks so tests are fully offline.
 *
 * Test groups:
 *  - App loads          : basic page load, no JS errors, landing view visible
 *  - Tracker flow       : create tracker, join by code, validation, 404 error
 *  - Agenda view        : section headings, allergen cards, leave tracker
 *  - Settings view      : open settings, allergen grid count, confirm returns to agenda
 *  - API indicator      : gear element present in agenda header
 */

const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Helper: attach listeners that collect JS console errors and page crashes.
// Call before page.goto() so nothing is missed.
// ---------------------------------------------------------------------------
async function collectErrors(page) {
    const errors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });
    page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
    page.on('requestfailed', req => {
        // Ignore expected network failures to the real Azure API —
        // those are mocked in most tests but this listener fires before mocks.
        if (!req.url().includes('alergenics-api')) {
            errors.push(`requestfailed: ${req.url()} — ${req.failure()?.errorText}`);
        }
    });
    return errors;
}

// ---------------------------------------------------------------------------
// App loads
// ---------------------------------------------------------------------------
test.describe('App loads', () => {
    test('page loads without JS errors', async ({ page }) => {
        const errors = await collectErrors(page);
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        expect(errors, `JS errors on load:\n${errors.join('\n')}`).toHaveLength(0);
    });

    test('shows tracker landing view on first visit', async ({ page }) => {
        // Clear localStorage so the app has no saved tracker ID
        await page.addInitScript(() => localStorage.clear());
        await page.goto('/');
        await expect(page.locator('#view-tracker-landing')).toBeVisible();
        await expect(page.locator('#view-agenda')).toBeHidden();
    });

    test('has Create and Join buttons', async ({ page }) => {
        await page.addInitScript(() => localStorage.clear());
        await page.goto('/');
        await expect(page.locator('#btn-create-tracker')).toBeVisible();
        await expect(page.locator('#btn-show-join')).toBeVisible();
        // Join form is hidden until btn-show-join is clicked
        await expect(page.locator('#join-form')).toBeHidden();
        await page.click('#btn-show-join');
        await expect(page.locator('#input-tracker-id')).toBeVisible();
        await expect(page.locator('#btn-join-tracker')).toBeVisible();
    });
});

// ---------------------------------------------------------------------------
// Tracker join / create flow
// ---------------------------------------------------------------------------
test.describe('Tracker join/create flow', () => {
    test('shows error for short tracker code', async ({ page }) => {
        await page.addInitScript(() => localStorage.clear());
        await page.goto('/');
        await page.click('#btn-show-join');
        await page.fill('#input-tracker-id', 'AB'); // too short (< 6 chars)
        await page.click('#btn-join-tracker');
        const error = page.locator('#tracker-error');
        await expect(error).toBeVisible({ timeout: 3000 });
        await expect(error).toContainText('6');
    });

    test('join with valid code calls API and shows agenda on success', async ({ page }) => {
        await page.addInitScript(() => localStorage.clear());

        // Mock GET /api/trackers/TEST01 → success
        await page.route('**/api/trackers/TEST01', route =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ id: 'TEST01', allergens: [] }),
            })
        );

        await page.goto('/');
        await page.click('#btn-show-join');
        await page.fill('#input-tracker-id', 'TEST01');
        await page.click('#btn-join-tracker');

        await expect(page.locator('#view-agenda')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#view-tracker-landing')).toBeHidden();
        await expect(page.locator('#tracker-id-display')).toContainText('TEST01');
    });

    test('shows error when joining non-existent tracker', async ({ page }) => {
        await page.addInitScript(() => localStorage.clear());

        // Mock GET /api/trackers/NOPE99 → 404
        await page.route('**/api/trackers/NOPE99', route =>
            route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not found' }) })
        );

        await page.goto('/');
        await page.click('#btn-show-join');
        await page.fill('#input-tracker-id', 'NOPE99');
        await page.click('#btn-join-tracker');

        const error = page.locator('#tracker-error');
        await expect(error).toBeVisible({ timeout: 3000 });
        await expect(error).toContainText('נמצא'); // Hebrew: "not found"
    });

    test('create tracker calls POST and enters agenda', async ({ page }) => {
        await page.addInitScript(() => localStorage.clear());

        // Mock POST /api/trackers → returns new tracker ID
        await page.route('**/api/trackers', route => {
            if (route.request().method() === 'POST') {
                return route.fulfill({
                    status: 201,
                    contentType: 'application/json',
                    body: JSON.stringify({ trackerId: 'ABC123' }),
                });
            }
            return route.continue();
        });
        // Mock the GET that follows immediately in enterTracker()
        await page.route('**/api/trackers/ABC123', route =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ id: 'ABC123', allergens: [] }),
            })
        );

        await page.goto('/');
        await page.click('#btn-create-tracker');

        await expect(page.locator('#view-agenda')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#tracker-id-display')).toContainText('ABC123');
    });
});

// ---------------------------------------------------------------------------
// Agenda view
// Shared setup: seed localStorage with a tracker ID and mock the API
// to return two allergens both due today.
// ---------------------------------------------------------------------------
test.describe('Agenda view', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('alergenics_tracker_id', 'SEED01');
        });
        await page.route('**/api/trackers/SEED01', route =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'SEED01',
                    allergens: [
                        { id: 1, name: 'חלב', freqValue: 3, freqUnit: 'days', lastDone: null, nextDue: new Date().toISOString() },
                        { id: 2, name: 'ביצים', freqValue: 7, freqUnit: 'days', lastDone: null, nextDue: new Date().toISOString() },
                    ],
                }),
            })
        );
    });

    test('shows agenda section titles (היום / מחר / בהמשך)', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('.agenda-section-title').first()).toBeVisible({ timeout: 5000 });
        const titles = await page.locator('.agenda-section-title').allTextContents();
        expect(titles.some(t => t.includes('היום'))).toBeTruthy();
        expect(titles.some(t => t.includes('מחר'))).toBeTruthy();
        expect(titles.some(t => t.includes('בהמשך'))).toBeTruthy();
    });

    test('allergens appear as cards in the agenda', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('.action-card').first()).toBeVisible({ timeout: 5000 });
        const cardText = await page.locator('.action-card').first().innerText();
        expect(cardText.length).toBeGreaterThan(0);
    });

    test('leave tracker returns to landing screen', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#view-agenda')).toBeVisible({ timeout: 5000 });
        await page.click('#btn-leave-tracker');
        await expect(page.locator('#view-tracker-landing')).toBeVisible({ timeout: 3000 });
    });
});

// ---------------------------------------------------------------------------
// Settings view
// ---------------------------------------------------------------------------
test.describe('Settings view', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('alergenics_tracker_id', 'SEED01');
        });
        await page.route('**/api/trackers/SEED01', route =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ id: 'SEED01', allergens: [] }),
            })
        );
    });

    test('settings button opens allergen grid', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#view-agenda')).toBeVisible({ timeout: 5000 });
        await page.click('#btn-open-settings');
        await expect(page.locator('#view-track')).toBeVisible({ timeout: 3000 });
        await expect(page.locator('.btn-allergen-toggle').first()).toBeVisible();
    });

    test('allergen grid shows all MoH allergens (≥ 20)', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#view-agenda')).toBeVisible({ timeout: 5000 });
        await page.click('#btn-open-settings');
        // Wait for grid to render before counting
        await expect(page.locator('.btn-allergen-toggle').first()).toBeVisible({ timeout: 3000 });
        const count = await page.locator('.btn-allergen-toggle').count();
        expect(count).toBeGreaterThanOrEqual(20);
    });

    test('confirm button returns to agenda', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#view-agenda')).toBeVisible({ timeout: 5000 });
        await page.click('#btn-open-settings');
        await expect(page.locator('#view-track')).toBeVisible({ timeout: 3000 });
        await page.click('#btn-finish-manage');
        await expect(page.locator('#view-agenda')).toBeVisible({ timeout: 3000 });
    });
});

// ---------------------------------------------------------------------------
// API indicator
// ---------------------------------------------------------------------------
test.describe('API indicator', () => {
    test('gear indicator element is present in the agenda header', async ({ page }) => {
        await page.addInitScript(() => localStorage.clear());
        await page.goto('/');
        // Element exists in DOM (hidden by default via CSS opacity:0)
        await expect(page.locator('#api-indicator')).toBeAttached();
    });
});
