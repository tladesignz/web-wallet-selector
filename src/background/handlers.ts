import { runtimeSendMessage } from '@shared/runtime';
import {
	type CheckWalletMessage,
	type CheckWalletResponse,
	type ClearStatsMessage,
	type ClearStatsResponse,
	type ContentScriptReadyMessage,
	type ContentScriptReadyResponse,
	type FetchFaviconMessage,
	type FetchFaviconResponse,
	type GetSettingsMessage,
	type GetSettingsResponse,
	type GetSupportedProtocolsMessage,
	type GetSupportedProtocolsResponse,
	type GetWalletsMessage,
	type GetWalletsResponse,
	type InboundMessage,
	InboundMessageSchema,
	InboundMessages,
	type OutboundMessage,
	OutboundMessageSchema,
	OutboundMessages,
	type RegisterWalletMessage,
	type RegisterWalletResponse,
	type ResponseFor,
	type SaveSettingsMessage,
	type SaveSettingsResponse,
	type SaveWalletsMessage,
	type ShowWalletSelectorMessage,
	type ShowWalletSelectorResponse,
	type ToggleEnabledMessage,
	type ToggleEnabledResponse,
} from '@shared/schemas/messages';
import type { Options } from '@shared/schemas/resources';
import { parse } from 'valibot';
import { Stores } from './storage';
import type { MessageSenderCompat } from './types';

export async function handleMessage(
	rawMessage: unknown,
	sender: MessageSenderCompat,
	sendResponse: (r: unknown) => void,
) {
	try {
		const message = parse(InboundMessageSchema, rawMessage);
		const response = await dispatchMessage(message, sender);
		sendResponse(response);
	} catch (error) {
		console.error('Error handling message:', error);
		sendResponse({ error: error instanceof Error ? error.message : String(error) });
	}

	return true;
}

async function dispatchMessage(
	message: InboundMessage,
	sender: MessageSenderCompat,
): Promise<ResponseFor<InboundMessages>> {
	switch (message.type) {
		case InboundMessages.SHOW_WALLET_SELECTOR:
			return handleShowWalletSelector(message, sender);
		case InboundMessages.WALLET_SELECTED:
			return handleWalletSelected(message, sender);
		case InboundMessages.GET_WALLETS:
			return handleGetWallets(message, sender);
		case InboundMessages.SAVE_WALLETS:
			return handleSaveWallets(message, sender);
		case InboundMessages.GET_SETTINGS:
			return handleGetSettings(message, sender);
		case InboundMessages.SAVE_SETTINGS:
			return handleSaveSettings(message, sender);
		case InboundMessages.TOGGLE_ENABLED:
			return handleToggleEnabled(message, sender);
		case InboundMessages.REGISTER_WALLET:
			return handleRegisterWallet(message, sender);
		case InboundMessages.CHECK_WALLET:
			return handleCheckWallet(message, sender);
		case InboundMessages.GET_SUPPORTED_PROTOCOLS:
			return handleGetSupportedProtocols(message, sender);
		case InboundMessages.CONTENT_SCRIPT_READY:
			return handleContentScriptReady(message, sender);
		case InboundMessages.FETCH_FAVICON:
			return handleFetchFavicon(message, sender);
		case InboundMessages.CLEAR_STATS:
			return handleClearStats(message, sender);
		default:
			throw new Error(`Unhandled message type: ${(message as { type?: string })?.type}`);
	}
}

/** @deprecated This function is no longer used since the wallet selector is now implemented as a content script modal instead of an injected script. */
async function handleShowWalletSelector(
	message: ShowWalletSelectorMessage,
	sender: MessageSenderCompat,
): Promise<ShowWalletSelectorResponse> {
	// Check if extension is enabled
	const enabled = await isExtensionEnabled();
	if (!enabled) {
		return { useNative: true };
	}

	// Update statistics
	await updateStats('intercept');

	// Get configured wallets that support the requested protocols
	const allWallets = await getConfiguredWallets();
	const enabledWallets = allWallets.filter((w) => w.enabled);

	// Filter wallets by protocols if requests specify protocols
	let matchingWallets = enabledWallets;
	if (message.requests && Array.isArray(message.requests)) {
		const requestedProtocols = message.requests.map((r) => r.protocol);
		matchingWallets = enabledWallets.filter(
			(wallet) =>
				wallet.protocols &&
				Array.isArray(wallet.protocols) &&
				wallet.protocols.some((p) => requestedProtocols.includes(p)),
		);
	}

	// If no wallets support the requested protocols, fall back to native
	if (matchingWallets.length === 0) {
		console.log('No wallets support requested protocols, using native API');
		return { useNative: true };
	}

	// Inject modal and show wallet selector
	await injectWalletModal(sender.tab?.id, sender.frameId);

	// Send matching wallets to content script
	return { wallets: matchingWallets };
}

async function handleWalletSelected(
	message: Extract<InboundMessage, { type: InboundMessages.WALLET_SELECTED }>,
	_sender: MessageSenderCompat,
): Promise<{ success: boolean }> {
	// Record wallet usage
	await updateStats(`wallet:${message.walletId}`);

	// Here you would handle the actual credential request to the wallet
	// For now, we'll just acknowledge
	return { success: true };
}

async function handleGetWallets(
	_message: GetWalletsMessage,
	_sender: MessageSenderCompat,
): Promise<GetWalletsResponse> {
	const wallets = await getConfiguredWallets();
	return { wallets };
}

async function handleSaveWallets(
	message: SaveWalletsMessage,
	_sender: MessageSenderCompat,
): Promise<{ success: boolean }> {
	await Stores.wallets.setAll(message.wallets);
	return { success: true };
}

async function handleGetSettings(
	_message: GetSettingsMessage,
	_sender: MessageSenderCompat,
): Promise<GetSettingsResponse> {
	const enabled = await Stores.options.getEnabled();
	const developerMode = await Stores.options.getDeveloperMode();
	const stats = await Stores.stats.getStats();

	return {
		enabled: enabled !== false,
		developerMode: developerMode === true,
		stats: stats || { interceptCount: 0, walletUses: {} },
	};
}

async function handleSaveSettings(
	message: SaveSettingsMessage,
	_sender: MessageSenderCompat,
): Promise<SaveSettingsResponse> {
	const updates: Partial<Options> = {};

	if (typeof message.enabled === 'boolean') {
		updates.enabled = message.enabled;
	}

	if (typeof message.developerMode === 'boolean') {
		updates.developerMode = message.developerMode;
	}

	await Stores.options.updateOptions(updates);
	return { success: true };
}

async function handleToggleEnabled(
	message: ToggleEnabledMessage,
	_sender: MessageSenderCompat,
): Promise<ToggleEnabledResponse> {
	await Stores.options.updateOptions({ enabled: message.enabled });
	return { success: true };
}

async function handleRegisterWallet(
	message: RegisterWalletMessage,
	_sender: MessageSenderCompat,
): Promise<RegisterWalletResponse> {
	// Handle wallet auto-registration
	const wallets = await Stores.wallets.getAll();

	// Check if wallet already exists (by URL)
	const existingWallet = wallets.find((w) => w.url === message.wallet.url);

	if (existingWallet) {
		// Wallet already registered
		console.log('Wallet already registered:', message.wallet.url);
		return {
			success: true,
			alreadyRegistered: true,
			wallet: existingWallet,
		};
	}

	// Generate new wallet ID
	const walletId = `wallet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

	// Add wallet to the list
	const newWallet = {
		...message.wallet,
		id: walletId,
		enabled: true,
		autoRegistered: true,
		registeredFrom: message.origin,
		registeredAt: new Date().toISOString(),
	};

	wallets.push(newWallet);
	await Stores.wallets.setAll(wallets);

	console.log('Wallet registered:', newWallet.name, 'from', message.origin);

	return {
		success: true,
		alreadyRegistered: false,
		wallet: newWallet,
	};
}

async function handleCheckWallet(
	message: CheckWalletMessage,
	_sender: MessageSenderCompat,
): Promise<CheckWalletResponse> {
	// Check if a wallet is registered
	const wallets = await Stores.wallets.getAll();
	const isRegistered = wallets.some((w) => w.url === message.url);
	return { isRegistered };
}

async function handleGetSupportedProtocols(
	_message: GetSupportedProtocolsMessage,
	_sender: MessageSenderCompat,
): Promise<GetSupportedProtocolsResponse> {
	// Get all supported protocols
	const protocols = await getSupportedProtocols();
	return { protocols };
}

async function handleContentScriptReady(
	message: ContentScriptReadyMessage,
	_sender: MessageSenderCompat,
): Promise<ContentScriptReadyResponse> {
	// Content script has loaded
	console.log('Content script ready on:', message.origin);
	return { success: true };
}

async function handleFetchFavicon(
	message: FetchFaviconMessage,
	_sender: MessageSenderCompat,
): Promise<FetchFaviconResponse> {
	// Fetch favicon from a wallet URL via background script to avoid CORS
	try {
		const urlObj = new URL(message.url);
		const faviconUrl = `${urlObj.origin}${urlObj.pathname.replace(/\/?$/, '/')}favicon.ico`;

		const controller = new AbortController();
		const timeoutMs = message.timeout || 3000;
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

		const res = await fetch(faviconUrl, { signal: controller.signal });
		clearTimeout(timeoutId);

		if (!res.ok) {
			return { success: false };
		}

		const contentType = res.headers.get('content-type') || 'image/x-icon';
		if (!contentType.startsWith('image/')) {
			return { success: false };
		}

		const buf = await res.arrayBuffer();
		if (!buf.byteLength) {
			return { success: false };
		}

		// Convert ArrayBuffer to base64 data URI
		// (Service workers in MV3 lack FileReader/btoa for binary)
		const bytes = new Uint8Array(buf);
		let binary = '';
		for (const byte of bytes) {
			binary += String.fromCharCode(byte);
		}

		const base64 = btoa(binary);
		const dataUri = `data:${contentType};base64,${base64}`;

		return { success: true, dataUri };
	} catch (e) {
		console.error('Error fetching favicon:', e);
		return { success: false };
	}
}

/**
 * Get configured wallets
 */
async function getConfiguredWallets() {
	const result = await Stores.wallets.getAll();
	return result || [];
}

/**
 * Check if extension is enabled
 */
async function isExtensionEnabled() {
	const result = await Stores.options.getEnabled();
	return result !== false;
}

/**
 * Update usage statistics
 */
async function updateStats(action: string) {
	const result = await Stores.stats.getStats();
	const stats = result || { interceptCount: 0, walletUses: {} };

	if (action === 'intercept') {
		stats.interceptCount = (stats.interceptCount || 0) + 1;
	} else if (action.startsWith('wallet:')) {
		const walletId = action.substring(7);
		stats.walletUses[walletId] = (stats.walletUses[walletId] || 0) + 1;
	}

	await Stores.stats.setStats(stats);

	await sendMessage({ type: OutboundMessages.STATS_UPDATE, stats });
}

async function handleClearStats(
	_message: ClearStatsMessage,
	_sender: MessageSenderCompat,
): Promise<ClearStatsResponse> {
	await Stores.stats.setStats({ interceptCount: 0, walletUses: {} });
	return { success: true };
}

/**
 * Get all supported protocols from registered wallets
 */
async function getSupportedProtocols() {
	const wallets = await getConfiguredWallets();
	const enabledWallets = wallets.filter((w) => w.enabled);

	// Collect all unique protocols
	const protocols = new Set<string>();
	for (const wallet of enabledWallets) {
		if (wallet.protocols && Array.isArray(wallet.protocols)) {
			wallet.protocols.forEach((p) => {
				protocols.add(p);
			});
		}
	}

	return Array.from(protocols);
}

/**
 * Get wallets that support a specific protocol
 */
async function _getWalletsForProtocol(protocol: string) {
	const wallets = await getConfiguredWallets();
	return wallets.filter(
		(w) =>
			w.enabled &&
			w.protocols &&
			Array.isArray(w.protocols) &&
			w.protocols.includes(protocol),
	);
}

/**
 * Send messages to content scripts or other parts of the extension.
 */
async function sendMessage(message: OutboundMessage): Promise<void> {
	message = parse(OutboundMessageSchema, message);
	runtimeSendMessage(message);
}

/**
 * Inject wallet modal into the page
 *
 * @deprecated This function is no longer used since the wallet selector is
 *             now implemented as a content script modal instead of an injected script.
 */
async function injectWalletModal(tabId: number | undefined, frameId?: number) {
	if (tabId === undefined) return;
	const tabs = typeof browser !== 'undefined' ? browser.tabs : chrome.tabs;

	try {
		await tabs.executeScript(tabId, {
			file: 'modal.js',
			frameId: frameId || 0,
			runAt: 'document_end',
		});
	} catch (error) {
		console.error('Failed to inject modal:', error);
	}
}
