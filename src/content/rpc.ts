export type Handler = (type: string, payload: unknown) => Promise<unknown>;

/**
 * Simple RPC mechanism for communication between page context (inject.ts)
 * and content script (index.ts) using postMessage.
 *
 * @example
 * // In inject.ts (page context) - sender only
 * const rpc = new RPC();
 * const wallets = await rpc.send<Wallet[]>('GET_WALLETS');
 *
 * @example
 * // In content/index.ts - handler
 * new RPC(async (type, payload) => {
 *   switch (type) {
 *     case 'GET_WALLETS':
 *       return getWallets();
 *     default:
 *       throw new Error(`Unknown RPC: ${type}`);
 *   }
 * });
 */
export class RPC {
	#channel = 'WALLET_COMPANION_RPC';
	#pending = new Map<number, { resolve: (v: any) => void; reject: (v: any) => void }>();
	#id = 0;

	/**
	 * Create an RPC instance.
	 * @param handler - Optional handler for incoming requests.
	 *                  Omit for send-only usage (page context).
	 */
	constructor(handler?: Handler) {
		window.addEventListener('message', async (e) => {
			if (e.source !== window) return;
			if (e.origin !== window.location.origin) return;
			if (e.data?.channel !== this.#channel) return;

			// Response to our request
			if ('response' in e.data || 'error' in e.data) {
				const pending = this.#pending.get(e.data.id);
				if (pending) {
					if ('response' in e.data) pending.resolve(e.data.response);
					else pending.reject(e.data.error);
					this.#pending.delete(e.data.id);
				}
				return;
			}

			// Incoming request
			if (handler && e.data.type) {
				const { id, type, payload } = e.data;

				try {
					const response = await handler(type, payload);
					window.postMessage({ channel: this.#channel, id, response }, window.location.origin);
				} catch (err) {
					const error = err instanceof Error ? err : new Error(String(err));
					window.postMessage({ channel: this.#channel, id, error }, window.location.origin);
				}
			}
		});
	}

	/**
	 * Send an RPC request and wait for a response.
	 * @param type - The RPC method name
	 * @param payload - Optional request payload
	 * @returns Promise resolving to the response
	 */
	send<T>(type: string, payload?: object): Promise<T> {
		return new Promise((resolve, reject) => {
			const msgId = ++this.#id;
			const timer = setTimeout(() => {
				this.#pending.delete(msgId);
				reject(new DOMException(`RPC timeout: ${type}`, 'AbortError'));
			}, 5 * 1000);

			this.#pending.set(msgId, {
				resolve(v) {
					clearTimeout(timer);
					resolve(v);
				},
				reject(v) {
					clearTimeout(timer);
					reject(v);
				},
			});

			window.postMessage(
				{ channel: this.#channel, id: msgId, type, payload },
				window.location.origin,
			);
		});
	}
}
