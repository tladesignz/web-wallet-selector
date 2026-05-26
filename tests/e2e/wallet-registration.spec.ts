/**
 * E2E tests for wallet registration flow.
 *
 * Tests wallet registration using the mock-wallet.html fixture.
 * Verifies that wallets can register themselves with the extension
 * via the WalletCompanion.registerWallet() API.
 */

import { test, expect } from './fixtures';

// Type definitions for mock wallet API
interface MockWalletState {
	extensionReady: boolean;
	registered: boolean;
	walletId: string | null;
	currentRequest: unknown | null;
	requestError: string | null;
	canRespond: boolean;
}

interface MockWalletConfig {
	name: string;
	url: string;
	protocols: string[];
	description?: string;
}

interface RegistrationResult {
	success: boolean;
	alreadyRegistered: boolean;
	wallet?: {
		id: string;
		name: string;
		url: string;
	};
}

test.describe('Wallet Registration', () => {
	test('mock wallet page should detect extension', async ({ page, testServer }) => {
		await page.goto(`${testServer.url}/mock-wallet.html?auto-register=false`);

		await page.waitForFunction(
			() => {
				const w = window as { mockWallet?: { state?: MockWalletState } };
				return w.mockWallet?.state !== undefined;
			},
			{ timeout: 5000 },
		);

		const state = await page.evaluate(() => {
			const w = window as { mockWallet?: { state?: MockWalletState } };
			return w.mockWallet?.state;
		});

		expect(state?.extensionReady).toBe(true);
	});

	test('should register wallet via mockWallet.register()', async ({ page, testServer }) => {
		await page.goto(`${testServer.url}/mock-wallet.html?auto-register=false`);

		await page.waitForFunction(
			() => {
				const w = window as { mockWallet?: { state?: MockWalletState } };
				return w.mockWallet?.state?.extensionReady === true;
			},
			{ timeout: 5000 },
		);

		// Fixture's register() updates state but doesn't return result
		await page.evaluate(async () => {
			const w = window as { mockWallet?: { register: () => Promise<void> } };
			await w.mockWallet?.register();
		});

		await page.waitForFunction(
			() => {
				const w = window as { mockWallet?: { state?: MockWalletState } };
				return w.mockWallet?.state?.registered === true;
			},
			{ timeout: 5000 },
		);

		const state = await page.evaluate(() => {
			const w = window as { mockWallet?: { state?: MockWalletState } };
			return w.mockWallet?.state;
		});

		expect(state?.registered).toBe(true);
		expect(state?.walletId).toBeTruthy();
		expect(state?.walletId).toMatch(/^wallet-/);
	});

	test('should register wallet with auto-register URL parameter', async ({ page, testServer }) => {
		await page.goto(`${testServer.url}/mock-wallet.html?auto-register=true`);

		await page.waitForFunction(
			() => {
				const w = window as { mockWallet?: { state?: MockWalletState } };
				return w.mockWallet?.state?.registered === true;
			},
			{ timeout: 5000 },
		);

		const state = await page.evaluate(() => {
			const w = window as { mockWallet?: { state?: MockWalletState } };
			return w.mockWallet?.state;
		});

		expect(state?.registered).toBe(true);
		expect(state?.walletId).toBeTruthy();
	});

	test('should detect duplicate registration', async ({ page, testServer }) => {
		await page.goto(`${testServer.url}/mock-wallet.html?auto-register=false`);

		await page.waitForFunction(
			() => {
				const w = window as { mockWallet?: { state?: MockWalletState } };
				return w.mockWallet?.state?.extensionReady === true;
			},
			{ timeout: 5000 },
		);

		await page.evaluate(async () => {
			const w = window as { mockWallet?: { register: () => Promise<void> } };
			await w.mockWallet?.register();
		});

		await page.waitForFunction(
			() => {
				const w = window as { mockWallet?: { state?: MockWalletState } };
				return w.mockWallet?.state?.registered === true;
			},
			{ timeout: 5000 },
		);

		const firstWalletId = await page.evaluate(() => {
			const w = window as { mockWallet?: { state?: MockWalletState } };
			return w.mockWallet?.state?.walletId;
		});
		expect(firstWalletId).toBeTruthy();

		// Reset local state but keep extension-side registration
		await page.evaluate(() => {
			const w = window as { mockWallet?: { reset: () => void } };
			w.mockWallet?.reset();
		});

		// Re-register same wallet URL - should detect as already registered
		await page.evaluate(async () => {
			const w = window as { mockWallet?: { register: () => Promise<void> } };
			await w.mockWallet?.register();
		});

		await page.waitForFunction(
			() => {
				const w = window as { mockWallet?: { state?: MockWalletState } };
				return w.mockWallet?.state?.registered === true;
			},
			{ timeout: 5000 },
		);

		const secondWalletId = await page.evaluate(() => {
			const w = window as { mockWallet?: { state?: MockWalletState } };
			return w.mockWallet?.state?.walletId;
		});
		expect(secondWalletId).toBe(firstWalletId);
	});

	test('should verify wallet is registered via isWalletRegistered()', async ({ page, testServer }) => {
		await page.goto(`${testServer.url}/mock-wallet.html?auto-register=false`);

		await page.waitForFunction(
			() => {
				const w = window as { mockWallet?: { state?: MockWalletState } };
				return w.mockWallet?.state?.extensionReady === true;
			},
			{ timeout: 5000 },
		);

		await page.evaluate(async () => {
			const w = window as { mockWallet?: { register: () => Promise<RegistrationResult> } };
			return await w.mockWallet?.register();
		});

		const isRegistered = await page.evaluate(async () => {
			const wc = (window as { WalletCompanion?: { isWalletRegistered: (url: string) => Promise<boolean> } }).WalletCompanion;
			const walletUrl = window.location.origin + window.location.pathname;
			return await wc?.isWalletRegistered(walletUrl);
		});

		expect(isRegistered).toBe(true);
	});

	test('should reject registration with invalid configuration', async ({ page, testServer }) => {
		await page.goto(`${testServer.url}/mock-wallet.html?auto-register=false`);

		await page.waitForFunction(
			() => typeof (window as { WalletCompanion?: object }).WalletCompanion !== 'undefined',
			{ timeout: 5000 },
		);

		const error = await page.evaluate(async () => {
			try {
				const wc = (window as { WalletCompanion?: { registerWallet: (config: Partial<MockWalletConfig>) => Promise<unknown> } }).WalletCompanion;
				await wc?.registerWallet({ name: 'Test' }); // Missing url and protocols
				return null;
			} catch (e) {
				return e instanceof Error ? e.message : String(e);
			}
		});

		expect(error).toBeTruthy();
		expect(error).toContain('url');
	});

	test('should reject registration with invalid protocol identifiers', async ({ page, testServer }) => {
		await page.goto(`${testServer.url}/mock-wallet.html?auto-register=false`);

		await page.waitForFunction(
			() => typeof (window as { WalletCompanion?: object }).WalletCompanion !== 'undefined',
			{ timeout: 5000 },
		);

		const error = await page.evaluate(async () => {
			try {
				const wc = (window as { WalletCompanion?: { registerWallet: (config: MockWalletConfig) => Promise<unknown> } }).WalletCompanion;
				await wc?.registerWallet({
					name: 'Test Wallet',
					url: 'https://test.example.com',
					protocols: ['Invalid Protocol!'], // Invalid: contains uppercase and special chars
				});
				return null;
			} catch (e) {
				return e instanceof Error ? e.message : String(e);
			}
		});

		expect(error).toBeTruthy();
		expect(error).toContain('Invalid protocol');
	});
});

test.describe('Wallet State Management', () => {
	test('should preserve extension state after page reload', async ({ page, testServer }) => {
		await page.goto(`${testServer.url}/mock-wallet.html?auto-register=false`);

		await page.waitForFunction(
			() => {
				const w = window as { mockWallet?: { state?: MockWalletState } };
				return w.mockWallet?.state?.extensionReady === true;
			},
			{ timeout: 5000 },
		);

		await page.evaluate(async () => {
			const w = window as { mockWallet?: { register: () => Promise<RegistrationResult> } };
			return await w.mockWallet?.register();
		});

		await page.reload({ waitUntil: 'domcontentloaded' });

		await page.waitForFunction(
			() => {
				const w = window as { mockWallet?: { state?: MockWalletState } };
				return w.mockWallet?.state?.extensionReady === true;
			},
			{ timeout: 5000 },
		);

		const isRegistered = await page.evaluate(async () => {
			const wc = (window as { WalletCompanion?: { isWalletRegistered: (url: string) => Promise<boolean> } }).WalletCompanion;
			const walletUrl = window.location.origin + window.location.pathname;
			return await wc?.isWalletRegistered(walletUrl);
		});

		expect(isRegistered).toBe(true);
	});

	test('mockWallet.reset() should clear local state but preserve registration', async ({ page, testServer }) => {
		await page.goto(`${testServer.url}/mock-wallet.html?auto-register=false`);

		await page.waitForFunction(
			() => {
				const w = window as { mockWallet?: { state?: MockWalletState } };
				return w.mockWallet?.state?.extensionReady === true;
			},
			{ timeout: 5000 },
		);

		await page.evaluate(async () => {
			const w = window as { mockWallet?: { register: () => Promise<RegistrationResult> } };
			return await w.mockWallet?.register();
		});

		await page.evaluate(() => {
			const w = window as { mockWallet?: { reset: () => void } };
			w.mockWallet?.reset();
		});

		const localState = await page.evaluate(() => {
			const w = window as { mockWallet?: { state?: MockWalletState } };
			return w.mockWallet?.state;
		});
		expect(localState?.registered).toBe(false);

		// Extension-side registration persists
		const stillRegistered = await page.evaluate(async () => {
			const wc = (window as { WalletCompanion?: { isWalletRegistered: (url: string) => Promise<boolean> } }).WalletCompanion;
			const walletUrl = window.location.origin + window.location.pathname;
			return await wc?.isWalletRegistered(walletUrl);
		});
		expect(stillRegistered).toBe(true);
	});
});
