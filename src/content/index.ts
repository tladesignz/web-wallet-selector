/**
 * Content script for W3C Digital Credentials API interceptor
 * Intercepts navigator.credentials.get calls and provides wallet selection
 */

import type {
	DCCredentialsRequestDetail,
	DCProtocolsUpdateDetail,
	DCWalletCheckDetail,
	DCWalletRegistrationDetail,
	DCWalletSelectedDetail,
} from '@content/types';
import { runtimeSendMessage } from '@shared/runtime';
import { type InboundMessage, InboundMessages, type ResponseFor } from '@shared/schemas/messages';

/**
 * Send a message to the background script.
 */
async function sendMessage<M extends InboundMessage>(message: M): Promise<ResponseFor<M['type']>> {
	return runtimeSendMessage(message) as Promise<ResponseFor<M['type']>>;
}

console.log('W3C Digital Credentials API Interceptor loaded');

// Inject modal script (UI for wallet selection)
const modalScript = document.createElement('script');
modalScript.src = chrome.runtime.getURL('content/modal.js');
modalScript.onload = (event) => {
	// After modal is loaded, inject the main interception script
	const script = document.createElement('script');
	script.src = chrome.runtime.getURL('content/inject.js');
	script.onload = (e) => (e.target as HTMLScriptElement).remove();
	(document.head || document.documentElement).appendChild(script);
	(event.target as HTMLScriptElement).remove();
};
(document.head || document.documentElement).appendChild(modalScript);

// Listen for credential requests from the injected script
window.addEventListener('DC_CREDENTIALS_REQUEST', async (event) => {
	const { requestId, requests, options } = (event as CustomEvent<DCCredentialsRequestDetail>)
		.detail;
	console.log('Digital Credentials API call intercepted:', requestId);

	try {
		const response = await sendMessage({
			type: InboundMessages.SHOW_WALLET_SELECTOR,
			requests: requests,
			options: options,
			origin: window.location.origin,
		});

		if (response.useNative) {
			window.dispatchEvent(
				new CustomEvent('DC_CREDENTIALS_RESPONSE', {
					detail: {
						requestId: requestId,
						useNative: true,
					},
				}),
			);
			return;
		}

		// Show wallet selection modal by dispatching event to the page context
		window.dispatchEvent(
			new CustomEvent('DC_SHOW_WALLET_SELECTOR', {
				detail: {
					requestId: requestId,
					wallets: response.wallets,
					requests: requests,
				},
			}),
		);
	} catch (error) {
		console.error('Error handling credential request:', error);

		window.dispatchEvent(
			new CustomEvent('DC_CREDENTIALS_RESPONSE', {
				detail: {
					requestId: requestId,
					error: error instanceof Error ? error.message : String(error),
				},
			}),
		);
	}
});

// Listen for wallet selection from the page context (modal.js)
window.addEventListener('DC_WALLET_SELECTED', async (event) => {
	const { requestId, walletId, wallet, protocol, selectedRequest } = (
		event as CustomEvent<DCWalletSelectedDetail>
	).detail;
	console.log('Wallet selected from modal:', walletId);

	try {
		await sendMessage({
			type: InboundMessages.WALLET_SELECTED,
			walletId: walletId,
			requestId: requestId,
			protocol: protocol,
		});

		window.dispatchEvent(
			new CustomEvent('DC_INVOKE_WALLET', {
				detail: {
					requestId: requestId,
					wallet: wallet,
					protocol: protocol,
					request: selectedRequest,
				},
			}),
		);
	} catch (error) {
		console.error('Error handling wallet selection:', error);
		window.dispatchEvent(
			new CustomEvent('DC_CREDENTIALS_RESPONSE', {
				detail: {
					requestId: requestId,
					error: error instanceof Error ? error.message : String(error),
				},
			}),
		);
	}
});

// Listen for wallet registration requests
window.addEventListener('DC_WALLET_REGISTRATION_REQUEST', async (event) => {
	const { registrationId, wallet } = (event as CustomEvent<DCWalletRegistrationDetail>).detail;
	console.log('Wallet registration request:', registrationId);

	if (!wallet.url) {
		window.dispatchEvent(
			new CustomEvent('DC_WALLET_REGISTRATION_RESPONSE', {
				detail: {
					registrationId,
					success: false,
					error: 'Wallet URL is required for registration',
				},
			}),
		);
		return;
	}

	try {
		const response = await sendMessage({
			type: InboundMessages.REGISTER_WALLET,
			wallet: {
				name: wallet.name,
				url: wallet.url,
				icon: wallet.icon ?? wallet.logo,
				description: wallet.description,
				color: wallet.color,
				protocols: wallet.protocols,
			},
			origin: window.location.origin,
		});

		window.dispatchEvent(
			new CustomEvent('DC_WALLET_REGISTRATION_RESPONSE', {
				detail: {
					registrationId: registrationId,
					success: response.success,
					alreadyRegistered: response.alreadyRegistered,
					wallet: response.wallet,
					error: response.error,
				},
			}),
		);
	} catch (error) {
		console.error('Error handling wallet registration:', error);

		window.dispatchEvent(
			new CustomEvent('DC_WALLET_REGISTRATION_RESPONSE', {
				detail: {
					registrationId: registrationId,
					success: false,
					error: error instanceof Error ? error.message : String(error),
				},
			}),
		);
	}
});

// Listen for wallet check requests
window.addEventListener('DC_WALLET_CHECK_REQUEST', async (event) => {
	const { checkId, url } = (event as CustomEvent<DCWalletCheckDetail>).detail;
	console.log('Wallet check request:', checkId);

	try {
		const response = await sendMessage({
			type: InboundMessages.CHECK_WALLET,
			url: url,
		});

		window.dispatchEvent(
			new CustomEvent('DC_WALLET_CHECK_RESPONSE', {
				detail: {
					checkId: checkId,
					isRegistered: response.isRegistered,
				},
			}),
		);
	} catch (error) {
		console.error('Error checking wallet:', error);

		window.dispatchEvent(
			new CustomEvent('DC_WALLET_CHECK_RESPONSE', {
				detail: {
					checkId: checkId,
					isRegistered: false,
				},
			}),
		);
	}
});

// Listen for protocol update requests
window.addEventListener('DC_PROTOCOLS_UPDATE_REQUEST', async (event) => {
	const { updateId } = (event as CustomEvent<DCProtocolsUpdateDetail>).detail;
	console.log('Protocols update request:', updateId);

	try {
		const response = await sendMessage({
			type: InboundMessages.GET_SUPPORTED_PROTOCOLS,
		});

		window.dispatchEvent(
			new CustomEvent('DC_PROTOCOLS_UPDATE_RESPONSE', {
				detail: {
					updateId: updateId,
					protocols: response.protocols,
				},
			}),
		);
	} catch (error) {
		console.error('Error getting supported protocols:', error);

		window.dispatchEvent(
			new CustomEvent('DC_PROTOCOLS_UPDATE_RESPONSE', {
				detail: {
					updateId: updateId,
					protocols: [],
				},
			}),
		);
	}
});

(async () => {
	try {
		await sendMessage({
			type: InboundMessages.CONTENT_SCRIPT_READY,
			origin: window.location.origin,
			timestamp: Date.now(),
		});
		console.log('Content script ready message sent to background');
	} catch (_error) {}
})();
