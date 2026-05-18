import type { RPC } from '@content/rpc';
import type { WalletCompanionInterface, WalletRegistrationResult } from '@content/types';
import {
	type WalletRegistrationInput,
	WalletRegistrationInputSchema,
} from '@shared/schemas/resources';
import { parse } from 'valibot';
import { DigitalCredentials } from './DigitalCredentials';

/**
 * Public API exposed to web pages when the WalletCompanion extension is installed.
 */
export class WalletCompanion implements WalletCompanionInterface {
	readonly DigitalCredentials = new DigitalCredentials();

	/** Cached protocols supported by registered wallets. */
	#supportedProtocols = new Set<string>();
	#rpc: RPC;

	constructor(rpc: RPC) {
		this.#rpc = rpc;

		this.#updateSupportedProtocols();
	}

	get version(): string {
		return import.meta.env.VITE_APP_VERSION;
	}

	get isInstalled(): boolean {
		return true;
	}

	get supportedProtocols(): readonly string[] {
		return Array.from(this.#supportedProtocols);
	}

	/** Fetches supported protocols from the extension. */
	async #updateSupportedProtocols(): Promise<void> {
		try {
			const { protocols } = await this.#rpc.send<{ protocols: string[] }>(
				'GET_SUPPORTED_PROTOCOLS',
			);
			this.#supportedProtocols = new Set(protocols);
		} catch (error) {
			console.warn('Failed to fetch supported protocols:', error);
		}
	}

	async registerWallet(walletInfo: WalletRegistrationInput): Promise<WalletRegistrationResult> {
		if (!walletInfo?.name || !walletInfo.url) {
			throw new Error('Wallet registration requires at least name and url');
		}

		if (
			!walletInfo.protocols ||
			!Array.isArray(walletInfo.protocols) ||
			walletInfo.protocols.length === 0
		) {
			throw new Error('Wallet registration requires at least one supported protocol');
		}

		// Validate URL
		try {
			new URL(walletInfo.url);
		} catch {
			throw new Error(`Invalid wallet URL: ${walletInfo.url}`);
		}

		// Validate protocol identifiers (must be ASCII lower alpha, digits, and hyphens)
		const protocolPattern = /^[a-z0-9-]+$/;
		for (const protocol of walletInfo.protocols) {
			if (!protocolPattern.test(protocol)) {
				throw new Error(
					`Invalid protocol identifier: ${protocol} (must contain only lowercase letters, digits, and hyphens)`,
				);
			}
		}

		const walletRegistration = parse(WalletRegistrationInputSchema, walletInfo);

		const result = await this.#rpc.send<WalletRegistrationResult>('REGISTER_WALLET', {
			wallet: walletRegistration,
			registeredFrom: window.location.origin,
		});

		if (result.success) {
			await this.#updateSupportedProtocols();
		}

		return result;
	}

	async isWalletRegistered(url: string): Promise<boolean> {
		const { isRegistered } = await this.#rpc.send<{ isRegistered: boolean }>('CHECK_WALLET', {
			url,
		});
		return isRegistered;
	}
}
