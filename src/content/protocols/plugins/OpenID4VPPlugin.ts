/**
 * OpenID4VP Protocol Plugin
 * Based on wwWallet implementation (https://github.com/wwWallet)
 *
 * Implements OpenID for Verifiable Presentations (OpenID4VP) protocol
 * for requesting and presenting verifiable credentials.
 *
 * References:
 * - OpenID4VP spec: https://openid.net/specs/openid-4-verifiable-presentations-1_0.html
 * - wwWallet implementation: wallet-frontend/src/lib/services/OpenID4VP/OpenID4VP.ts
 */

import { ProtocolPlugin } from '../ProtocolPlugin';
import type {
	JWTVerificationOptions,
	JWTVerificationResult,
	JWTVerifier,
	OpenID4VPResponse,
	ParsedJAR,
	PreparedRequest,
	PresentationDefinition,
	PresentationSubmission,
	RequestData,
} from './types';

export class OpenID4VPPlugin extends ProtocolPlugin {
	variant: string;

	constructor(variant = '') {
		super();
		this.variant = variant;
	}

	getProtocolId(): string {
		return this.variant ? `openid4vp-${this.variant}` : 'openid4vp';
	}

	/**
	 * Parse and validate OpenID4VP authorization request
	 *
	 * The request can come in two forms:
	 * 1. Direct parameters in URL query string
	 * 2. Reference via request_uri (JAR - JWT Authorization Request)
	 */
	prepareRequest(requestData: RequestData): PreparedRequest {
		if (!requestData || typeof requestData !== 'object') {
			throw new Error('OpenID4VP request data must be an object');
		}

		console.log(
			'[OpenID4VPPlugin] prepareRequest called with:',
			JSON.stringify(requestData, null, 2),
		);

		const isDirectRequest = !requestData.url && !requestData.request_uri;

		// For Digital Credentials API, the request data is already well-formed
		// TODO: OID4VP 1.0 SPEC COMPLIANCE - Validate DCQL query structure (Section 6)
		//   - credentials[].id (REQUIRED string)
		//   - credentials[].format (REQUIRED: dc+sd-jwt, mso_mdoc, etc.)
		//   - credentials[].meta (REQUIRED object with format-specific params)
		//     - vct_values for dc+sd-jwt
		//     - doctype_value for mso_mdoc
		//   - credentials[].claims (OPTIONAL array of {id?, path, values?})
		//   See: https://openid.net/specs/openid-4-verifiable-presentations-1_0.html#section-6
		if (isDirectRequest && (requestData.client_metadata || requestData.dcql_query)) {
			console.log('[OpenID4VPPlugin] DC API request detected, passing through');
			return {
				...requestData,
				protocol: this.getProtocolId(),
				timestamp: new Date().toISOString(),
			};
		}

		// For traditional OpenID4VP flows, parse the authorization request
		const authRequest = this.#parseAuthorizationRequest(requestData);

		// Validate required parameters
		this.#validateAuthorizationRequest(authRequest);

		return {
			...authRequest,
			protocol: this.getProtocolId(),
			timestamp: new Date().toISOString(),
		} as PreparedRequest;
	}

	#parseAuthorizationRequest(requestData: RequestData): RequestData | Partial<RequestData> {
		if (requestData.url && typeof requestData.url === 'string') {
			return this.#parseUrlParams(requestData.url);
		}

		if (requestData.client_id || requestData.request_uri) {
			return requestData;
		}

		throw new Error('Invalid OpenID4VP request format: missing url or parameters');
	}

	#parseUrlParams(url: string): Partial<RequestData> {
		try {
			const authUrl = new URL(url);
			const params = authUrl.searchParams;

			return {
				url: undefined,
				client_id: params.get('client_id') ?? undefined,
				request_uri: params.get('request_uri') ?? undefined,
				response_uri: params.get('response_uri') ?? undefined,
				nonce: params.get('nonce') ?? undefined,
				state: params.get('state') ?? undefined,
				presentation_definition:
					JSON.parse(params.get('presentation_definition') ?? 'null') ?? undefined,
				presentation_definition_uri: params.get('presentation_definition_uri') ?? undefined,
				client_metadata: JSON.parse(params.get('client_metadata') ?? 'null') ?? undefined,
				response_mode: (params.get('response_mode') ??
					undefined) as RequestData['response_mode'],
				dcql_query: JSON.parse(params.get('dcql_query') ?? 'null') ?? undefined,
			};
		} catch (err) {
			throw new Error(
				`Failed to parse OpenID4VP URL: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	#validateAuthorizationRequest(authRequest: Partial<RequestData>): void {
		if (!authRequest.client_id) {
			throw new Error('OpenID4VP request must include client_id');
		}

		// TODO: OID4VP 1.0 SPEC COMPLIANCE - Support all client_id schemes (Section 5.9.3)
		//   Currently implemented: x509_san_dns, https URL
		//   Missing full support for:
		//   - redirect_uri: (Section 5.9.3)
		//   - x509_san_uri: (Section 5.9.3)
		//   - x509_hash: (Section 5.9.3)
		//   - verifier_attestation: (Section 5.9.3.4)
		//   - decentralized_identifier: (Section 5.9.3 - for DIDs)
		//   - openid_federation: (Section 5.9.3)
		//   See: https://openid.net/specs/openid-4-verifiable-presentations-1_0.html#section-5.9.3
		const client_id_scheme = authRequest.client_id.split(':')[0];
		if (client_id_scheme !== 'x509_san_dns' && !authRequest.client_id.startsWith('http')) {
			console.warn(
				`OpenID4VP: client_id_scheme '${client_id_scheme}' may not be supported. Expected 'x509_san_dns' or https URL`,
			);
		}

		if (
			!authRequest.request_uri &&
			!authRequest.presentation_definition &&
			!authRequest.presentation_definition_uri &&
			!authRequest.dcql_query
		) {
			throw new Error(
				'OpenID4VP request must include request_uri, presentation_definition, presentation_definition_uri, or dcql_query',
			);
		}

		if (authRequest.request_uri) {
			console.log('OpenID4VP: request_uri detected, requires JWT validation');
		}

		if (authRequest.response_mode) {
			// TODO: OID4VP 1.0 SPEC COMPLIANCE - Support dc_api response modes (Section 8)
			//   Missing: dc_api (Section 8.2), dc_api.jwt (Section 8.3)
			//   These are required for Digital Credentials API integration
			//   See: https://openid.net/specs/openid-4-verifiable-presentations-1_0.html#section-8
			const validModes: RequestData['response_mode'][] = ['direct_post', 'direct_post.jwt'];
			if (!validModes.includes(authRequest.response_mode)) {
				throw new Error(
					`Invalid response_mode: ${authRequest.response_mode}. Must be one of: ${validModes.join(', ')}`,
				);
			}
		}
	}

	validateResponse(responseData: OpenID4VPResponse): OpenID4VPResponse {
		if (!responseData || typeof responseData !== 'object') {
			throw new Error('Invalid OpenID4VP response');
		}

		if (!responseData.vp_token && !responseData.response) {
			throw new Error('OpenID4VP response must include vp_token or encrypted response');
		}

		if (responseData.vp_token && !responseData.presentation_submission) {
			console.warn('OpenID4VP: vp_token present but missing presentation_submission');
		}

		if (responseData.presentation_submission) {
			this.#validatePresentationSubmission(responseData.presentation_submission);
		}

		return responseData;
	}

	#validatePresentationSubmission(submission: Partial<PresentationSubmission>): void {
		if (!submission.id) {
			throw new Error('Presentation submission must include id');
		}

		if (!submission.definition_id) {
			throw new Error('Presentation submission must include definition_id');
		}

		if (!Array.isArray(submission.descriptor_map)) {
			throw new Error('Presentation submission must include descriptor_map array');
		}

		submission.descriptor_map.forEach((descriptor, index) => {
			if (!descriptor.id) {
				throw new Error(`Descriptor ${index} missing id`);
			}
			if (!descriptor.format) {
				throw new Error(`Descriptor ${index} missing format`);
			}
			if (!descriptor.path) {
				throw new Error(`Descriptor ${index} missing path`);
			}
		});
	}

	formatForWallet(preparedRequest: PreparedRequest, walletUrl: string) {
		const params = new URLSearchParams();

		if (preparedRequest.client_id) {
			params.set('client_id', preparedRequest.client_id);
		}

		if (preparedRequest.request_uri) {
			params.set('request_uri', preparedRequest.request_uri);
		} else {
			if (preparedRequest.response_uri) {
				params.set('response_uri', preparedRequest.response_uri);
			}
			if (preparedRequest.nonce) {
				params.set('nonce', preparedRequest.nonce);
			}
			if (preparedRequest.state) {
				params.set('state', preparedRequest.state);
			}
			if (preparedRequest.presentation_definition) {
				params.set(
					'presentation_definition',
					JSON.stringify(preparedRequest.presentation_definition),
				);
			}
			if (preparedRequest.presentation_definition_uri) {
				params.set(
					'presentation_definition_uri',
					preparedRequest.presentation_definition_uri,
				);
			}
			if (preparedRequest.client_metadata) {
				params.set('client_metadata', JSON.stringify(preparedRequest.client_metadata));
			}
			if (preparedRequest.response_mode) {
				params.set('response_mode', preparedRequest.response_mode);
			}
			if (preparedRequest.dcql_query) {
				params.set('dcql_query', JSON.stringify(preparedRequest.dcql_query));
			}
		}

		const walletAuthUrl = `${walletUrl}?${params.toString()}`;

		return {
			protocol: this.getProtocolId(),
			walletUrl,
			authorizationUrl: walletAuthUrl,
			requestData: preparedRequest,
		};
	}

	async fetchPresentationDefinition(uri: string): Promise<PresentationDefinition> {
		try {
			const response = await fetch(uri);
			if (!response.ok) {
				throw new Error(`Failed to fetch presentation definition: ${response.statusText}`);
			}
			return (await response.json()) as PresentationDefinition;
		} catch (err) {
			throw new Error(
				`Error fetching presentation definition from ${uri}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	async handleRequestUri(
		requestUri: string,
		options: { jwtVerifier?: JWTVerifier } = {},
	): Promise<ParsedJAR> {
		try {
			const response = await fetch(requestUri);
			if (!response.ok) {
				throw new Error(`Failed to fetch request_uri: ${response.statusText}`);
			}

			const jwt = await response.text();
			const [headerB64, payloadB64, _signature] = jwt.split('.');

			const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')));
			const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

			if (header.typ !== 'oauth-authz-req+jwt') {
				throw new Error('Invalid JWT type: expected oauth-authz-req+jwt');
			}

			if (options.jwtVerifier) {
				console.log('OpenID4VP: Verifying JWT signature using wallet-provided verifier');

				const verificationOptions: JWTVerificationOptions = {
					certificate: header.x5c?.[0],
					algorithm: header.alg,
					kid: header.kid,
				};

				try {
					const verificationResult = await options.jwtVerifier(jwt, verificationOptions);

					if (!verificationResult.valid) {
						throw new Error(
							`JWT signature verification failed: ${verificationResult.error || 'Invalid signature'}`,
						);
					}

					console.log('OpenID4VP: JWT signature verified successfully');
				} catch (err) {
					throw new Error(
						`JWT verification error: ${err instanceof Error ? err.message : String(err)}`,
					);
				}
			} else {
				console.warn(
					'OpenID4VP: JWT signature verification skipped - no verifier provided',
				);
				console.warn(
					'To enable verification, register a JWT verifier via WalletCompanion.DigitalCredentials.registerJWTVerifier()',
				);
			}

			return {
				payload,
				header,
				verified: !!options.jwtVerifier,
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			// Preserve JWT verification errors without re-wrapping
			if (message.startsWith('JWT verification error:')) {
				throw err;
			}
			throw new Error(`Error handling request_uri: ${message}`);
		}
	}

	async verifyJWT(
		jwt: string,
		verifier: JWTVerifier,
		options: JWTVerificationOptions = {},
	): Promise<JWTVerificationResult> {
		if (typeof verifier !== 'function') {
			throw new Error('Verifier must be a function');
		}

		try {
			const result = await verifier(jwt, options);

			if (!result || typeof result !== 'object') {
				throw new Error('Verifier must return an object with {valid, payload?, error?}');
			}

			if (!Object.hasOwn(result, 'valid')) {
				throw new Error('Verifier result must include "valid" property');
			}

			return result;
		} catch (err) {
			return {
				valid: false,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}
}
