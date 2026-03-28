const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    timeout: 15000,
    use: {
        baseURL: 'http://localhost:3333',
        headless: true,
    },
    webServer: {
        command: 'npx serve frontend -p 3333 --no-clipboard',
        port: 3333,
        reuseExistingServer: true,
    },
    reporter: 'list',
});
