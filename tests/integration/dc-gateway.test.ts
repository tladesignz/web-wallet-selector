/**
 * Tests for DCGateway - Digital Credentials API transport layer
 */

import { DCGateway } from '../../src/content/dc-api/gateway';
import { OpenID4VPProtocols } from '../../src/shared/protocols';

describe('DCGateway', () => {
	let gateway: DCGateway;
	let messageHandler: (event: MessageEvent) => void;
	let originalAddEventListener: typeof window.addEventListener;
	let originalOpen: typeof window.open;

	beforeEach(() => {
		// Capture message handler
		originalAddEventListener = window.addEventListener;
		window.addEventListener = vi.fn((type, handler) => {
			if (type === 'message') {
				messageHandler = handler as (event: MessageEvent) => void;
			}
		});

		// Mock window.open
		originalOpen = window.open;
		window.open = vi.fn();

		gateway = new DCGateway();
	});

	afterEach(() => {
		window.addEventListener = originalAddEventListener;
		window.open = originalOpen;
		vi.clearAllMocks();
		vi.useRealTimers();
	});

	describe('constructor', () => {
		it('should register message listener', () => {
			expect(window.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
		});
	});

	describe('prepareRequests', () => {
		it('should prepare valid requests', () => {
			const requests = [
				{
					protocol: OpenID4VPProtocols.NORMAL,
					data: { dcql_query: { credentials: [] } },
				},
			];

			const result = gateway.prepareRequests(requests);

			expect(result).toHaveLength(1);
			expect(result[0].protocol).toBe(OpenID4VPProtocols.NORMAL);
			expect(result[0].timestamp).toBeDefined();
		});

		it('should silently drop invalid requests', () => {
			const requests = [
				{ protocol: OpenID4VPProtocols.NORMAL, data: { dcql_query: { credentials: [] } } },
				{ protocol: OpenID4VPProtocols.NORMAL, data: 'invalid' },
				{ protocol: OpenID4VPProtocols.NORMAL, data: { nonce: 'missing-query' } },
			];

			const result = gateway.prepareRequests(requests);

			expect(result).toHaveLength(1);
		});

		it('should return empty array when all requests fail', () => {
			const requests = [
				{ protocol: OpenID4VPProtocols.NORMAL, data: null },
			];

			const result = gateway.prepareRequests(requests);

			expect(result).toHaveLength(0);
		});
	});

	describe('invoke', () => {
		const wallet = { id: '1', name: 'Test Wallet', url: 'https://wallet.example.com' };
		const request = {
			protocol: OpenID4VPProtocols.NORMAL,
			timestamp: new Date().toISOString(),
			dcql_query: { credentials: [] },
		};

		it('should open wallet popup', async () => {
			const mockWindow = { closed: false } as Window;
			vi.mocked(window.open).mockReturnValue(mockWindow);

			// Don't await - just start the invocation
			gateway.invoke(wallet, OpenID4VPProtocols.NORMAL, request, 'req-123');

			expect(window.open).toHaveBeenCalledWith(
				expect.stringContaining('wallet.example.com'),
				'_blank'
			);
		});

		it('should reject when popup is blocked', async () => {
			vi.mocked(window.open).mockReturnValue(null);

			await expect(
				gateway.invoke(wallet, OpenID4VPProtocols.NORMAL, request, 'req-123')
			).rejects.toThrow('Popup blocked');
		});

		it('should reject on timeout', async () => {
			vi.useFakeTimers();
			const mockWindow = { closed: false } as Window;
			vi.mocked(window.open).mockReturnValue(mockWindow);

			const promise = gateway.invoke(wallet, OpenID4VPProtocols.NORMAL, request, 'req-123');

			vi.advanceTimersByTime(300000); // 5 minutes

			await expect(promise).rejects.toThrow('Wallet timeout');
		});

		it('should resolve when valid response received', async () => {
			const mockWindow = { closed: false } as Window;
			vi.mocked(window.open).mockReturnValue(mockWindow);

			const promise = gateway.invoke(wallet, OpenID4VPProtocols.NORMAL, request, 'req-123');

			// Simulate wallet response
			messageHandler({
				origin: 'https://wallet.example.com',
				source: mockWindow,
				data: {
					type: 'WC_WALLET_RESPONSE',
					requestId: 'req-123',
					response: { vp_token: 'test-token' },
				},
			} as MessageEvent);

			const result = await promise;
			expect(result).toEqual({ vp_token: 'test-token' });
		});

		it('should ignore responses from wrong origin', async () => {
			vi.useFakeTimers();
			const mockWindow = { closed: false } as Window;
			vi.mocked(window.open).mockReturnValue(mockWindow);

			const promise = gateway.invoke(wallet, OpenID4VPProtocols.NORMAL, request, 'req-123');

			// Response from wrong origin
			messageHandler({
				origin: 'https://attacker.com',
				source: mockWindow,
				data: {
					type: 'WC_WALLET_RESPONSE',
					requestId: 'req-123',
					response: { malicious: true },
				},
			} as MessageEvent);

			vi.advanceTimersByTime(300000);
			await expect(promise).rejects.toThrow('Wallet timeout');
		});

		it('should ignore responses from wrong source window', async () => {
			vi.useFakeTimers();
			const mockWindow = { closed: false } as Window;
			const otherWindow = { closed: false } as Window;
			vi.mocked(window.open).mockReturnValue(mockWindow);

			const promise = gateway.invoke(wallet, OpenID4VPProtocols.NORMAL, request, 'req-123');

			// Response from different window
			messageHandler({
				origin: 'https://wallet.example.com',
				source: otherWindow,
				data: {
					type: 'WC_WALLET_RESPONSE',
					requestId: 'req-123',
					response: { wrong: 'source' },
				},
			} as MessageEvent);

			vi.advanceTimersByTime(300000);
			await expect(promise).rejects.toThrow('Wallet timeout');
		});

		it('should ignore responses with wrong requestId', async () => {
			vi.useFakeTimers();
			const mockWindow = { closed: false } as Window;
			vi.mocked(window.open).mockReturnValue(mockWindow);

			const promise = gateway.invoke(wallet, OpenID4VPProtocols.NORMAL, request, 'req-123');

			messageHandler({
				origin: 'https://wallet.example.com',
				source: mockWindow,
				data: {
					type: 'WC_WALLET_RESPONSE',
					requestId: 'wrong-id',
					response: {},
				},
			} as MessageEvent);

			vi.advanceTimersByTime(300000);
			await expect(promise).rejects.toThrow('Wallet timeout');
		});

		it('should ignore non-wallet messages', async () => {
			vi.useFakeTimers();
			const mockWindow = { closed: false } as Window;
			vi.mocked(window.open).mockReturnValue(mockWindow);

			const promise = gateway.invoke(wallet, OpenID4VPProtocols.NORMAL, request, 'req-123');

			// Random message
			messageHandler({
				origin: 'https://wallet.example.com',
				source: mockWindow,
				data: { type: 'SOME_OTHER_MESSAGE' },
			} as MessageEvent);

			vi.advanceTimersByTime(300000);
			await expect(promise).rejects.toThrow('Wallet timeout');
		});
	});
});
