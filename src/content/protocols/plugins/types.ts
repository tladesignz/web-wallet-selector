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

export type DCQLQuery = {
	credentials: Array<{
		id: string;
		format: string;
		claims?: Record<string, unknown>;
	}>;
};

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
	response_type?: 'vp_token' | 'vp_token id_token' | 'code'
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

export type ParsedJAR = JARPayload & {
	_jarHeader: JARHeader;
	_jarSignatureVerified: boolean;
};

export type JWTVerificationOptions = {
	certificate?: string;
	algorithm?: string;
	kid?: string;
};

export type JWTVerificationResult =
	| {
			valid: false;
			error: string;
	  }
	| {
			valid: true;
			payload: JARPayload;
	  };

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
