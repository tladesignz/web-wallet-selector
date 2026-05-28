/**
 * Injected script that runs in the page context
 * Intercepts navigator.credentials.get() calls for the Digital Credentials API
 */

import { isProtocol, type Protocol, protocolsToArray } from '@shared/protocols';
import { DCGateway } from './dc-api/gateway';
import type { PreparedRequest } from './dc-api/types';
import { selectWalletModal } from './modals/select-wallet';
import { WalletCompanion } from './public-api/WalletCompanion';
import { RPC } from './rpc';
import type { WalletOption } from './types';

console.debug('Digital Credentials API interceptor injected');

const originalCredentialsGet = navigator.credentials.get.bind(navigator.credentials);

const rpc = new RPC();
const publicAPI = new WalletCompanion(rpc);
const dcGateway = new DCGateway();

// const protocolRegistry = new ProtocolPluginRegistry();

// for (const protocol of Object.values(OpenID4VPProtocols)) {
// 	const variant =
// 		protocol === OpenID4VPProtocols.NORMAL ? undefined : protocol.replace('openid4vp-', '');
// 	protocolRegistry.register(new OpenID4VPPlugin(variant));
// }

// Override DigitalCredential.userAgentAllowsProtocol
if (typeof DigitalCredential !== 'undefined') {
	const original = DigitalCredential.userAgentAllowsProtocol?.bind(DigitalCredential);
	DigitalCredential.userAgentAllowsProtocol = (protocol) => {
		if (protocolsToArray().includes(protocol as Protocol)) return true;
		return original?.(protocol) ?? false;
	};
}

type DigitalIdentityRequest = {
	identity?: boolean;
	digital?: { requests: Array<{ protocol: string; data: unknown }> };
	mediation?: 'optional' | 'required' | 'silent';
};

/**
 * Override navigator.credentials.get
 */
navigator.credentials.get = async (options?: CredentialRequestOptions & DigitalIdentityRequest) => {
	console.debug('navigator.credentials.get intercepted:', options);

	const requestId = crypto.randomUUID();
	const digitalRequests = options?.digital?.requests || [];
	const isDigital = options && (options.identity || options.digital);

	if (!isDigital || digitalRequests.length === 0) {
		return originalCredentialsGet(options);
	}

	// Filter by supported protocols
	const supportedRequests = digitalRequests.filter(
		(req): req is { protocol: Protocol; data: unknown } => isProtocol(req.protocol),
	);

	if (supportedRequests.length === 0) {
		return originalCredentialsGet(options);
	}

	const preparedRequests = dcGateway.prepareRequests(supportedRequests);

	if (preparedRequests.length === 0) {
		return originalCredentialsGet(options);
	}

	// Get wallets from content script
	const { useNative, wallets } = await rpc.send<{ useNative?: boolean; wallets?: WalletOption[] }>(
		'SHOW_WALLET_SELECTOR',
		{ requests: preparedRequests },
	);

	if (useNative) {
		return originalCredentialsGet(options);
	}

	if (!wallets || wallets.length === 0) {
		throw new DOMException('No wallets available', 'AbortError');
	}

	// Show modal and wait for selection
	const selection = await showWalletSelector(wallets, preparedRequests);

	if (!selection) {
		throw new DOMException('User cancelled', 'AbortError');
	}

	if ('useNative' in selection) {
		return originalCredentialsGet(options);
	}

	// Notify background of selection
	await rpc.send('WALLET_SELECTED', {
		walletId: selection.wallet.id,
		protocol: selection.protocol,
	});

	// Invoke wallet and wait for response
	const response = await dcGateway.invoke(
		selection.wallet,
		selection.protocol,
		selection.request,
		requestId,
	);

	// return credential for verifier to validate.
	const credential = {
		type: 'digital' as const,
		protocol: selection.protocol,
		data: response,
		id: `credential-${Date.now()}`,
	};

	return {
		...credential,
		toJSON: () => credential,
	};
};

export type SupportedCredentialRequest = {
	protocol: Protocol;
	data: unknown;
};

export type WalletSelection = {
	wallet: WalletOption;
	protocol: Protocol;
	request: PreparedRequest<unknown>;
	useNative?: boolean;
};

type SelectionResult = WalletSelection | { useNative: true } | null;

/**
 * Show wallet selector modal
 */
async function showWalletSelector(
	wallets: WalletOption[],
	requests: PreparedRequest<unknown>[],
): Promise<SelectionResult> {
	return new Promise((resolve) => {
		selectWalletModal({
			wallets,
			onSelect(wallet: WalletOption) {
				const selectedRequest =
					requests
						.filter((req) => req !== null)
						.find((req) => wallet.protocols?.includes(req.protocol)) ?? requests[0];

				resolve({
					wallet,
					protocol: selectedRequest.protocol,
					request: selectedRequest,
				});
			},
			onNative() {
				resolve({ useNative: true });
			},
			onCancel() {
				resolve(null);
			},
		});
	});
}

/**
 * Invoke wallet and wait for response
 */
// function invokeWallet(
// 	wallet: WalletOption,
// 	protocol: string,
// 	request: ProcessedRequest,
// 	requestId: string,
// ): Promise<unknown> {
// 	return new Promise((resolve, reject) => {
// 		const walletUrl = buildWalletUrl(wallet, protocol, request, requestId);

// 		const timer = setTimeout(() => {
// 			window.removeEventListener('message', handler);
// 			reject(new DOMException('Wallet timeout', 'AbortError'));
// 		}, 300000);

// 		let win: WindowProxy | null;

// 		const handler = (e: MessageEvent) => {
// 			if (e.origin !== new URL(wallet.url!).origin) return;
// 			if (e.data?.type !== 'WC_WALLET_RESPONSE') return;
// 			if (e.source !== win) {
// 				console.warn('Ignoring response with mismatched source');
// 				return;
// 			}
// 			if (e.data?.requestId !== requestId) {
// 				console.debug('Ignoring response with mismatched requestId:', e.data?.requestId);
// 				return;
// 			}

// 			window.removeEventListener('message', handler);
// 			clearTimeout(timer);
// 			resolve(e.data.response);
// 		};

// 		win = window.open(walletUrl, '_blank');
// 		if (!win) {
// 			clearTimeout(timer);
// 			reject(new Error('Popup blocked'));
// 			return;
// 		}

// 		window.addEventListener('message', handler);
// 	});
// }

/**
 * Build wallet URL
 */
// function buildWalletUrl(
// 	wallet: WalletOption,
// 	protocol: string,
// 	request: ProcessedRequest,
// 	requestId: string,
// ): string {
// 	if (!wallet.url) throw new Error('Wallet URL is required');
// 	const url = new URL(wallet.url);

// 	// Always include request_id for response correlation
// 	url.searchParams.set('request_id', requestId);

// 	if (protocol.startsWith('openid4vp')) {
// 		const data = request.data as RequestData;
// 		url.searchParams.set('client_id', window.location.origin);
// 		url.searchParams.set('response_type', data.response_type || 'vp_token');
// 		url.searchParams.set('response_mode', data.response_mode || 'dc_api');
// 		if (data.nonce) url.searchParams.set('nonce', data.nonce);
// 		url.searchParams.set('response_uri', window.location.href);
// 		url.searchParams.set('client_metadata', JSON.stringify(data.client_metadata || {}));
// 		url.searchParams.set('dcql_query', JSON.stringify(data.dcql_query || {}));
// 		if (data.state) url.searchParams.set('state', data.state);
// 	} else {
// 		url.searchParams.set('request', JSON.stringify(request.data));
// 		url.searchParams.set('protocol', protocol);
// 		url.searchParams.set('origin', window.location.origin);
// 	}

// 	return url.toString();
// }

window.WalletCompanion = publicAPI;
console.debug('Digital Credentials API interception active');
