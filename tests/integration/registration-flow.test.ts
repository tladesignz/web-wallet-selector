/**
 * Integration tests for wallet registration flow
 *
 * Tests the full registration path: WalletCompanion → RPC → handleMessage → storage
 * No browser required - components are wired together directly.
 */

import { WalletCompanion } from '../../src/content/public-api/WalletCompanion';
import { handleMessage } from '../../src/background/handlers';
import { Stores } from '../../src/background/storage';
import type { RPC } from '../../src/content/rpc';

// Mock the storage module
vi.mock('../../src/background/storage', () => ({
	Stores: {
		options: {
			getEnabled: vi.fn().mockResolvedValue(true),
			getDeveloperMode: vi.fn().mockResolvedValue(false),
			updateOptions: vi.fn().mockResolvedValue(undefined),
		},
		wallets: {
			getAll: vi.fn().mockResolvedValue([]),
			setAll: vi.fn().mockResolvedValue(undefined),
		},
		stats: {
			getStats: vi.fn().mockResolvedValue({ interceptCount: 0, walletUses: {} }),
			setStats: vi.fn().mockResolvedValue(undefined),
		},
	},
}));

// Mock browser tabs API (used by handleShowWalletSelector)
vi.mock('../../src/shared/runtime', () => ({
	runtimeSendMessage: vi.fn(),
}));

// Mock consent modal (returns approved by default)
vi.mock('../../src/content/modals/register-wallet-consent', () => ({
	registerWalletConsentModal: vi.fn().mockResolvedValue({ status: 'approved' }),
}));

const mockStores = {
	wallets: {
		getAll: vi.mocked(Stores.wallets.getAll),
		setAll: vi.mocked(Stores.wallets.setAll),
	},
	options: {
		getEnabled: vi.mocked(Stores.options.getEnabled),
	},
	stats: {
		getStats: vi.mocked(Stores.stats.getStats),
	},
};

/**
 * Creates a mock RPC that routes messages directly to handleMessage.
 * This simulates the content script ↔ background communication.
 */
function createIntegrationRPC(): RPC {
	return {
		send: async <T>(type: string, payload?: object): Promise<T> => {
			return new Promise((resolve, reject) => {
				const message = { type, ...payload };
				const sender = { tab: { id: 1 }, frameId: 0 };

				handleMessage(message, sender, (response: unknown) => {
					if (response && typeof response === 'object' && 'error' in response) {
						reject(new Error((response as { error: string }).error));
					} else {
						resolve(response as T);
					}
				});
			});
		},
	} as RPC;
}

describe('Registration Flow Integration', () => {
	let walletCompanion: WalletCompanion;
	let storedWallets: Array<{
		id: string;
		name: string;
		url: string;
		protocols: string[];
		enabled: boolean;
	}>;

	beforeEach(() => {
		vi.clearAllMocks();

		// Reset stored wallets
		storedWallets = [];

		// Mock storage to use in-memory array
		mockStores.wallets.getAll.mockImplementation(() => Promise.resolve([...storedWallets]));
		mockStores.wallets.setAll.mockImplementation((wallets) => {
			// @ts-expect-error
			storedWallets = [...wallets];
			return Promise.resolve();
		});

		// Create WalletCompanion with integration RPC
		const rpc = createIntegrationRPC();
		walletCompanion = new WalletCompanion(rpc);
	});

	describe('Valid Registration', () => {
		it('should register a new wallet through the full flow', async () => {
			const walletInfo = {
				name: 'Test Wallet',
				url: 'https://wallet.example.com',
				protocols: ['openid4vp'],
			};

			const result = await walletCompanion.registerWallet(walletInfo);

			expect(result.success).toBe(true);
			expect(result.alreadyRegistered).toBe(false);
			expect(result.wallet).toBeDefined();
			expect(result.wallet?.name).toBe('Test Wallet');
			expect(result.wallet?.url).toBe('https://wallet.example.com');
			expect(result.wallet?.id).toMatch(/^wallet-/);

			// Verify storage was updated
			expect(mockStores.wallets.setAll).toHaveBeenCalled();
			expect(storedWallets).toHaveLength(1);
			expect(storedWallets[0].name).toBe('Test Wallet');
		});

		it('should register wallet with multiple protocols', async () => {
			const walletInfo = {
				name: 'Multi-Protocol Wallet',
				url: 'https://multi.wallet.com',
				protocols: ['openid4vp', 'openid4vp-v1-unsigned', 'openid4vp-v1-signed'],
			};

			const result = await walletCompanion.registerWallet(walletInfo);

			expect(result.success).toBe(true);
			expect(storedWallets[0].protocols).toEqual([
				'openid4vp',
				'openid4vp-v1-unsigned',
				'openid4vp-v1-signed',
			]);
		});

		it('should register wallet with optional fields', async () => {
			const walletInfo = {
				name: 'Full Wallet',
				url: 'https://full.wallet.com',
				protocols: ['openid4vp'],
				description: 'A wallet with all optional fields',
				icon: 'https://full.wallet.com/icon.png',
			};

			const result = await walletCompanion.registerWallet(walletInfo);

			expect(result.success).toBe(true);
			expect(result.wallet?.name).toBe('Full Wallet');
		});
	});

	describe('Duplicate Detection', () => {
		it('should detect duplicate registration by URL', async () => {
			// First registration
			const walletInfo = {
				name: 'Original Wallet',
				url: 'https://wallet.example.com',
				protocols: ['openid4vp'],
			};

			const firstResult = await walletCompanion.registerWallet(walletInfo);
			expect(firstResult.success).toBe(true);
			expect(firstResult.alreadyRegistered).toBe(false);

			// Second registration with same URL
			const secondResult = await walletCompanion.registerWallet({
				name: 'Duplicate Wallet',
				url: 'https://wallet.example.com', // Same URL
				protocols: ['openid4vp-v1-unsigned'],
			});

			expect(secondResult.success).toBe(false);
			expect(secondResult.alreadyRegistered).toBe(true);
			// Note: wallet info is not returned when already registered
			expect(storedWallets).toHaveLength(1); // Only one wallet stored
		});

		it('should allow registration of different URLs', async () => {
			await walletCompanion.registerWallet({
				name: 'Wallet A',
				url: 'https://wallet-a.com',
				protocols: ['openid4vp'],
			});

			await walletCompanion.registerWallet({
				name: 'Wallet B',
				url: 'https://wallet-b.com',
				protocols: ['openid4vp'],
			});

			expect(storedWallets).toHaveLength(2);
		});
	});

	describe('Validation Errors (Client-Side)', () => {
		it('should reject registration without name before reaching handler', async () => {
			// Reset mock call count after construction
			mockStores.wallets.getAll.mockClear();

			await expect(
				walletCompanion.registerWallet({
					url: 'https://test.com',
					protocols: ['openid4vp'],
				} as any),
			).rejects.toThrow('Wallet registration requires at least name and url');

			// REGISTER_WALLET handler should never be called (no setAll)
			expect(mockStores.wallets.setAll).not.toHaveBeenCalled();
		});

		it('should reject registration without url before reaching handler', async () => {
			mockStores.wallets.setAll.mockClear();

			await expect(
				walletCompanion.registerWallet({
					name: 'Test',
					protocols: ['openid4vp'],
				} as any),
			).rejects.toThrow('Wallet registration requires at least name and url');

			expect(mockStores.wallets.setAll).not.toHaveBeenCalled();
		});

		it('should reject registration without protocols before reaching handler', async () => {
			mockStores.wallets.setAll.mockClear();

			await expect(walletCompanion.registerWallet({ name: 'Test', url: 'https://test.com' } as any)).rejects.toThrow(
				'Wallet registration requires at least one supported protocol',
			);

			expect(mockStores.wallets.setAll).not.toHaveBeenCalled();
		});

		it('should reject registration with empty protocols array', async () => {
			mockStores.wallets.setAll.mockClear();

			await expect(
				walletCompanion.registerWallet({
					name: 'Test',
					url: 'https://test.com',
					protocols: [],
				}),
			).rejects.toThrow('Wallet registration requires at least one supported protocol');

			expect(mockStores.wallets.setAll).not.toHaveBeenCalled();
		});

		it('should reject registration with invalid URL', async () => {
			mockStores.wallets.setAll.mockClear();

			await expect(
				walletCompanion.registerWallet({
					name: 'Test',
					url: 'not-a-valid-url',
					protocols: ['openid4vp'],
				}),
			).rejects.toThrow('Invalid wallet URL');

			expect(mockStores.wallets.setAll).not.toHaveBeenCalled();
		});

		it('should reject registration with invalid protocol identifier', async () => {
			mockStores.wallets.setAll.mockClear();

			await expect(
				walletCompanion.registerWallet({
					name: 'Test',
					url: 'https://test.com',
					protocols: ['invalid protocol!'], // Contains space and special char
				}),
			).rejects.toThrow('Invalid protocol identifier');

			expect(mockStores.wallets.setAll).not.toHaveBeenCalled();
		});

		it('should reject registration with uppercase protocol', async () => {
			await expect(
				walletCompanion.registerWallet({
					name: 'Test',
					url: 'https://test.com',
					protocols: ['OpenID4VP'], // Uppercase not allowed
				}),
			).rejects.toThrow('Invalid protocol identifier');
		});
	});

	describe('isWalletRegistered', () => {
		it('should return true for registered wallet', async () => {
			await walletCompanion.registerWallet({
				name: 'Test Wallet',
				url: 'https://wallet.example.com',
				protocols: ['openid4vp'],
			});

			const isRegistered = await walletCompanion.isWalletRegistered(
				'https://wallet.example.com',
			);
			expect(isRegistered).toBe(true);
		});

		it('should return false for unregistered wallet', async () => {
			const isRegistered = await walletCompanion.isWalletRegistered(
				'https://unknown-wallet.com',
			);
			expect(isRegistered).toBe(false);
		});
	});

	describe('supportedProtocols Updates', () => {
		it('should update supportedProtocols after registration', async () => {
			// Initially empty (mocked to return empty protocols)
			expect(walletCompanion.supportedProtocols).toEqual([]);

			mockStores.wallets.setAll.mockImplementation(async (wallets) => {
				mockStores.wallets.getAll.mockResolvedValue(wallets);
			});

			await walletCompanion.registerWallet({
				name: 'Test Wallet',
				url: 'https://test.com',
				protocols: ['openid4vp', 'openid4vp-v1-unsigned'],
			});

			// Allow async update to complete
			await vi.waitFor(() => {
				expect(walletCompanion.supportedProtocols.length).toBeGreaterThan(0);
			});
		});
	});
});
