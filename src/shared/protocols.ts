/**
 * @fileoverview
 * Protocols supported by the extension and registered wallets.
 */

/**
 * OpenID4VP protocol variants supported by the extension and wallets.
 * Wallets can support one or more of these variants, and the extension will
 * indicate which ones are supported when showing the wallet selector.
 */
export enum OpenID4VPProtocols {
	NORMAL = 'openid4vp',
	UNSIGNED = 'openid4vp-v1-unsigned',
	SIGNED = 'openid4vp-v1-signed',
	MULTISIGNED = 'openid4vp-v1-multisigned',
}

export type Protocol = OpenID4VPProtocols;

export function protocolsToArray() {
	return [...Object.values(OpenID4VPProtocols)];
}

export function isProtocol(value: unknown): value is Protocol {
	return protocolsToArray().includes(value as Protocol);
}
