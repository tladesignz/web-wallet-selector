/**
 * E2E tests for extension loading and API exposure.
 */

import { test, expect } from './fixtures';

test.describe('Extension Loading', () => {
	test('extension service worker should start', async ({ extensionId }) => {
		expect(extensionId).toBeTruthy();
		expect(extensionId).toMatch(/^[a-z]{32}$/);
	});

	test('extension popup should be accessible', async ({ extensionContext, extensionId }) => {
		const page = await extensionContext.newPage();
		await page.goto(`chrome-extension://${extensionId}/popup.html`);
		await expect(page.locator('body')).toBeVisible();
		await page.close();
	});

	test('extension options page should be accessible', async ({ extensionContext, extensionId }) => {
		const page = await extensionContext.newPage();
		await page.goto(`chrome-extension://${extensionId}/options.html`);
		await expect(page.locator('body')).toBeVisible();
		await page.close();
	});
});

test.describe('WalletCompanion API Exposure', () => {
	test('should expose window.WalletCompanion on web pages', async ({ page, testServer }) => {
		await page.goto(`${testServer.url}/index.html`);

		await page.waitForFunction(
			() => typeof (window as any).WalletCompanion !== 'undefined',
			{ timeout: 5000 },
		);

		const hasAPI = await page.evaluate(() => {
			return typeof (window as any).WalletCompanion === 'object';
		});
		expect(hasAPI).toBe(true);
	});

	test('WalletCompanion.isInstalled should be true', async ({ page, testServer }) => {
		await page.goto(`${testServer.url}/index.html`);

		await page.waitForFunction(
			() => typeof (window as any).WalletCompanion !== 'undefined',
			{ timeout: 5000 },
		);

		const isInstalled = await page.evaluate(() => {
			return (window as any).WalletCompanion?.isInstalled;
		});
		expect(isInstalled).toBe(true);
	});

	test('WalletCompanion.version should be a string', async ({ page, testServer }) => {
		await page.goto(`${testServer.url}/index.html`);

		await page.waitForFunction(
			() => typeof (window as any).WalletCompanion !== 'undefined',
			{ timeout: 5000 },
		);

		const version = await page.evaluate(() => {
			return (window as any).WalletCompanion?.version;
		});
		expect(typeof version).toBe('string');
	});

	test('WalletCompanion.supportedProtocols should be an array', async ({ page, testServer }) => {
		await page.goto(`${testServer.url}/index.html`);

		await page.waitForFunction(
			() => typeof (window as any).WalletCompanion !== 'undefined',
			{ timeout: 5000 },
		);

		const supportedProtocols = await page.evaluate(() => {
			return (window as any).WalletCompanion?.supportedProtocols;
		});
		expect(Array.isArray(supportedProtocols)).toBe(true);
	});

	test('WalletCompanion should expose expected methods', async ({ page, testServer }) => {
		await page.goto(`${testServer.url}/index.html`);

		await page.waitForFunction(
			() => typeof (window as any).WalletCompanion !== 'undefined',
			{ timeout: 5000 },
		);

		const api = await page.evaluate(() => {
			const wc = (window as any).WalletCompanion;
			return {
				registerWallet: typeof wc?.registerWallet,
				isWalletRegistered: typeof wc?.isWalletRegistered,
			};
		});

		expect(api.registerWallet).toBe('function');
		expect(api.isWalletRegistered).toBe('function');
	});
});
