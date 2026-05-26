/**
 * Unit tests for content/public-api/WalletCompanion.ts - WalletCompanion class
 *
 * Tests the public API exposed to web pages when the extension is installed.
 */

import { WalletCompanion } from '../../../../src/content/public-api/WalletCompanion';
import type { RPC } from '../../../../src/content/rpc';

// Mock consent modal (returns approved by default)
vi.mock('@content/modals/register-wallet-consent', () => ({
	registerWalletConsentModal: vi.fn().mockResolvedValue({ status: 'approved' }),
}));

// Create a mock RPC for testing
function createMockRPC() {
	return {
		send: vi.fn(),
	} as unknown as RPC & { send: ReturnType<typeof vi.fn> };
}

describe('WalletCompanion Class', () => {
	let mockRPC: RPC & { send: ReturnType<typeof vi.fn> };

	beforeEach(() => {
		vi.clearAllMocks();
		mockRPC = createMockRPC();
		// Default: GET_SUPPORTED_PROTOCOLS returns empty
		mockRPC.send.mockResolvedValue({ protocols: [] });
	});

	describe('Instantiation', () => {
		it('should create instance with RPC dependency', () => {
			const wc = new WalletCompanion(mockRPC);
			expect(wc).toBeInstanceOf(WalletCompanion);
		});

		it('should call GET_SUPPORTED_PROTOCOLS on construction', async () => {
			mockRPC.send.mockResolvedValue({ protocols: ['openid4vp'] });

			new WalletCompanion(mockRPC);

			// Allow async constructor call to complete
			await vi.waitFor(() => {
				expect(mockRPC.send).toHaveBeenCalledWith('GET_SUPPORTED_PROTOCOLS');
			});
		});
	});

	describe('isInstalled property', () => {
		it('should return true', () => {
			const wc = new WalletCompanion(mockRPC);
			expect(wc.isInstalled).toBe(true);
		});
	});

	describe('version property', () => {
		it('should return version from env or undefined', () => {
			const wc = new WalletCompanion(mockRPC);
			// Version comes from import.meta.env.VITE_APP_VERSION which may be undefined in tests
			expect(wc.version === undefined || typeof wc.version === 'string').toBe(true);
		});
	});

	describe('supportedProtocols property', () => {
		it('should return array of protocols', async () => {
			mockRPC.send.mockResolvedValue({ protocols: ['openid4vp', 'dcapi'] });

			const wc = new WalletCompanion(mockRPC);

			await vi.waitFor(() => {
				expect(wc.supportedProtocols).toContain('openid4vp');
			});
		});

		it('should return empty array initially when no protocols', async () => {
			mockRPC.send.mockResolvedValue({ protocols: [] });

			const wc = new WalletCompanion(mockRPC);

			await vi.waitFor(() => {
				expect(wc.supportedProtocols).toEqual([]);
			});
		});

		it('should be readonly', () => {
			const wc = new WalletCompanion(mockRPC);
			const protocols = wc.supportedProtocols;
			expect(Array.isArray(protocols)).toBe(true);
		});
	});

	describe('DigitalCredentials property', () => {
		it('should expose DigitalCredentials instance', () => {
			const wc = new WalletCompanion(mockRPC);
			expect(wc.DigitalCredentials).toBeDefined();
		});

		it('should have registerJWTVerifier method', () => {
			const wc = new WalletCompanion(mockRPC);
			expect(typeof wc.DigitalCredentials.registerJWTVerifier).toBe('function');
		});

		it('should have unregisterJWTVerifier method', () => {
			const wc = new WalletCompanion(mockRPC);
			expect(typeof wc.DigitalCredentials.unregisterJWTVerifier).toBe('function');
		});

		it('should have registeredJWTVerifiers property', () => {
			const wc = new WalletCompanion(mockRPC);
			expect(Array.isArray(wc.DigitalCredentials.registeredJWTVerifiers)).toBe(true);
		});
	});

	describe('registerWallet()', () => {
		it('should throw when name is missing', async () => {
			const wc = new WalletCompanion(mockRPC);

			await expect(
				wc.registerWallet({ url: 'https://test.com', protocols: ['openid4vp'] } as Parameters<
					typeof wc.registerWallet
				>[0]),
			).rejects.toThrow('Wallet registration requires at least name and url');
		});

		it('should throw when url is missing', async () => {
			const wc = new WalletCompanion(mockRPC);

			await expect(
				wc.registerWallet({ name: 'Test', protocols: ['openid4vp'] } as Parameters<typeof wc.registerWallet>[0]),
			).rejects.toThrow('Wallet registration requires at least name and url');
		});

		it('should throw when protocols array is missing', async () => {
			const wc = new WalletCompanion(mockRPC);

			await expect(wc.registerWallet({ name: 'Test', url: 'https://test.com' } as Parameters<typeof wc.registerWallet>[0])).rejects.toThrow(
				'Wallet registration requires at least one supported protocol',
			);
		});

		it('should throw when protocols array is empty', async () => {
			const wc = new WalletCompanion(mockRPC);

			await expect(wc.registerWallet({ name: 'Test', url: 'https://test.com', protocols: [] })).rejects.toThrow(
				'Wallet registration requires at least one supported protocol',
			);
		});

		it('should throw for invalid URL', async () => {
			const wc = new WalletCompanion(mockRPC);

			await expect(
				wc.registerWallet({ name: 'Test', url: 'not-a-url', protocols: ['openid4vp'] }),
			).rejects.toThrow('Invalid wallet URL');
		});

		it('should throw for invalid protocol identifier', async () => {
			const wc = new WalletCompanion(mockRPC);

			await expect(
				wc.registerWallet({ name: 'Test', url: 'https://test.com', protocols: ['OpenID4VP'] }),
			).rejects.toThrow('Invalid protocol identifier');
		});

		it('should send REGISTER_WALLET RPC for valid input', async () => {
			mockRPC.send.mockResolvedValueOnce({ protocols: [] }); // Constructor call
			mockRPC.send.mockResolvedValueOnce({ isRegistered: false }); // CHECK_WALLET call
			mockRPC.send.mockResolvedValueOnce({
				success: true,
				alreadyRegistered: false,
				wallet: { id: 'w1', name: 'Test', url: 'https://test.com' },
			});
			mockRPC.send.mockResolvedValueOnce({ protocols: ['openid4vp'] }); // Refresh after register

			const wc = new WalletCompanion(mockRPC);

			const result = await wc.registerWallet({
				name: 'Test Wallet',
				url: 'https://wallet.test.com',
				protocols: ['openid4vp'],
			});

			expect(mockRPC.send).toHaveBeenCalledWith(
				'REGISTER_WALLET',
				expect.objectContaining({
					wallet: expect.objectContaining({
						name: 'Test Wallet',
						url: 'https://wallet.test.com',
					}),
				}),
			);
			expect(result.success).toBe(true);
		});

		it('should return alreadyRegistered true for existing wallet', async () => {
			mockRPC.send.mockResolvedValueOnce({ protocols: [] }); // Constructor call
			mockRPC.send.mockResolvedValueOnce({ isRegistered: true }); // CHECK_WALLET call

			const wc = new WalletCompanion(mockRPC);

			const result = await wc.registerWallet({
				name: 'Existing',
				url: 'https://existing.com',
				protocols: ['openid4vp'],
			});

			// When wallet is already registered, returns early with success: false
			expect(result.success).toBe(false);
			expect(result.alreadyRegistered).toBe(true);
		});
	});

	describe('isWalletRegistered()', () => {
		it('should send CHECK_WALLET RPC', async () => {
			mockRPC.send.mockResolvedValueOnce({ protocols: [] }); // Constructor call
			mockRPC.send.mockResolvedValueOnce({ isRegistered: true });

			const wc = new WalletCompanion(mockRPC);

			await wc.isWalletRegistered('https://wallet.test.com');

			expect(mockRPC.send).toHaveBeenCalledWith('CHECK_WALLET', { url: 'https://wallet.test.com' });
		});

		it('should return true for registered wallet', async () => {
			mockRPC.send.mockResolvedValueOnce({ protocols: [] }); // Constructor call
			mockRPC.send.mockResolvedValueOnce({ isRegistered: true });

			const wc = new WalletCompanion(mockRPC);

			const result = await wc.isWalletRegistered('https://registered.com');
			expect(result).toBe(true);
		});

		it('should return false for unregistered wallet', async () => {
			mockRPC.send.mockResolvedValueOnce({ protocols: [] }); // Constructor call
			mockRPC.send.mockResolvedValueOnce({ isRegistered: false });

			const wc = new WalletCompanion(mockRPC);

			const result = await wc.isWalletRegistered('https://unregistered.com');
			expect(result).toBe(false);
		});
	});
});
