import type { Wallet, WalletRegistrationInput } from '@shared/schemas/resources';
import type { DigitalCredentialsInterface } from './DigitalCredentialsInterface';

/**
 * Public API for the WalletCompanion browser extension.
 *
 * @example
 * ```typescript
 * if (window.WalletCompanion?.isInstalled) {
 *   await window.WalletCompanion.registerWallet({
 *     name: 'My Wallet',
 *     url: 'https://wallet.example.com',
 *     protocols: ['openid4vp'],
 *   });
 *
 *   // DC API-specific
 *   window.WalletCompanion.DigitalCredentials;
 * }
 * ```
 */
export interface WalletCompanionInterface {
	/**
	 * Extension version.
	 */
	readonly version: string;

	/**
	 * Always `true` when the extension is active.
	 *
	 * Since `window.WalletCompanion` is undefined when the extension is not installed,
	 * use with optional chaining: `window.WalletCompanion?.isInstalled`
	 */
	readonly isInstalled: boolean;

	/**
	 * Protocol identifiers supported by at least one registered wallet.
	 * Values are determined by {@link OpenID4VPPlugin.getProtocolId}:
	 * `'openid4vp'` for the base plugin, or `'openid4vp-<variant>'` for variant instances.
	 */
	readonly supportedProtocols: readonly string[];

	/**
	 * Register a wallet with the extension.
	 *
	 * If the URL is already registered, returns the existing wallet instead of duplicating.
	 * Protocol identifiers must be lowercase alphanumeric with hyphens.
	 *
	 * @throws {Error} If validation fails or registration times out (5s)
	 *
	 * @todo replace with `requestWalletRegistration(walletInfo)` that prompts user for confirmation
	 */
	registerWallet(walletInfo: WalletRegistrationInput): Promise<WalletRegistrationResult>;

	/**
	 * Check if a wallet URL is already registered.
	 *
	 * @throws {Error} If check times out (5s)
	 */
	isWalletRegistered(url: string): Promise<boolean>;

	/**
	 * Digital Credentials API-specific features.
	 */
	readonly DigitalCredentials: DigitalCredentialsInterface;
}

/**
 * Result from wallet registration.
 */
export interface WalletRegistrationResult {
	/**
	 * `true` if the operation succeeded (new or existing wallet).
	 */
	success: boolean;

	/**
	 * `true` if the wallet URL was already registered.
	 */
	alreadyRegistered: boolean;

	/**
	 * The wallet object with generated `id` and normalized values.
	 */
	wallet: Wallet;
}
