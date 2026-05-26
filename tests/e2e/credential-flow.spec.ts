/**
 * E2E tests for credential request flow.
 *
 * Tests the Digital Credentials API interception and wallet selection flow.
 *
 * The wallet selector modal uses a shadow DOM. The fixtures apply an init script
 * that forces all shadow DOMs to be open, allowing Playwright to interact with
 * the modal content.
 */

import { test, expect } from './fixtures';

// Type definitions for mock verifier API
interface MockVerifierState {
	extensionReady: boolean;
	resultVisible: boolean;
	lastRequest: string;
	lastResponse: unknown | null;
	lastError: Error | null;
}

test.describe('Credential Request Interception', () => {
	test.beforeEach(async ({ page, testServer }) => {
		// Register a wallet so there's something to select
		await page.goto(`${testServer.url}/mock-wallet.html?auto-register=true`);
		await page.waitForFunction(
			() => {
				const w = window as { mockWallet?: { state?: { registered: boolean } } };
				return w.mockWallet?.state?.registered === true;
			},
			{ timeout: 5000 },
		);
	});

	test('verifier page should detect extension', async ({ page, testServer }) => {
		await page.goto(`${testServer.url}/mock-verifier.html`);

		await page.waitForFunction(
			() => {
				const w = window as { mockVerifier?: { state?: MockVerifierState } };
				return w.mockVerifier?.state !== undefined;
			},
			{ timeout: 5000 },
		);

		const state = await page.evaluate(() => {
			const w = window as { mockVerifier?: { state?: MockVerifierState } };
			return w.mockVerifier?.state;
		});

		expect(state?.extensionReady).toBe(true);
	});

	test('credential request should show wallet selector modal', async ({ page, testServer }) => {
		await page.goto(`${testServer.url}/mock-verifier.html`);

		await page.waitForFunction(
			() => {
				const w = window as { mockVerifier?: { state?: MockVerifierState } };
				return w.mockVerifier?.state?.extensionReady === true;
			},
			{ timeout: 5000 },
		);

		// Don't await - blocks until modal interaction
		const requestPromise = page.evaluate(() => {
			const v = window as { mockVerifier?: { runTest: (id: string) => Promise<void> } };
			return v.mockVerifier?.runTest('basic');
		});

		// Shadow DOM is forced open by fixtures, so we can see modal content
		const modalTitle = page.getByText('Select Digital Wallet');
		await expect(modalTitle).toBeVisible({ timeout: 5000 });
		await expect(page.getByText('Mock Wallet').first()).toBeVisible();

		await page.getByRole('button', { name: 'Cancel' }).click();

		try {
			await requestPromise;
		} catch {
			// Expected - request was cancelled
		}

		await expect(modalTitle).not.toBeVisible({ timeout: 3000 });
	});

	test('pressing Escape should cancel credential request', async ({ page, testServer }) => {
		await page.goto(`${testServer.url}/mock-verifier.html`);

		await page.waitForFunction(
			() => {
				const w = window as { mockVerifier?: { state?: MockVerifierState } };
				return w.mockVerifier?.state?.extensionReady === true;
			},
			{ timeout: 5000 },
		);

		page.evaluate(() => {
			const v = window as { mockVerifier?: { runTest: (id: string) => Promise<void> } };
			v.mockVerifier?.runTest('basic');
		});

		await page.waitForSelector('#dc-wallet-host', { state: 'attached', timeout: 5000 });
		await page.keyboard.press('Escape');

		await page.waitForFunction(
			() => document.getElementById('dc-wallet-host') === null,
			{ timeout: 3000 },
		);

		const state = await page.evaluate(() => {
			const w = window as { mockVerifier?: { state?: MockVerifierState } };
			return w.mockVerifier?.state;
		});

		expect(state?.lastError).toBeTruthy();
	});

	test('credential request without registered wallet should still show modal', async ({ extensionContext, testServer }) => {
		// Fresh page without wallet registration
		const page = await extensionContext.newPage();
		await page.goto(`${testServer.url}/mock-verifier.html`);

		await page.waitForFunction(
			() => {
				const w = window as { mockVerifier?: { state?: MockVerifierState } };
				return w.mockVerifier?.state?.extensionReady === true;
			},
			{ timeout: 5000 },
		);

		page.evaluate(() => {
			const v = window as { mockVerifier?: { runTest: (id: string) => Promise<void> } };
			v.mockVerifier?.runTest('basic');
		});

		// May show "no wallets" state or fall back to native
		await page.waitForTimeout(500);

		const modalInDom = await page.evaluate(() => document.getElementById('dc-wallet-host') !== null);
		const hasResponse = await page.evaluate(() => {
			const w = window as { mockVerifier?: { state?: MockVerifierState } };
			return w.mockVerifier?.state?.lastResponse !== null || w.mockVerifier?.state?.lastError !== null;
		});

		expect(modalInDom || hasResponse).toBe(true);

		if (modalInDom) {
			await page.keyboard.press('Escape');
		}
		await page.close();
	});
});

test.describe('Credential Request Types', () => {
	test.beforeEach(async ({ page, testServer }) => {
		await page.goto(`${testServer.url}/mock-wallet.html?auto-register=true`);
		await page.waitForFunction(
			() => {
				const w = window as { mockWallet?: { state?: { registered: boolean } } };
				return w.mockWallet?.state?.registered === true;
			},
			{ timeout: 5000 },
		);
	});

	test('basic identity request should trigger interception', async ({ page, testServer }) => {
		await page.goto(`${testServer.url}/mock-verifier.html`);

		await page.waitForFunction(
			() => {
				const w = window as { mockVerifier?: { state?: MockVerifierState } };
				return w.mockVerifier?.state?.extensionReady === true;
			},
			{ timeout: 5000 },
		);

		page.evaluate(() => {
			const v = window as { mockVerifier?: { runTest: (id: string) => Promise<void> } };
			v.mockVerifier?.runTest('basic');
		});

		await page.waitForSelector('#dc-wallet-host', { state: 'attached', timeout: 5000 });
		await page.keyboard.press('Escape');
	});

	test('age verification request should trigger interception', async ({ page, testServer }) => {
		await page.goto(`${testServer.url}/mock-verifier.html`);

		await page.waitForFunction(
			() => {
				const w = window as { mockVerifier?: { state?: MockVerifierState } };
				return w.mockVerifier?.state?.extensionReady === true;
			},
			{ timeout: 5000 },
		);

		page.evaluate(() => {
			const v = window as { mockVerifier?: { runTest: (id: string) => Promise<void> } };
			v.mockVerifier?.runTest('age');
		});

		await page.waitForSelector('#dc-wallet-host', { state: 'attached', timeout: 5000 });
		await page.keyboard.press('Escape');
	});

	test('profile request should trigger interception', async ({ page, testServer }) => {
		await page.goto(`${testServer.url}/mock-verifier.html`);

		await page.waitForFunction(
			() => {
				const w = window as { mockVerifier?: { state?: MockVerifierState } };
				return w.mockVerifier?.state?.extensionReady === true;
			},
			{ timeout: 5000 },
		);

		page.evaluate(() => {
			const v = window as { mockVerifier?: { runTest: (id: string) => Promise<void> } };
			v.mockVerifier?.runTest('profile');
		});

		await page.waitForSelector('#dc-wallet-host', { state: 'attached', timeout: 5000 });
		await page.keyboard.press('Escape');
	});

	test('multi-credential request should trigger interception', async ({ page, testServer }) => {
		await page.goto(`${testServer.url}/mock-verifier.html`);

		await page.waitForFunction(
			() => {
				const w = window as { mockVerifier?: { state?: MockVerifierState } };
				return w.mockVerifier?.state?.extensionReady === true;
			},
			{ timeout: 5000 },
		);

		page.evaluate(() => {
			const v = window as { mockVerifier?: { runTest: (id: string) => Promise<void> } };
			v.mockVerifier?.runTest('multi');
		});

		await page.waitForSelector('#dc-wallet-host', { state: 'attached', timeout: 5000 });
		await page.keyboard.press('Escape');
	});
});

// Type definitions for mock wallet API
interface MockWalletState {
	extensionReady: boolean;
	registered: boolean;
	walletId: string | null;
	currentRequest: unknown | null;
	canRespond: boolean;
}

test.describe('Complete Credential Flow', () => {
	test.beforeEach(async ({ page, testServer }) => {
		await page.goto(`${testServer.url}/mock-wallet.html?auto-register=true`);
		await page.waitForFunction(
			() => {
				const w = window as { mockWallet?: { state?: { registered: boolean } } };
				return w.mockWallet?.state?.registered === true;
			},
			{ timeout: 5000 },
		);
	});

	test('selecting wallet should open wallet popup and complete flow', async ({ page, extensionContext, testServer }) => {
		await page.goto(`${testServer.url}/mock-verifier.html`);

		await page.waitForFunction(
			() => {
				const w = window as { mockVerifier?: { state?: MockVerifierState } };
				return w.mockVerifier?.state?.extensionReady === true;
			},
			{ timeout: 5000 },
		);

		// Must listen for popup before triggering credential request
		const popupPromise = extensionContext.waitForEvent('page');

		// Don't await - completes after wallet responds
		const requestPromise = page.evaluate(() => {
			const v = window as { mockVerifier?: { runTest: (id: string) => Promise<void> } };
			return v.mockVerifier?.runTest('basic');
		});

		const modalTitle = page.getByText('Select Digital Wallet');
		await expect(modalTitle).toBeVisible({ timeout: 5000 });
		await page.getByRole('button', { name: /Mock Wallet/i }).click();

		const walletPopup = await popupPromise;

		await walletPopup.waitForFunction(
			() => typeof (window as { mockWallet?: unknown }).mockWallet !== 'undefined',
			{ timeout: 10000 },
		);

		// waitForRequest handles timing correctly
		await walletPopup.evaluate(() => {
			const w = window as { mockWallet?: { waitForRequest: (timeout?: number) => Promise<unknown> } };
			return w.mockWallet?.waitForRequest(10000);
		});

		const walletState = await walletPopup.evaluate(() => {
			const w = window as { mockWallet?: { state?: MockWalletState } };
			return w.mockWallet?.state;
		});
		expect(walletState?.currentRequest).toBeTruthy();
		expect(walletState?.canRespond).toBe(true);

		await walletPopup.evaluate(() => {
			const w = window as { mockWallet?: { sendResponse: (approved: boolean) => void } };
			w.mockWallet?.sendResponse(true);
		});

		await page.waitForFunction(
			() => {
				const w = window as { mockVerifier?: { state?: MockVerifierState } };
				return w.mockVerifier?.state?.lastResponse !== null;
			},
			{ timeout: 10000 },
		);

		const verifierState = await page.evaluate(() => {
			const w = window as { mockVerifier?: { state?: MockVerifierState } };
			return w.mockVerifier?.state;
		});

		expect(verifierState?.lastResponse).toBeTruthy();
		expect(verifierState?.lastError).toBeNull();

		await requestPromise;
	});

	test('denying request in wallet should return error to verifier', async ({ page, extensionContext, testServer }) => {
		await page.goto(`${testServer.url}/mock-verifier.html`);

		await page.waitForFunction(
			() => {
				const w = window as { mockVerifier?: { state?: MockVerifierState } };
				return w.mockVerifier?.state?.extensionReady === true;
			},
			{ timeout: 5000 },
		);

		const popupPromise = extensionContext.waitForEvent('page');

		page.evaluate(() => {
			const v = window as { mockVerifier?: { runTest: (id: string) => Promise<void> } };
			v.mockVerifier?.runTest('basic');
		});

		await expect(page.getByText('Select Digital Wallet')).toBeVisible({ timeout: 5000 });
		await page.getByRole('button', { name: /Mock Wallet/i }).click();

		const walletPopup = await popupPromise;

		await walletPopup.waitForFunction(
			() => typeof (window as { mockWallet?: unknown }).mockWallet !== 'undefined',
			{ timeout: 10000 },
		);

		await walletPopup.evaluate(() => {
			const w = window as { mockWallet?: { waitForRequest: (timeout?: number) => Promise<unknown> } };
			return w.mockWallet?.waitForRequest(10000);
		});

		await walletPopup.evaluate(() => {
			const w = window as { mockWallet?: { sendResponse: (approved: boolean) => void } };
			w.mockWallet?.sendResponse(false);
		});

		await page.waitForFunction(
			() => {
				const w = window as { mockVerifier?: { state?: MockVerifierState } };
				return w.mockVerifier?.state?.lastError !== null;
			},
			{ timeout: 10000 },
		);

		const verifierState = await page.evaluate(() => {
			const w = window as { mockVerifier?: { state?: MockVerifierState } };
			return w.mockVerifier?.state;
		});

		expect(verifierState?.lastError).toBeTruthy();
		expect(verifierState?.lastResponse).toBeNull();
	});
});
