/**
 * Playwright fixtures for Chrome extension e2e testing.
 */

import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { startTestServer, type TestServer } from '../support/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '../..');
const EXTENSION_PATH = join(PROJECT_ROOT, 'dist', 'chrome');
const FIXTURES_PATH = join(PROJECT_ROOT, 'tests', 'fixtures');

// Worker-scoped fixtures (shared across all tests in a worker)
export interface WorkerFixtures {
	extensionContext: BrowserContext;
	testServer: TestServer;
}

// Test-scoped fixtures
export interface TestFixtures {
	extensionId: string;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
	testServer: [
		async ({}, use) => {
			const server = await startTestServer(FIXTURES_PATH);
			console.log(`Test server started at ${server.url}`);
			await use(server);
			// Close server with timeout to avoid hanging
			try {
				await Promise.race([
					server.close(),
					new Promise<void>((resolve) => setTimeout(resolve, 1000)),
				]);
				console.log('Test server stopped');
			} catch {
				console.log('Test server cleanup completed');
			}
		},
		{ scope: 'worker' },
	],

	// Browser context with extension loaded
	extensionContext: [
		async ({}, use) => {
			if (!existsSync(EXTENSION_PATH)) {
				throw new Error(
					`Extension not built. Run "pnpm build:chrome" first.\nExpected: ${EXTENSION_PATH}`,
				);
			}

			// Launch browser with extension using persistent context
			const context = await chromium.launchPersistentContext('', {
				headless: false, // Extensions require headed mode
				args: [
					`--disable-extensions-except=${EXTENSION_PATH}`,
					`--load-extension=${EXTENSION_PATH}`,
					'--no-sandbox',
					'--disable-setuid-sandbox',
					'--disable-dev-shm-usage',
				],
				viewport: { width: 1280, height: 720 },
			});

			// Wait for service worker to start
			let serviceWorkerUrl: string | null = null;
			for (let i = 0; i < 30 && !serviceWorkerUrl; i++) {
				await new Promise((r) => setTimeout(r, 200));
				const workers = context.serviceWorkers();
				const extensionWorker = workers.find((w) => w.url().includes('chrome-extension://'));
				if (extensionWorker) {
					serviceWorkerUrl = extensionWorker.url();
				}
			}

			if (!serviceWorkerUrl) {
				await context.close();
				throw new Error('Extension service worker did not start');
			}

			console.log('Extension service worker started');

			// Force all shadow DOMs to be open for testing
			// This allows Playwright to see inside the wallet selector modal
			await context.addInitScript(() => {
				const originalAttachShadow = Element.prototype.attachShadow;
				Element.prototype.attachShadow = function attachShadow(options) {
					return originalAttachShadow.call(this, { ...options, mode: 'open' });
				};
			});

			// Warm up extension by loading popup
			const extensionId = serviceWorkerUrl.split('/')[2];
			const pages = context.pages();
			const warmupPage = pages[0] || (await context.newPage());
			try {
				await warmupPage.goto(`chrome-extension://${extensionId}/popup.html`, {
					waitUntil: 'domcontentloaded',
					timeout: 5000,
				});
				await warmupPage.waitForTimeout(300);
				console.log('Extension warmed up');
			} catch (e) {
				console.warn('Could not warm up extension:', e);
			}

			await use(context);
			await context.close();
		},
		{ scope: 'worker' },
	],

	extensionId: async ({ extensionContext }, use) => {
		const workers = extensionContext.serviceWorkers();
		const extensionWorker = workers.find((w) => w.url().includes('chrome-extension://'));
		if (!extensionWorker) {
			throw new Error('No extension service worker found');
		}
		const extensionId = extensionWorker.url().split('/')[2];

		// Clear extension storage before each test for isolation
		await extensionWorker.evaluate(() => {
			return chrome.storage.local.clear();
		});

		await use(extensionId);
	},

	page: async ({ extensionContext, extensionId, testServer }, use) => {
		// extensionId fixture clears storage before each test
		void extensionId; // Ensure dependency is satisfied
		const page = await extensionContext.newPage();
		await page.goto(testServer.url, { waitUntil: 'domcontentloaded' });
		await use(page);
		await page.close();
	},
});

export { expect } from '@playwright/test';
