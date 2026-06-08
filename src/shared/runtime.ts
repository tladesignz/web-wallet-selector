const IGNORED_ERRORS = ['Could not establish connection', 'Receiving end does not exist'];

/**
 * Runtime utilities for sending messages in a browser extension context.
 * Provides a unified API for both Chrome and Firefox environments.
 */
export async function runtimeSendMessage(message: unknown): Promise<unknown> {
	if (typeof browser !== 'undefined') {
		try {
			return await browser.runtime.sendMessage(message);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			if (IGNORED_ERRORS.some((e) => msg.includes(e))) return undefined;
			throw err;
		}
	}
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage(message as object, (response) => {
			if (chrome.runtime.lastError) {
				const msg = chrome.runtime.lastError.message ?? '';
				if (IGNORED_ERRORS.some((e) => msg.includes(e))) {
					resolve(undefined);
					return;
				}
				reject(new Error(msg));
				return;
			}
			resolve(response);
		});
	});
}

export type MessageSender = browser.runtime.MessageSender | chrome.runtime.MessageSender;

/**
 * Runtime utility for listening to messages in a browser extension context.
 * Provides a unified API for both Chrome and Firefox environments.
 */
export async function runtimeOnMessage<T>(
	listener: (message: T, sender: MessageSender) => void,
): Promise<void> {
	if (typeof browser !== 'undefined') {
		browser.runtime.onMessage.addListener(listener);
	} else {
		chrome.runtime.onMessage.addListener(listener);
	}
}

export function getEntryURL(entry: string) {
	const { __meta } = chrome.runtime.getManifest();

	return chrome.runtime.getURL(__meta.entries[entry]);
}
