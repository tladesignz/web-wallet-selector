import type { WalletRegistrationInput } from '@shared/schemas/resources';
import type { WalletCompanionInterface } from './WalletCompanionInterface';

export * from './public-api/DigitalCredentialsInterface';
export * from './public-api/WalletCompanionInterface';

declare global {
	interface Window {
		showWalletSelector: ShowWalletSelectorFunction;
		WalletCompanion: WalletCompanionInterface;
	}
}

/**
 * For the stored wallet format, see `Wallet` in `@shared/schemas/resources`.
 */
export type WalletOption = {
	id: string;
	name: string;
	description?: string | null;
	url?: string | null;
	icon?: string | null;
	protocols?: string[] | null;
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
