import {
	array,
	boolean,
	type InferOutput,
	nullish,
	number,
	object,
	pipe,
	record,
	string,
	url,
} from 'valibot';

export const WalletRegistrationInputSchema = object({
	name: string(),
	url: pipe(string(), url()),
	icon: nullish(string()),
	logo: nullish(string()),
	description: nullish(string()),
	color: nullish(string()),
	protocols: nullish(array(string())),
});
export type WalletRegistrationInput = InferOutput<typeof WalletRegistrationInputSchema>;

export const WalletSchema = object({
	id: string(),
	name: string(),
	url: pipe(string(), url()),
	icon: nullish(string()),
	description: nullish(string()),
	color: nullish(string()),
	protocols: nullish(array(string())),
	enabled: boolean(),
	autoRegistered: nullish(boolean()),
	registeredFrom: nullish(string()), // Origin that triggered auto-registration
	registeredAt: nullish(string()), // ISO timestamp of registration
	iconType: nullish(string()), // Icon source: 'emoji', 'favicon', 'identicon', etc.
});
export type Wallet = InferOutput<typeof WalletSchema>;

export const WalletsSchema = array(WalletSchema);
export type Wallets = InferOutput<typeof WalletsSchema>;

export const UsageStatsSchema = object({
	interceptCount: number(),
	walletUses: record(string(), number()),
});
export type UsageStats = InferOutput<typeof UsageStatsSchema>;

export const OptionsSchema = object({
	enabled: boolean(),
	developerMode: boolean(),
});
export type Options = InferOutput<typeof OptionsSchema>;
