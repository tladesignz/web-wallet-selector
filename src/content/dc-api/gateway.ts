import { OpenID4VPProtocols, type Protocol } from '@shared/protocols';
import { type InferInput, literal, object, safeParse, string, unknown } from 'valibot';
import type { WalletOption } from '../types';
import { OpenID4VPDCHandler } from './handlers/openid4vp';
import type { DCProtocolHandler, PreparedRequest, RawCredentialRequest } from './types';

export type DCResponse = InferInput<typeof DCResponseSchema>;
const DCResponseSchema = object({
	type: literal('WC_WALLET_RESPONSE'),
	requestId: string(),
	response: unknown(), // TODO: type this.
});

type Pending = {
	timer: number;
	origin: string;
	source: Window;
	resolve: Function;
	reject: Function;
};

/**
 * Gateway layer for Digital Credentials API wallet invocation.
 *
 * Responsible for:
 * - Wallet popup lifecycle (open, timeout, close)
 * - Request/response correlation via postMessage
 * - Delegating protocol-specific concerns to handlers
 *
 * Not responsible for protocol validation or trust, that's the wallet's job.
 */
export class DCGateway {
	/**
	 * Handlers are responsible for translating between raw input and wallet-ready requests/URLs.
	 *
	 * @see {@link DCProtocolHandler}
	 */
	#handlers = new Map<Protocol, DCProtocolHandler>();
	#pending = new Map<string, Pending>();

	constructor() {
		window.addEventListener('message', (event) => this.#onMessage(event));

		for (const protocol of Object.values(OpenID4VPProtocols)) {
			this.#handlers.set(protocol, new OpenID4VPDCHandler(protocol));
		}
	}

	/**
	 * Normalizes raw credential requests into handler-prepared format.
	 * Silently drops requests that fail preparation.
	 */
	public prepareRequests(requests: RawCredentialRequest[]): PreparedRequest<unknown>[] {
		const processed: PreparedRequest<unknown>[] = [];

		for (const req of requests) {
			try {
				processed.push(this.#prepareRequest(req.protocol, req.data));
			} catch {
				console.warn('Failed to prepare request for protocol', req.protocol, '- skipping.');
			}
		}

		return processed;
	}

	/**
	 * Opens wallet in popup and waits for postMessage response.
	 * Rejects on timeout (5min) or popup blocked.
	 */
	public async invoke(
		wallet: WalletOption,
		protocol: Protocol,
		request: PreparedRequest<unknown>,
		requestId: string,
	): Promise<unknown> {
		return new Promise((resolve, reject) => {
			const url = this.#buildWalletUrl(wallet, protocol, request, requestId);

			const timer = setTimeout(() => {
				this.#pending.delete(requestId);
				reject(new DOMException('Wallet timeout', 'AbortError'));
			}, 300000);

			const win = window.open(url, '_blank');
			if (!win) {
				clearTimeout(timer);
				return reject(new Error('Popup blocked'));
			}

			this.#pending.set(requestId, {
				timer,
				origin: new URL(url).origin,
				source: win,
				resolve,
				reject,
			});
		});
	}

	#onMessage(event: MessageEvent) {
		const { success, output: data } = safeParse(DCResponseSchema, event.data);
		if (!success) return;

		const pending = this.#pending.get(data.requestId);
		if (!pending) return;

		if (event.origin !== pending.origin) return;
		if (event.source !== pending.source) {
			console.warn('Ignoring response with mismatched source');
			return;
		}

		this.#pending.delete(data.requestId);
		clearTimeout(pending.timer);
		pending.resolve(data.response);
	}

	#buildWalletUrl(
		wallet: WalletOption,
		protocol: Protocol,
		request: PreparedRequest<unknown>,
		requestId: string,
	): string {
		return this.#withHandler(protocol).buildUrl(wallet, request, requestId).toString();
	}

	#prepareRequest(protocol: Protocol, requestData: unknown) {
		return this.#withHandler(protocol).prepareRequest(requestData);
	}

	#withHandler(protocol: Protocol): DCProtocolHandler {
		const handler = this.#handlers.get(protocol);

		if (!handler) {
			throw new Error('No handler available for protocol' + protocol);
		}

		return handler;
	}
}
