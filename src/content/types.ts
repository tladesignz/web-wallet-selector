import { Wallet } from "@shared/schemas/resources";
import { WalletRegistrationInput } from "@shared/schemas/resources";

declare global {
	interface Window {
		showWalletSelector: ShowWalletSelectorFunction;
		DigitalCredentialsWalletSelector: {
			version: string;
			isInstalled(): boolean;
			registerWallet(walletInfo: Wallet): Promise<{ success: boolean; alreadyRegistered: boolean; wallet: WalletOption }>;
			isWalletRegistered(url: string): Promise<boolean>;
			registerJWTVerifier(walletUrl: string, verifyCallback: (jwt: string, options: { publicKey?: string, certificate?: string, algorithm?: string }) => Promise<{ valid: boolean, payload?: any, error?: string }>): void;
			unregisterJWTVerifier(walletUrl: string): void;
			getRegisteredJWTVerifiers(): { walletUrl: string; }[];
		}
	}
}

/**
 * For the stored wallet format, see `Wallet` in `@shared/schemas/resources`.
 */
export type WalletOption = {
	id: string;
	name: string;
	description?: string;
	url?: string;
	icon?: string;
	protocols?: string[];
};

export type ShowWalletSelectorOptions = {
	wallets: WalletOption[];
	onSelect: (wallet: WalletOption) => void;
	onNative: () => void;
	onCancel: () => void;
};

export type ShowWalletSelectorFunction = (options: ShowWalletSelectorOptions) => void;

export type CredentialRequest = {
	protocol: string;
	data: unknown;
};

export type DCCredentialsRequestDetail = {
	requestId: string;
	requests: CredentialRequest[];
	options: unknown;
};

export type DCWalletSelectedDetail = {
	requestId: string;
	walletId: string;
	wallet: WalletOption;
	protocol: string;
	selectedRequest: CredentialRequest;
};

export type DCWalletRegistrationDetail = {
	registrationId: string;
	wallet: WalletRegistrationInput;
};

export type DCWalletCheckDetail = {
	checkId: string;
	url: string;
};

export type DCProtocolsUpdateDetail = {
	updateId: string;
};
