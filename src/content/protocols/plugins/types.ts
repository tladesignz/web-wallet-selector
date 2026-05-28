export type ClientMetadata = {
	client_name?: string;
	logo_uri?: string;
	policy_uri?: string;
	tos_uri?: string;
	jwks?: { keys: JsonWebKey[] };
	jwks_uri?: string;
	// Add more per OpenID4VP spec as needed
};

export type InputDescriptor = {
	id: string;
	format?: Record<string, { alg?: string[] }>;
	constraints?: {
		fields?: Array<{
			path: string[];
			filter?: object;
			optional?: boolean;
		}>;
	};
};

export type PresentationDefinition = {
	id: string;
	name?: string;
	purpose?: string;
	input_descriptors: InputDescriptor[];
};

// TODO: OID4VP 1.0 SPEC COMPLIANCE - Update DCQLQuery type to match spec (Section 6)
//   Current type doesn't match OID4VP 1.0 specification:
//   - meta: REQUIRED object (missing - should have vct_values for dc+sd-jwt, doctype_value for mso_mdoc)
//   - claims: should be Array<{id?: string, path: string[], values?: unknown[]}> not Record<string, unknown>
//   - multiple: OPTIONAL boolean
//   - trusted_authorities: OPTIONAL array
//   - require_cryptographic_holder_binding: OPTIONAL boolean
//   - claim_sets: OPTIONAL array
//   See: https://openid.net/specs/openid-4-verifiable-presentations-1_0.html#section-6
export type DCQLQuery = {
	credentials: Array<{
		id: string;
		format: string;
		claims?: Record<string, unknown>;
	}>;
};

/** @deprecated in favour of valibot schemas */
export type RequestData = {
	url?: string;
	client_id: string;
	request_uri?: string;
	response_uri?: string;
	nonce?: string;
	state?: string;
	presentation_definition?: PresentationDefinition;
	presentation_definition_uri?: string;
	client_metadata?: ClientMetadata;
	response_type?: 'vp_token' | 'vp_token id_token' | 'code';
	response_mode?: 'direct_post' | 'dc_api' | `${'direct_post' | 'dc_api'}.jwt`;
	dcql_query?: DCQLQuery;
};

// For parsed URL params where fields may be null
export type ParsedRequestData = {
	[K in keyof RequestData]: RequestData[K] | null;
};

export type DescriptorMapEntry = {
	id: string;
	format: string;
	path: string;
	path_nested?: DescriptorMapEntry;
};

export type PresentationSubmission = {
	id: string;
	definition_id: string;
	descriptor_map: DescriptorMapEntry[];
};

export type OpenID4VPResponse = {
	vp_token?: string;
	presentation_submission?: PresentationSubmission;
	state?: string;
	response?: string; // Encrypted JWE
};

export type JARHeader = {
	alg: string;
	typ: 'oauth-authz-req+jwt';
	kid?: string;
	x5c?: string[];
};

export type JARPayload = RequestData & {
	iss?: string;
	aud?: string;
	exp?: number;
	iat?: number;
};

export type ParsedJAR = {
	payload: JARPayload;
	header: JARHeader;
	verified: boolean;
};

/**
 * Cryptographic context for JWT verification, extracted from the JOSE header.
 */
export type JWTVerificationOptions = {
	/** Base64-encoded X.509 certificate from the `x5c` header. */
	certificate?: string;
	/** Signing algorithm from the `alg` header (e.g., `'ES256'`, `'RS256'`). */
	algorithm?: string;
	/** Key identifier from the `kid` header for JWKS lookup. */
	kid?: string;
};

/**
 * Result from a JWT verification callback.
 */
export type JWTVerificationResult = {
	/** `true` if signature verification succeeded. */
	valid: boolean;
	/** Error description on failure. */
	error?: string;
	/** Decoded payload, if the verifier returns it. */
	payload?: unknown;
};

/**
 * JWT verification callback signature.
 *
 * @todo The public API for registering these is currently broken due to browser
 * page isolation. Verifiers can still be passed directly to handleRequestUri.
 */
export type JWTVerifier = (
	jwt: string,
	options: JWTVerificationOptions,
) => Promise<JWTVerificationResult>;

export type PreparedRequest = RequestData & {
	protocol: string;
	timestamp: string;
};

export type WalletFormattedRequest = {
	authorizationUrl: string;
	requestData: PreparedRequest;
};
