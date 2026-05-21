import {
	UsageStatsSchema,
	WalletRegistrationInputSchema,
	WalletSchema,
	WalletsSchema,
} from '@shared/schemas/resources';
import {
	array,
	boolean,
	type InferOutput,
	literal,
	nullish,
	number,
	object,
	optional,
	pipe,
	string,
	unknown,
	url,
	variant,
} from 'valibot';
import { defineMessage } from './utils';

/**
 * Message types sent TO the background script
 * (from content scripts, popup, and options pages).
 */
export enum InboundMessages {
	SHOW_WALLET_SELECTOR = 'SHOW_WALLET_SELECTOR',
	WALLET_SELECTED = 'WALLET_SELECTED',
	GET_WALLETS = 'GET_WALLETS',
	SAVE_WALLETS = 'SAVE_WALLETS',
	GET_SETTINGS = 'GET_SETTINGS',
	SAVE_SETTINGS = 'SAVE_SETTINGS',
	TOGGLE_ENABLED = 'TOGGLE_ENABLED',
	REGISTER_WALLET = 'REGISTER_WALLET',
	CHECK_WALLET = 'CHECK_WALLET',
	GET_SUPPORTED_PROTOCOLS = 'GET_SUPPORTED_PROTOCOLS',
	CONTENT_SCRIPT_READY = 'CONTENT_SCRIPT_READY',
	FETCH_FAVICON = 'FETCH_FAVICON',
	CLEAR_STATS = 'CLEAR_STATS',
}

export type ShowWalletSelectorMessage = InferOutput<typeof ShowWalletSelector.MESSAGE>;
export type ShowWalletSelectorResponse = InferOutput<typeof ShowWalletSelector.RESPONSE>;
export const ShowWalletSelector = defineMessage(
	literal(InboundMessages.SHOW_WALLET_SELECTOR),
	{
		requests: array(
			object({
				protocol: string(),
			}),
		),
		options: optional(unknown()),
	},
	{
		useNative: nullish(boolean()),
		wallets: nullish(WalletsSchema),
	},
);

export type WalletSelectedMessage = InferOutput<typeof WalletSelected.MESSAGE>;
export type WalletSelectedResponse = InferOutput<typeof WalletSelected.RESPONSE>;
export const WalletSelected = defineMessage(
	literal(InboundMessages.WALLET_SELECTED),
	{
		walletId: string(),
		protocol: string(),
	},
	{
		success: boolean(),
	},
);

export type GetWalletsMessage = InferOutput<typeof GetWallets.MESSAGE>;
export type GetWalletsResponse = InferOutput<typeof GetWallets.RESPONSE>;
export const GetWallets = defineMessage(
	literal(InboundMessages.GET_WALLETS),
	{},
	{
		wallets: WalletsSchema,
	},
);

export type SaveWalletsMessage = InferOutput<typeof SaveWallets.MESSAGE>;
export type SaveWalletsResponse = InferOutput<typeof SaveWallets.RESPONSE>;
export const SaveWallets = defineMessage(
	literal(InboundMessages.SAVE_WALLETS),
	{
		wallets: WalletsSchema,
	},
	{
		success: boolean(),
	},
);

export type GetSettingsMessage = InferOutput<typeof GetSettings.MESSAGE>;
export type GetSettingsResponse = InferOutput<typeof GetSettings.RESPONSE>;
export const GetSettings = defineMessage(
	literal(InboundMessages.GET_SETTINGS),
	{},
	{
		enabled: boolean(),
		developerMode: boolean(),
		stats: UsageStatsSchema,
	},
);

export type SaveSettingsMessage = InferOutput<typeof SaveSettings.MESSAGE>;
export type SaveSettingsResponse = InferOutput<typeof SaveSettings.RESPONSE>;
export const SaveSettings = defineMessage(
	literal(InboundMessages.SAVE_SETTINGS),
	{
		enabled: boolean(),
		developerMode: boolean(),
	},
	{
		success: boolean(),
	},
);

export type ToggleEnabledMessage = InferOutput<typeof ToggleEnabled.MESSAGE>;
export type ToggleEnabledResponse = InferOutput<typeof ToggleEnabled.RESPONSE>;
export const ToggleEnabled = defineMessage(
	literal(InboundMessages.TOGGLE_ENABLED),
	{
		enabled: boolean(),
	},
	{
		success: boolean(),
	},
);

export type RegisterWalletMessage = InferOutput<typeof RegisterWallet.MESSAGE>;
export type RegisterWalletResponse = InferOutput<typeof RegisterWallet.RESPONSE>;
export const RegisterWallet = defineMessage(
	literal(InboundMessages.REGISTER_WALLET),
	{
		wallet: WalletRegistrationInputSchema,
	},
	{
		success: boolean(),
		alreadyRegistered: boolean(),
		wallet: optional(WalletSchema),
		error: optional(string()),
	},
);

export type CheckWalletMessage = InferOutput<typeof CheckWallet.MESSAGE>;
export type CheckWalletResponse = InferOutput<typeof CheckWallet.RESPONSE>;
export const CheckWallet = defineMessage(
	literal(InboundMessages.CHECK_WALLET),
	{
		url: pipe(string(), url()),
	},
	{
		isRegistered: boolean(),
	},
);

export type GetSupportedProtocolsMessage = InferOutput<typeof GetSupportedProtocols.MESSAGE>;
export type GetSupportedProtocolsResponse = InferOutput<typeof GetSupportedProtocols.RESPONSE>;
export const GetSupportedProtocols = defineMessage(
	literal(InboundMessages.GET_SUPPORTED_PROTOCOLS),
	{},
	{
		protocols: array(string()),
	},
);

export type ContentScriptReadyMessage = InferOutput<typeof ContentScriptReady.MESSAGE>;
export type ContentScriptReadyResponse = InferOutput<typeof ContentScriptReady.RESPONSE>;
export const ContentScriptReady = defineMessage(
	literal(InboundMessages.CONTENT_SCRIPT_READY),
	{
		timestamp: number(),
	},
	{
		success: boolean(),
	},
);

export type FetchFaviconMessage = InferOutput<typeof FetchFavicon.MESSAGE>;
export type FetchFaviconResponse = InferOutput<typeof FetchFavicon.RESPONSE>;
export const FetchFavicon = defineMessage(
	literal(InboundMessages.FETCH_FAVICON),
	{
		url: pipe(string(), url()),
		timeout: number(),
	},
	{
		success: boolean(),
		dataUri: optional(string()),
	},
);

export type ClearStatsMessage = InferOutput<typeof ClearStats.MESSAGE>;
export type ClearStatsResponse = InferOutput<typeof ClearStats.RESPONSE>;
export const ClearStats = defineMessage(
	literal(InboundMessages.CLEAR_STATS),
	{},
	{
		success: boolean(),
	},
);

const registry = {
	[InboundMessages.SHOW_WALLET_SELECTOR]: ShowWalletSelector,
	[InboundMessages.WALLET_SELECTED]: WalletSelected,
	[InboundMessages.GET_WALLETS]: GetWallets,
	[InboundMessages.SAVE_WALLETS]: SaveWallets,
	[InboundMessages.GET_SETTINGS]: GetSettings,
	[InboundMessages.SAVE_SETTINGS]: SaveSettings,
	[InboundMessages.TOGGLE_ENABLED]: ToggleEnabled,
	[InboundMessages.REGISTER_WALLET]: RegisterWallet,
	[InboundMessages.CHECK_WALLET]: CheckWallet,
	[InboundMessages.GET_SUPPORTED_PROTOCOLS]: GetSupportedProtocols,
	[InboundMessages.CONTENT_SCRIPT_READY]: ContentScriptReady,
	[InboundMessages.FETCH_FAVICON]: FetchFavicon,
	[InboundMessages.CLEAR_STATS]: ClearStats,
};

export const InboundMessageSchema = variant(
	'type',
	Object.values(registry).map(({ MESSAGE }) => MESSAGE),
);

export type InboundMessage = InferOutput<typeof InboundMessageSchema>;

export const InboundMessageResponseSchema = variant(
	'type',
	Object.values(registry).map(({ RESPONSE_SCHEMA }) => RESPONSE_SCHEMA),
);
export type InboundMessageResponse = InferOutput<typeof InboundMessageResponseSchema>;

export type ResponseFor<K extends InboundMessages> = Extract<
	InboundMessageResponse,
	{ type: K }
>['response'];
