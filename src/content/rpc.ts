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
	#pending = new Map<number, (v: any) => void>();
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
			if (this.#pending.has(e.data.id) && 'response' in e.data) {
				this.#pending.get(e.data.id)?.(e.data.response);
				this.#pending.delete(e.data.id);
				return;
			}

			// Incoming request
			if (handler && e.data.type) {
				const { id, type, payload } = e.data;
				const response = await handler(type, payload);
				window.postMessage({ channel: this.#channel, id, response }, window.location.origin);
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
		return new Promise((resolve) => {
			const msgId = ++this.#id;
			this.#pending.set(msgId, resolve);
			window.postMessage(
				{ channel: this.#channel, id: msgId, type, payload },
				window.location.origin,
			);
		});
	}
}
