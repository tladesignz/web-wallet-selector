import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for e2e tests with Chrome extension.
 *
 * Note: Chrome extension testing requires a persistent context, which is
 * set up in the test fixtures (tests/e2e/fixtures.ts).
 */
export default defineConfig({
	testDir: './tests/e2e',
	testMatch: '**/*.spec.ts',
	fullyParallel: false, // Extension tests need sequential execution
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: process.env.CI ? 'dot' : 'list',
	use: {
		baseURL: 'http://127.0.0.1:3456',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
	timeout: 30000,
	expect: {
		timeout: 5000,
	},
	globalSetup: undefined, // Will use fixtures for setup
	globalTeardown: undefined,
});
