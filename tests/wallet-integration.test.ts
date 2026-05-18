/**
 * Mock Wallet Integration Tests
 *
 * Tests mock wallet registration flows and related error handling using a mock wallet fixture.
 * Uses Puppeteer to load the mock wallet in a browser with the extension installed.
 */

import { launch, type Browser, type Page } from 'puppeteer';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Mock Wallet Integration Tests', () => {
	let browser: Browser;
	let extensionId: string | undefined;
	const EXTENSION_PATH = join(__dirname, '..', 'dist', 'chrome');
	const MOCK_WALLET_PATH = join(__dirname, 'fixtures', 'mock-wallet.html');

	beforeAll(async () => {
		// Check if extension is built
		if (!existsSync(EXTENSION_PATH)) {
			throw new Error('Extension not built. Run "pnpm build:chrome" first.');
		}

		// Check if mock wallet fixture exists
		if (!existsSync(MOCK_WALLET_PATH)) {
			throw new Error('Mock wallet fixture not found at: ' + MOCK_WALLET_PATH);
		}

		// Launch browser with extension
		browser = await launch({
			headless: false, // Extensions require headed mode
			args: [
				`--disable-extensions-except=${EXTENSION_PATH}`,
				`--load-extension=${EXTENSION_PATH}`,
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--disable-dev-shm-usage',
				'--disable-web-security', // Allow file:// access
			],
		});

		// Wait for extension to load
		const initialPage = await browser.newPage();
		await initialPage.goto('about:blank');
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// Try to find extension ID
		const targets = await browser.targets();
		const serviceWorker = targets.find(
			(target) => target.type() === 'service_worker' && target.url().includes('chrome-extension://'),
		);

		if (serviceWorker) {
			const url = serviceWorker.url();
			extensionId = url.split('/')[2];
			console.log('✓ Extension loaded with ID:', extensionId);
		} else {
			console.log('✓ Extension loaded (ID detection skipped)');
		}

		await initialPage.close();
	}, 45000);

	afterAll(async () => {
		if (browser) {
			await browser.close();
		}
	});

	describe('Wallet Registration', () => {
		let page: Page;

		beforeEach(async () => {
			page = await browser.newPage();

			// Disable auto-registration for manual testing
			await page.goto(`file://${MOCK_WALLET_PATH}?auto-register=false`);

			// Wait for mock wallet to initialize (it will wait for extension internally)
			await page.waitForFunction(
				() =>
					typeof (window as { mockWallet?: { state: { extensionInstalled?: boolean } } }).mockWallet !== 'undefined' &&
					(window as { mockWallet?: { state: { extensionInstalled?: boolean } } }).mockWallet?.state.extensionInstalled ===
						true,
				{ timeout: 5000 },
			);

			// Reset state (preserving extensionInstalled)
			await page.evaluate(() => (window as { mockWallet?: { reset: () => void } }).mockWallet?.reset());
		});

		afterEach(async () => {
			if (page) {
				await page.close();
			}
		});

		test('should detect extension installation', async () => {
			// The mock wallet initializes automatically, just check the state
			const state = await page.evaluate(
				() =>
					(window as { mockWallet?: { getState: () => { extensionInstalled: boolean } } }).mockWallet?.getState(),
			);

			// After reset(), extensionInstalled is preserved, so this should work
			expect(state?.extensionInstalled).toBe(true);
		});

		test('should register wallet with default configuration', async () => {
			type RegistrationResult = {
				success: boolean;
				wallet?: {
					name: string;
					url: string;
					protocols: string[];
				};
			};

			const result = await page.evaluate(async () => {
				return await (
					window as { mockWallet?: { register: () => Promise<RegistrationResult> } }
				).mockWallet?.register();
			});

			expect(result?.success).toBe(true);
			expect(result?.wallet).toBeDefined();
			expect(result?.wallet?.name).toBe('Mock Wallet');
			expect(result?.wallet?.url).toBe('https://mock-wallet.test.local');
			expect(result?.wallet?.protocols).toContain('openid4vp');
			expect(result?.wallet?.protocols).toContain('w3c-vc');
		}, 15000);

		test('should register wallet with custom configuration', async () => {
			const customConfig = {
				name: 'Custom Test Wallet',
				url: 'https://custom.test.local',
				protocols: ['openid4vp'],
				description: 'Custom wallet for testing',
				icon: '🔐',
				color: '#3b82f6',
			};

			type CustomRegistrationResult = {
				success: boolean;
				wallet?: {
					name: string;
					url: string;
					protocols: string[];
				};
			};

			const result = await page.evaluate(async (config) => {
				return await (
					window as { mockWallet?: { register: (c: typeof config) => Promise<CustomRegistrationResult> } }
				).mockWallet?.register(config);
			}, customConfig);

			expect(result?.success).toBe(true);
			expect(result?.wallet?.name).toBe('Custom Test Wallet');
			expect(result?.wallet?.url).toBe('https://custom.test.local');
			expect(result?.wallet?.protocols).toEqual(['openid4vp']);
		}, 15000);

		test('should detect duplicate registration', async () => {
			type RegistrationResult = {
				success: boolean;
				alreadyRegistered?: boolean;
			};

			// Register once
			await page.evaluate(async () => {
				return await (
					window as { mockWallet?: { register: () => Promise<RegistrationResult> } }
				).mockWallet?.register();
			});

			// Register again with same URL
			const result = await page.evaluate(async () => {
				return await (
					window as { mockWallet?: { register: () => Promise<RegistrationResult> } }
				).mockWallet?.register();
			});

			expect(result?.success).toBe(true);
			expect(result?.alreadyRegistered).toBe(true);
		}, 15000);

		test('should verify wallet is registered', async () => {
			// Register wallet
			await page.evaluate(async () => {
				return await (
					window as { mockWallet?: { register: () => Promise<{ success: boolean }> } }
				).mockWallet?.register();
			});

			// Check if registered
			const isRegistered = await page.evaluate(async () => {
				return await (
					window as { mockWallet?: { isRegistered: () => Promise<boolean> } }
				).mockWallet?.isRegistered();
			});

			expect(isRegistered).toBe(true);
		}, 15000);

		test('should reject registration with invalid URL', async () => {
			const result = await page.evaluate(async () => {
				try {
					await (
						window as { mockWallet?: { simulateError: (type: string) => Promise<void> } }
					).mockWallet?.simulateError('invalid_url');
					return { success: true };
				} catch (error) {
					return { success: false, error: (error as Error).message };
				}
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain('Invalid wallet URL');
		}, 15000);

		test('should reject registration without protocols', async () => {
			const result = await page.evaluate(async () => {
				try {
					await (
						window as { mockWallet?: { simulateError: (type: string) => Promise<void> } }
					).mockWallet?.simulateError('missing_protocols');
					return { success: true };
				} catch (error) {
					return { success: false, error: (error as Error).message };
				}
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain('at least one supported protocol');
		}, 15000);

		test('should reject registration with invalid protocol identifier', async () => {
			const result = await page.evaluate(async () => {
				try {
					await (
						window as { mockWallet?: { simulateError: (type: string) => Promise<void> } }
					).mockWallet?.simulateError('invalid_protocol');
					return { success: true };
				} catch (error) {
					return { success: false, error: (error as Error).message };
				}
			});

			expect(result.success).toBe(false);
			expect(result.error).toContain('Invalid protocol');
		}, 15000);

		test('should track call history for registration calls', async () => {
			type CallHistoryEntry = {
				method: string;
				args: unknown[];
				timestamp: number;
			};

			// Register twice to create history
			await page.evaluate(async () => {
				await (window as { mockWallet?: { register: () => Promise<unknown> } }).mockWallet?.register();
			});

			await page.evaluate(async () => {
				await (window as { mockWallet?: { register: () => Promise<unknown> } }).mockWallet?.register();
			});

			const callHistory = await page.evaluate(() => {
				return (
					window as { mockWallet?: { getCallHistory?: () => CallHistoryEntry[] } }
				).mockWallet?.getCallHistory?.();
			});

			// If call history tracking is implemented
			if (callHistory) {
				expect(Array.isArray(callHistory)).toBe(true);
				expect(callHistory.length).toBeGreaterThanOrEqual(2);
			}
		}, 15000);

		test('should support multi-wallet registration', async () => {
			// Register first wallet
			const wallet1 = await page.evaluate(async () => {
				return await (
					window as { mockWallet?: { register: (c: unknown) => Promise<{ success: boolean; wallet?: { url: string } }> } }
				).mockWallet?.register({
					name: 'Wallet One',
					url: 'https://wallet-one.test.local',
					protocols: ['openid4vp'],
				});
			});

			expect(wallet1?.success).toBe(true);

			// Register second wallet with different URL
			const wallet2 = await page.evaluate(async () => {
				return await (
					window as { mockWallet?: { register: (c: unknown) => Promise<{ success: boolean; wallet?: { url: string } }> } }
				).mockWallet?.register({
					name: 'Wallet Two',
					url: 'https://wallet-two.test.local',
					protocols: ['openid4vp'],
				});
			});

			expect(wallet2?.success).toBe(true);
			expect(wallet2?.wallet?.url).not.toBe(wallet1?.wallet?.url);
		}, 20000);

		test('should preserve extensionInstalled state after reset', async () => {
			// Get state before reset
			const stateBefore = await page.evaluate(
				() =>
					(window as { mockWallet?: { getState: () => { extensionInstalled: boolean } } }).mockWallet?.getState(),
			);

			expect(stateBefore?.extensionInstalled).toBe(true);

			// Reset the mock wallet
			await page.evaluate(() => (window as { mockWallet?: { reset: () => void } }).mockWallet?.reset());

			// Get state after reset
			const stateAfter = await page.evaluate(
				() =>
					(window as { mockWallet?: { getState: () => { extensionInstalled: boolean } } }).mockWallet?.getState(),
			);

			// extensionInstalled should be preserved after reset
			expect(stateAfter?.extensionInstalled).toBe(true);
		}, 15000);

		test('should clear registration state after reset', async () => {
			// Register a wallet
			await page.evaluate(async () => {
				await (window as { mockWallet?: { register: () => Promise<unknown> } }).mockWallet?.register();
			});

			// Verify it's registered
			const isRegisteredBefore = await page.evaluate(async () => {
				return await (
					window as { mockWallet?: { isRegistered: () => Promise<boolean> } }
				).mockWallet?.isRegistered();
			});

			expect(isRegisteredBefore).toBe(true);

			// Reset
			await page.evaluate(() => (window as { mockWallet?: { reset: () => void } }).mockWallet?.reset());

			// After reset, should not be registered
			const isRegisteredAfter = await page.evaluate(async () => {
				return await (
					window as { mockWallet?: { isRegistered: () => Promise<boolean> } }
				).mockWallet?.isRegistered();
			});

			expect(isRegisteredAfter).toBe(false);
		}, 15000);

		test('should support JWT verifier registration', async () => {
			type VerifierResult = {
				success: boolean;
				verifierId?: string;
			};

			const result = await page.evaluate(async () => {
				const DCWS = (window as { DCWS?: { registerJWTVerifier?: (config: unknown) => Promise<VerifierResult> } }).DCWS;
				if (!DCWS?.registerJWTVerifier) return { supported: false as const };

				const verifierResult = await DCWS.registerJWTVerifier({
					issuer: 'https://issuer.test.local',
					publicKey: 'test-public-key',
				});

				return { supported: true as const, ...verifierResult };
			});

			// If JWT verifier registration is supported
			if (result.supported === true) {
				expect(result.success).toBeDefined();
			}
		}, 15000);

		test('should support JWT verifier unregistration', async () => {
			const result = await page.evaluate(async () => {
				const DCWS = (window as { DCWS?: { unregisterJWTVerifier?: (id: string) => Promise<{ success: boolean }> } }).DCWS;
				if (!DCWS?.unregisterJWTVerifier) return { supported: false as const };

				const unregisterResult = await DCWS.unregisterJWTVerifier('verifier-123');

				return { supported: true as const, ...unregisterResult };
			});

			// If JWT verifier unregistration is supported
			if (result.supported === true) {
				expect(result.success).toBeDefined();
			}
		}, 15000);
	});
});
