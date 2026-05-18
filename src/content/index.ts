/**
 * Content script - relays RPC requests from page context to background script.
 */

import { runtimeSendMessage } from '@shared/runtime';
import {
	type CheckWalletMessage,
	type InboundMessage,
	InboundMessages,
	type RegisterWalletMessage,
	type ResponseFor,
	type ShowWalletSelectorMessage,
	type WalletSelectedMessage,
} from '@shared/schemas/messages';
import { RPC } from './rpc';

async function sendMessage<M extends InboundMessage>(message: M): Promise<ResponseFor<M['type']>> {
	return runtimeSendMessage(message) as Promise<ResponseFor<M['type']>>;
}

console.log('W3C Digital Credentials API Interceptor loaded');

// Inject scripts into page context
const modalScript = document.createElement('script');
modalScript.src = chrome.runtime.getURL('content/modal.js');
modalScript.onload = (event) => {
	const script = document.createElement('script');
	script.src = chrome.runtime.getURL('content/inject.js');
	script.onload = (e) => (e.target as HTMLScriptElement).remove();
	(document.head || document.documentElement).appendChild(script);
	(event.target as HTMLScriptElement).remove();
};
(document.head || document.documentElement).appendChild(modalScript);

type Payload<T> = Omit<T, 'type' | 'origin'>;

// Handle RPC requests from page context
new RPC(async (type, payload) => {
	switch (type) {
		case 'SHOW_WALLET_SELECTOR': {
			const p = payload as Payload<ShowWalletSelectorMessage>;
			return sendMessage({
				type: InboundMessages.SHOW_WALLET_SELECTOR,
				requests: p.requests,
				options: p.options,
				origin: window.location.origin,
			});
		}
		case 'WALLET_SELECTED': {
			const p = payload as Payload<WalletSelectedMessage>;
			return sendMessage({
				type: InboundMessages.WALLET_SELECTED,
				walletId: p.walletId,
				protocol: p.protocol,
				origin: window.location.origin,
			});
		}
		case 'REGISTER_WALLET': {
			const p = payload as Payload<RegisterWalletMessage>;
			return sendMessage({
				type: InboundMessages.REGISTER_WALLET,
				wallet: p.wallet,
				origin: window.location.origin,
			});
		}
		case 'CHECK_WALLET': {
			const p = payload as Payload<CheckWalletMessage>;
			return sendMessage({
				type: InboundMessages.CHECK_WALLET,
				url: p.url,
				origin: window.location.origin,
			});
		}
		case 'GET_SUPPORTED_PROTOCOLS':
			return sendMessage({
				type: InboundMessages.GET_SUPPORTED_PROTOCOLS,
				origin: window.location.origin,
			});
		default:
			throw new Error(`Unknown RPC: ${type}`);
	}
});

// Notify background
sendMessage({
	type: InboundMessages.CONTENT_SCRIPT_READY,
	origin: window.location.origin,
	timestamp: Date.now(),
}).catch(() => {});
