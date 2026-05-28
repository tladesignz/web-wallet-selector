import type { WalletOption } from '@content/types';
import type { OpenID4VPProtocols } from '@shared/protocols';
import {
	DCQLQuerySchema,
	OpenID4VPResponseModeSchema,
	OpenID4VPResponseTypeSchema,
} from '@shared/schemas/protocols';
import {
	check,
	type InferInput,
	optional,
	pipe,
	safeParse,
	strictObject,
	string,
	unknown,
} from 'valibot';
import type { DCProtocolHandler, PreparedRequest } from '../types';

type OpenID4VPDCRequest = InferInput<typeof OpenID4VPDCRequestSchema>;
const OpenID4VPDCRequestSchema = pipe(
	strictObject({
		nonce: optional(string()),
		state: optional(string()),
		client_metadata: optional(unknown()), // TODO: types this.
		dcql_query: optional(DCQLQuerySchema), // TODO: type this.
		response_type: optional(OpenID4VPResponseTypeSchema),
		response_mode: optional(OpenID4VPResponseModeSchema),
	}),
	check(
		(input) => input.client_metadata != null || input.dcql_query != null,
		'Either client_metadata or dcql_query is required.',
	),
);

export class OpenID4VPDCHandler implements DCProtocolHandler {
	constructor(public readonly protocol: OpenID4VPProtocols) {}

	public prepareRequest(requestData: unknown): PreparedRequest<OpenID4VPDCRequest> {
		if (!requestData || typeof requestData !== 'object') {
			throw new Error('OpenID4VP request data must be an object');
		}

		const { success, output } = safeParse(OpenID4VPDCRequestSchema, requestData);

		if (!success) {
			throw new Error('failed to parse request');
		}

		console.debug('DC API request detected, passing through');

		return {
			...output,
			protocol: this.protocol,
			timestamp: new Date().toISOString(),
		};
	}

	public buildUrl(wallet: WalletOption, request: OpenID4VPDCRequest, requestId: string): URL {
		if (!wallet.url) throw new Error('Wallet URL is required');
		const url = new URL(wallet.url);

		// Always include request_id for response correlation
		url.searchParams.set('request_id', requestId);

		url.searchParams.set('client_id', window.location.origin);
		url.searchParams.set('response_type', request.response_type || 'vp_token');
		url.searchParams.set('response_mode', request.response_mode || 'dc_api');
		if (request.nonce) url.searchParams.set('nonce', request.nonce);
		url.searchParams.set('response_uri', window.location.href);
		url.searchParams.set('client_metadata', JSON.stringify(request.client_metadata || {}));
		url.searchParams.set('dcql_query', JSON.stringify(request.dcql_query || {}));
		if (request.state) url.searchParams.set('state', request.state);

		return url;
	}
}
