import type { WalletOption } from '@content/types';
import type { Protocol } from '@shared/protocols';

/**
 * The raw request shape as received from the caller, before any protocol-specific
 * preparation or normalization has occurred.
 */
export type RawCredentialRequest = {
	protocol: Protocol;
	data: unknown;
};

/**
 * The prepared request shape after protocol-specific processing, ready for wallet invocation.
 */
export type PreparedRequest<T = unknown> = T & {
	protocol: Protocol;
	timestamp: string;
};

/**
 * A protocol-specific handler for Digital Credentials API wallet invocation.
 *
 * The DC API gateway is transport-oriented and protocol-agnostic: it is responsible
 * for selecting a wallet, opening it, correlating the eventual response, and
 * managing request lifecycle concerns such as timeouts.
 *
 * Different credential protocols however, could have expectations around:
 * - which input fields are relevant
 * - which fields must be normalized or defaulted
 * - which request shapes are valid for wallet handoff
 *
 * We use the protocal handlers to prepare the incoming requests to ensure they're in
 * the right format for the wallet. However, we shouldn't strive to strictly validate
 * or create trust, that is the wallets job.
 */
export interface DCProtocolHandler {
	/**
	 * Converts unknown caller input into the canonical request shape used by
	 * the DC gateway for a specific protocol.
	 */
	prepareRequest(requestData: unknown): PreparedRequest<any>;

	/**
	 * Translates a prepared protocol request into the wallet invocation URL.
	 *
	 * URL construction is protocol-owned because query parameters, encoding
	 * rules, defaults, and required fields are part of the protocol contract.
	 */
	buildUrl(wallet: WalletOption, request: any, requestId: string): URL;
}
