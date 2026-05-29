/**
 * Tests for OpenID4VP Protocol Plugin
 * Based on wwWallet implementation patterns
 */

import { OpenID4VPPlugin } from '../../../../../src/content/protocols';
import type { RequestData, OpenID4VPResponse } from '../../../../../src/content/protocols/plugins/types';

// Partial request data for URL-based inputs
type URLOnlyRequest = { url: string };

type PresentationDefinition = {
	id: string;
	input_descriptors: Array<{
		id: string;
		format?: { jwt_vc?: { alg: string[] } };
		constraints?: { fields?: Array<{ path: string[] }> };
	}>;
};

type DCQLQuery = {
	credentials: Array<{
		id: string;
		format: string;
		meta?: { vct_values?: string[] };
		claims?: Array<{ path: string[] }>;
	}>;
};

type ClientMetadata = {
	client_name?: string;
	authorization_encrypted_response_alg?: string;
	authorization_encrypted_response_enc?: string;
};

describe.skip('OpenID4VPPlugin', () => {
	let plugin: OpenID4VPPlugin;

	beforeEach(() => {
		plugin = new OpenID4VPPlugin();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Protocol Identification', () => {
		it('should have correct protocol ID', () => {
			expect(plugin.getProtocolId()).toBe('openid4vp');
		});
	});

	describe('Request Preparation - Direct Parameters', () => {
		it('should prepare request with URL containing all parameters', () => {
			const requestData: URLOnlyRequest = {
				url: 'openid4vp://?client_id=x509_san_dns:verifier.example.com&request_uri=https://verifier.example.com/request/abc123',
			};

			const prepared = plugin.prepareRequest(requestData as unknown as RequestData);

			expect(prepared).toHaveProperty('client_id', 'x509_san_dns:verifier.example.com');
			expect(prepared).toHaveProperty('request_uri', 'https://verifier.example.com/request/abc123');
			expect(prepared).toHaveProperty('protocol', 'openid4vp');
			expect(prepared).toHaveProperty('timestamp');
		});

		it('should prepare request with presentation_definition', () => {
			const presentationDef: PresentationDefinition = {
				id: 'test-def-123',
				input_descriptors: [
					{
						id: 'credential-1',
						format: { jwt_vc: { alg: ['ES256'] } },
						constraints: {
							fields: [
								{
									path: ['$.credentialSubject.name'],
								},
							],
						},
					},
				],
			};

			const requestData: URLOnlyRequest = {
				url: `openid4vp://?client_id=https://verifier.example.com&presentation_definition=${encodeURIComponent(JSON.stringify(presentationDef))}&response_uri=https://verifier.example.com/callback&nonce=abc123`,
			};

			const prepared = plugin.prepareRequest(requestData as unknown as RequestData);

			expect(prepared.client_id).toBe('https://verifier.example.com');
			expect(prepared.presentation_definition).toEqual(presentationDef);
			expect(prepared.response_uri).toBe('https://verifier.example.com/callback');
			expect(prepared.nonce).toBe('abc123');
		});

		it('should prepare request with presentation_definition_uri', () => {
			const requestData: URLOnlyRequest = {
				url: 'openid4vp://?client_id=x509_san_dns:verifier.example.com&presentation_definition_uri=https://verifier.example.com/definitions/123&response_uri=https://verifier.example.com/callback&nonce=xyz789',
			};

			const prepared = plugin.prepareRequest(requestData as unknown as RequestData);

			expect(prepared.presentation_definition_uri).toBe('https://verifier.example.com/definitions/123');
			expect(prepared.nonce).toBe('xyz789');
		});

		it('should prepare request with DCQL query', () => {
			const dcqlQuery: DCQLQuery = {
				credentials: [
					{
						id: 'cred-1',
						format: 'vc+sd-jwt',
						meta: { vct_values: ['https://example.com/credentials/employee'] },
						claims: [{ path: ['name'] }, { path: ['email'] }],
					},
				],
			};

			const requestData: URLOnlyRequest = {
				url: `openid4vp://?client_id=https://verifier.example.com&dcql_query=${encodeURIComponent(JSON.stringify(dcqlQuery))}&response_uri=https://verifier.example.com/callback&nonce=dcql123`,
			};

			const prepared = plugin.prepareRequest(requestData as unknown as RequestData);

			expect(prepared.dcql_query).toEqual(dcqlQuery);
		});

		it('should parse client_metadata', () => {
			const clientMetadata: ClientMetadata = {
				client_name: 'Example Verifier',
				authorization_encrypted_response_alg: 'ECDH-ES',
				authorization_encrypted_response_enc: 'A256GCM',
			};

			const requestData: URLOnlyRequest = {
				url: `openid4vp://?client_id=https://verifier.example.com&request_uri=https://verifier.example.com/req&client_metadata=${encodeURIComponent(JSON.stringify(clientMetadata))}`,
			};

			const prepared = plugin.prepareRequest(requestData as unknown as RequestData);

			expect(prepared.client_metadata).toEqual(clientMetadata);
		});

		it('should parse response_mode', () => {
			const requestData: URLOnlyRequest = {
				url: 'openid4vp://?client_id=https://verifier.example.com&request_uri=https://verifier.example.com/req&response_mode=direct_post.jwt',
			};

			const prepared = plugin.prepareRequest(requestData as unknown as RequestData);

			expect(prepared.response_mode).toBe('direct_post.jwt');
		});
	});

	describe('Request Preparation - Parsed Parameters', () => {
		it('should accept already-parsed parameters', () => {
			const requestData: RequestData = {
				client_id: 'x509_san_dns:verifier.example.com',
				request_uri: 'https://verifier.example.com/request/123',
				nonce: 'test-nonce',
				state: 'test-state',
			};

			const prepared = plugin.prepareRequest(requestData);

			expect(prepared.client_id).toBe('x509_san_dns:verifier.example.com');
			expect(prepared.request_uri).toBe('https://verifier.example.com/request/123');
			expect(prepared.nonce).toBe('test-nonce');
			expect(prepared.state).toBe('test-state');
		});
	});

	describe('Request Validation', () => {
		it('should reject request without client_id', () => {
			const requestData: URLOnlyRequest = {
				url: 'openid4vp://?request_uri=https://verifier.example.com/req',
			};

			expect(() => plugin.prepareRequest(requestData as unknown as RequestData)).toThrow('must include client_id');
		});

		it('should reject request without presentation mechanism', () => {
			const requestData: URLOnlyRequest = {
				url: 'openid4vp://?client_id=https://verifier.example.com&response_uri=https://verifier.example.com/callback',
			};

			expect(() => plugin.prepareRequest(requestData as unknown as RequestData)).toThrow(
				'must include request_uri, presentation_definition, presentation_definition_uri, or dcql_query',
			);
		});

		it('should warn on unsupported client_id_scheme', () => {
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const requestData: URLOnlyRequest = {
				url: 'openid4vp://?client_id=did:web:verifier.example.com&request_uri=https://verifier.example.com/req',
			};

			plugin.prepareRequest(requestData as unknown as RequestData);

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("client_id_scheme 'did' may not be supported"));

			consoleSpy.mockRestore();
		});

		it('should accept x509_san_dns client_id_scheme', () => {
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const requestData: URLOnlyRequest = {
				url: 'openid4vp://?client_id=x509_san_dns:verifier.example.com&request_uri=https://verifier.example.com/req',
			};

			plugin.prepareRequest(requestData as unknown as RequestData);

			expect(consoleSpy).not.toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		it('should accept https URL as client_id', () => {
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const requestData: URLOnlyRequest = {
				url: 'openid4vp://?client_id=https://verifier.example.com&request_uri=https://verifier.example.com/req',
			};

			plugin.prepareRequest(requestData as unknown as RequestData);

			expect(consoleSpy).not.toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		it('should reject invalid response_mode', () => {
			const requestData: URLOnlyRequest = {
				url: 'openid4vp://?client_id=https://verifier.example.com&request_uri=https://verifier.example.com/req&response_mode=invalid_mode',
			};

			expect(() => plugin.prepareRequest(requestData as unknown as RequestData)).toThrow('Invalid response_mode');
		});

		it('should accept valid response_mode: direct_post', () => {
			const requestData: URLOnlyRequest = {
				url: 'openid4vp://?client_id=https://verifier.example.com&request_uri=https://verifier.example.com/req&response_mode=direct_post',
			};

			const prepared = plugin.prepareRequest(requestData as unknown as RequestData);
			expect(prepared.response_mode).toBe('direct_post');
		});

		it('should accept valid response_mode: direct_post.jwt', () => {
			const requestData: URLOnlyRequest = {
				url: 'openid4vp://?client_id=https://verifier.example.com&request_uri=https://verifier.example.com/req&response_mode=direct_post.jwt',
			};

			const prepared = plugin.prepareRequest(requestData as unknown as RequestData);
			expect(prepared.response_mode).toBe('direct_post.jwt');
		});

		it('should reject null request data', () => {
			expect(() => plugin.prepareRequest(null as unknown as RequestData)).toThrow('must be an object');
		});

		it('should reject string request data', () => {
			expect(() => plugin.prepareRequest('invalid' as unknown as RequestData)).toThrow('must be an object');
		});

		it('should reject request without url or parameters', () => {
			expect(() => plugin.prepareRequest({} as unknown as RequestData)).toThrow('Invalid OpenID4VP request format');
		});
	});

	describe('Response Validation', () => {
		it('should validate response with vp_token and presentation_submission', () => {
			const responseData: OpenID4VPResponse = {
				vp_token: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...',
				presentation_submission: {
					id: 'submission-123',
					definition_id: 'definition-123',
					descriptor_map: [
						{
							id: 'credential-1',
							format: 'jwt_vp',
							path: '$',
						},
					],
				},
			};

			const validated = plugin.validateResponse(responseData);

			expect(validated).toEqual(responseData);
		});

		it('should validate response with encrypted response', () => {
			const responseData: OpenID4VPResponse = {
				response: 'eyJhbGciOiJFQ0RILUVTIiwiZW5jIjoiQTI1NkdDTSJ9...', // JWE
			};

			const validated = plugin.validateResponse(responseData);

			expect(validated).toEqual(responseData);
		});

		it('should validate response with state', () => {
			const responseData: OpenID4VPResponse = {
				vp_token: 'eyJhbGciOiJFUzI1NiJ9...',
				presentation_submission: {
					id: 'sub-1',
					definition_id: 'def-1',
					descriptor_map: [
						{
							id: 'cred-1',
							format: 'jwt_vp',
							path: '$',
						},
					],
				},
				state: 'original-state-123',
			};

			const validated = plugin.validateResponse(responseData);

			expect(validated.state).toBe('original-state-123');
		});

		it('should reject response without vp_token or encrypted response', () => {
			const responseData = {
				presentation_submission: {
					id: 'sub-1',
					definition_id: 'def-1',
					descriptor_map: [],
				},
			};

			expect(() => plugin.validateResponse(responseData as unknown as OpenID4VPResponse)).toThrow('must include vp_token or encrypted response');
		});

		it('should warn if vp_token present but presentation_submission missing', () => {
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const responseData: OpenID4VPResponse = {
				vp_token: 'eyJhbGciOiJFUzI1NiJ9...',
			};

			plugin.validateResponse(responseData);

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('missing presentation_submission'));

			consoleSpy.mockRestore();
		});

		it('should reject null response data', () => {
			expect(() => plugin.validateResponse(null as unknown as OpenID4VPResponse)).toThrow('Invalid OpenID4VP response');
		});

		it('should reject string response data', () => {
			expect(() => plugin.validateResponse('invalid' as unknown as OpenID4VPResponse)).toThrow('Invalid OpenID4VP response');
		});
	});

	describe('Presentation Submission Validation', () => {
		it('should validate complete presentation submission', () => {
			const responseData: OpenID4VPResponse = {
				vp_token: 'token',
				presentation_submission: {
					id: 'submission-abc',
					definition_id: 'definition-xyz',
					descriptor_map: [
						{
							id: 'input-1',
							format: 'jwt_vp',
							path: '$',
						},
						{
							id: 'input-2',
							format: 'ldp_vp',
							path: '$.verifiableCredential[0]',
						},
					],
				},
			};

			const validated = plugin.validateResponse(responseData);
			expect(validated).toEqual(responseData);
		});

		it('should reject submission without id', () => {
			const responseData = {
				vp_token: 'token',
				presentation_submission: {
					definition_id: 'def-1',
					descriptor_map: [
						{
							id: 'desc-1',
							format: 'jwt_vp',
							path: '$',
						},
					],
				},
			};

			expect(() => plugin.validateResponse(responseData as unknown as OpenID4VPResponse)).toThrow('must include id');
		});

		it('should reject submission without definition_id', () => {
			const responseData = {
				vp_token: 'token',
				presentation_submission: {
					id: 'sub-1',
					descriptor_map: [
						{
							id: 'desc-1',
							format: 'jwt_vp',
							path: '$',
						},
					],
				},
			};

			expect(() => plugin.validateResponse(responseData as unknown as OpenID4VPResponse)).toThrow('must include definition_id');
		});

		it('should reject submission without descriptor_map array', () => {
			const responseData = {
				vp_token: 'token',
				presentation_submission: {
					id: 'sub-1',
					definition_id: 'def-1',
				},
			};

			expect(() => plugin.validateResponse(responseData as unknown as OpenID4VPResponse)).toThrow('must include descriptor_map array');
		});

		it('should reject descriptor without id', () => {
			const responseData = {
				vp_token: 'token',
				presentation_submission: {
					id: 'sub-1',
					definition_id: 'def-1',
					descriptor_map: [
						{
							format: 'jwt_vp',
							path: '$',
						},
					],
				},
			};

			expect(() => plugin.validateResponse(responseData as unknown as OpenID4VPResponse)).toThrow('Descriptor 0 missing id');
		});

		it('should reject descriptor without format', () => {
			const responseData = {
				vp_token: 'token',
				presentation_submission: {
					id: 'sub-1',
					definition_id: 'def-1',
					descriptor_map: [
						{
							id: 'desc-1',
							path: '$',
						},
					],
				},
			};

			expect(() => plugin.validateResponse(responseData as unknown as OpenID4VPResponse)).toThrow('Descriptor 0 missing format');
		});

		it('should reject descriptor without path', () => {
			const responseData = {
				vp_token: 'token',
				presentation_submission: {
					id: 'sub-1',
					definition_id: 'def-1',
					descriptor_map: [
						{
							id: 'desc-1',
							format: 'jwt_vp',
						},
					],
				},
			};

			expect(() => plugin.validateResponse(responseData as unknown as OpenID4VPResponse)).toThrow('Descriptor 0 missing path');
		});
	});

	describe('Format for Wallet', () => {
		it('should format request with request_uri (JAR)', () => {
			const preparedRequest = {
				protocol: 'openid4vp',
				timestamp: new Date().toISOString(),
				client_id: 'x509_san_dns:verifier.example.com',
				request_uri: 'https://verifier.example.com/requests/abc123',
			};

			const formatted = plugin.formatForWallet(preparedRequest, 'https://wallet.example.com');

			expect(formatted.protocol).toBe('openid4vp');
			expect(formatted.walletUrl).toBe('https://wallet.example.com');
			expect(formatted.authorizationUrl).toContain('client_id=x509_san_dns%3Averifier.example.com');
			expect(formatted.authorizationUrl).toContain(
				'request_uri=https%3A%2F%2Fverifier.example.com%2Frequests%2Fabc123',
			);
			expect(formatted.requestData).toEqual(preparedRequest);
		});

		it('should format request with all direct parameters', () => {
			const preparedRequest = {
				protocol: 'openid4vp',
				timestamp: new Date().toISOString(),
				client_id: 'https://verifier.example.com',
				response_uri: 'https://verifier.example.com/callback',
				nonce: 'nonce-123',
				state: 'state-456',
				presentation_definition: { id: 'pd-1', input_descriptors: [] },
				response_mode: 'direct_post' as const,
			};

			const formatted = plugin.formatForWallet(preparedRequest, 'https://wallet.example.com');

			expect(formatted.authorizationUrl).toContain('client_id=https%3A%2F%2Fverifier.example.com');
			expect(formatted.authorizationUrl).toContain('response_uri=https%3A%2F%2Fverifier.example.com%2Fcallback');
			expect(formatted.authorizationUrl).toContain('nonce=nonce-123');
			expect(formatted.authorizationUrl).toContain('state=state-456');
			expect(formatted.authorizationUrl).toContain('response_mode=direct_post');
			expect(formatted.authorizationUrl).toContain('presentation_definition=');
		});

		it('should include DCQL query in formatted request', () => {
			const preparedRequest = {
				protocol: 'openid4vp',
				timestamp: new Date().toISOString(),
				client_id: 'https://verifier.example.com',
				response_uri: 'https://verifier.example.com/callback',
				nonce: 'nonce-123',
				dcql_query: { credentials: [{ id: 'cred-1', format: 'vc+sd-jwt' }] },
			};

			const formatted = plugin.formatForWallet(preparedRequest, 'https://wallet.example.com');

			expect(formatted.authorizationUrl).toContain('dcql_query=');
		});
	});

	describe('verifyJWT()', () => {
		type JWTVerifier = (
			jwt: string,
			options?: Record<string, unknown>,
		) => Promise<{ valid: boolean; error?: string; payload?: unknown }>;

		it('should verify JWT using wallet verifier', async () => {
			const jwt = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiIxMjM0In0.signature';
			const verifier: JWTVerifier = async () => ({ valid: true });

			const result = await plugin.verifyJWT(jwt, verifier);

			expect(result.valid).toBe(true);
		});

		it('should handle verification failure', async () => {
			const jwt = 'invalid.jwt.token';
			const verifier: JWTVerifier = async () => ({
				valid: false,
				error: 'Invalid signature',
			});

			const result = await plugin.verifyJWT(jwt, verifier);

			expect(result.valid).toBe(false);
			expect(result.error).toBe('Invalid signature');
		});

		it('should reject non-function verifiers', async () => {
			const jwt = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiIxMjM0In0.signature';

			await expect(plugin.verifyJWT(jwt, 'not a function' as unknown as JWTVerifier)).rejects.toThrow(
				'Verifier must be a function',
			);
		});

		it('should handle verifier that throws error', async () => {
			const jwt = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiIxMjM0In0.signature';
			const verifier: JWTVerifier = async () => {
				throw new Error('Crypto error');
			};

			const result = await plugin.verifyJWT(jwt, verifier);

			expect(result.valid).toBe(false);
			expect(result.error).toBe('Crypto error');
		});

		it('should validate verifier return value structure', async () => {
			const jwt = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiIxMjM0In0.signature';
			const verifier = async () => 'invalid return';

			const result = await plugin.verifyJWT(jwt, verifier as unknown as JWTVerifier);

			expect(result.valid).toBe(false);
			expect(result.error).toContain('must return an object');
		});

		it('should validate verifier includes valid property', async () => {
			const jwt = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiIxMjM0In0.signature';
			const verifier = async () => ({ payload: {} });

			const result = await plugin.verifyJWT(jwt, verifier as unknown as JWTVerifier);

			expect(result.valid).toBe(false);
			expect(result.error).toContain('must include "valid" property');
		});

		it('should pass options to verifier', async () => {
			const jwt = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiIxMjM0In0.signature';
			let receivedOptions: Record<string, unknown> | undefined;

			const verifier: JWTVerifier = async (_jwt, options) => {
				receivedOptions = options;
				return { valid: true };
			};

			const testOptions = {
				certificate: 'MIICert...',
				algorithm: 'ES256',
				kid: 'key-1',
			};

			await plugin.verifyJWT(jwt, verifier, testOptions);

			expect(receivedOptions).toEqual(testOptions);
		});
	});

	describe('handleRequestUri()', () => {
		type JWTVerifier = (
			jwt: string,
			options?: Record<string, unknown>,
		) => Promise<{ valid: boolean; error?: string; payload?: unknown }>;

		beforeEach(() => {
			globalThis.fetch = vi.fn();
		});

		afterEach(() => {
			delete (globalThis as { fetch?: unknown }).fetch;
		});

		it('should verify JWT when verifier is provided', async () => {
			const mockJWT =
				'eyJ0eXAiOiJvYXV0aC1hdXRoei1yZXErand0IiwiYWxnIjoiRVMyNTYiLCJ4NWMiOlsiTUlJQ2VydCJdfQ.eyJjbGllbnRfaWQiOiJodHRwczovL3ZlcmlmaWVyLmV4YW1wbGUuY29tIiwibm9uY2UiOiIxMjMifQ.signature';

			(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
				ok: true,
				text: async () => mockJWT,
			});

			let verifierCalled = false;
			const verifier: JWTVerifier = async (jwt, options) => {
				verifierCalled = true;
				expect(jwt).toBe(mockJWT);
				expect((options as { certificate?: string }).certificate).toBe('MIICert');
				expect((options as { algorithm?: string }).algorithm).toBe('ES256');
				return { valid: true };
			};

			const result = await plugin.handleRequestUri('https://verifier.example.com/request', {
				jwtVerifier: verifier,
			});

			expect(verifierCalled).toBe(true);
			expect(result.verified).toBe(true);
			expect(result.payload.client_id).toBe('https://verifier.example.com');
		});

		it('should throw error if verification fails', async () => {
			const mockJWT =
				'eyJ0eXAiOiJvYXV0aC1hdXRoei1yZXErand0IiwiYWxnIjoiRVMyNTYifQ.eyJjbGllbnRfaWQiOiJ0ZXN0In0.sig';

			(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
				ok: true,
				text: async () => mockJWT,
			});

			const verifier: JWTVerifier = async () => ({
				valid: false,
				error: 'Invalid signature',
			});

			await expect(
				plugin.handleRequestUri('https://verifier.example.com/request', { jwtVerifier: verifier }),
			).rejects.toThrow('JWT signature verification failed: Invalid signature');
		});

		it('should skip verification if no verifier provided', async () => {
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const mockJWT =
				'eyJ0eXAiOiJvYXV0aC1hdXRoei1yZXErand0IiwiYWxnIjoiRVMyNTYifQ.eyJjbGllbnRfaWQiOiJ0ZXN0In0.sig';

			(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
				ok: true,
				text: async () => mockJWT,
			});

			const result = await plugin.handleRequestUri('https://verifier.example.com/request');

			expect(result.verified).toBe(false);
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('JWT signature verification skipped'));

			consoleSpy.mockRestore();
		});

		it('should extract certificate from x5c header', async () => {
			const mockJWT =
				'eyJ0eXAiOiJvYXV0aC1hdXRoei1yZXErand0IiwiYWxnIjoiRVMyNTYiLCJ4NWMiOlsiQ2VydDEiLCJDZXJ0MiJdfQ.eyJub25jZSI6IjEyMyJ9.sig';

			(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
				ok: true,
				text: async () => mockJWT,
			});

			const verifier: JWTVerifier = async (_jwt, options) => {
				expect((options as { certificate?: string }).certificate).toBe('Cert1');
				return { valid: true };
			};

			await plugin.handleRequestUri('https://verifier.example.com/request', { jwtVerifier: verifier });
		});

		it('should handle verifier throwing error', async () => {
			const mockJWT =
				'eyJ0eXAiOiJvYXV0aC1hdXRoei1yZXErand0IiwiYWxnIjoiRVMyNTYifQ.eyJub25jZSI6IjEyMyJ9.sig';

			(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
				ok: true,
				text: async () => mockJWT,
			});

			const verifier: JWTVerifier = async () => {
				throw new Error('Verification failed');
			};

			await expect(
				plugin.handleRequestUri('https://verifier.example.com/request', { jwtVerifier: verifier }),
			).rejects.toThrow('JWT verification error: Verification failed');
		});

		it('should handle fetch failure', async () => {
			(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
				ok: false,
				statusText: 'Not Found',
			});

			await expect(plugin.handleRequestUri('https://verifier.example.com/request')).rejects.toThrow(
				'Failed to fetch request_uri: Not Found',
			);
		});
	});

	/**
	 * OID4VP 1.0 Spec Compliance Tests
	 * Reference: https://openid.net/specs/openid-4-verifiable-presentations-1_0.html
	 */
	describe('OID4VP 1.0 - Protocol Variants (Appendix A.1)', () => {
		it('should support openid4vp (legacy) protocol ID', () => {
			const legacyPlugin = new OpenID4VPPlugin();
			expect(legacyPlugin.getProtocolId()).toBe('openid4vp');
		});

		it('should support openid4vp-v1-unsigned variant', () => {
			const unsignedPlugin = new OpenID4VPPlugin('v1-unsigned');
			expect(unsignedPlugin.getProtocolId()).toBe('openid4vp-v1-unsigned');
		});

		it('should support openid4vp-v1-signed variant', () => {
			const signedPlugin = new OpenID4VPPlugin('v1-signed');
			expect(signedPlugin.getProtocolId()).toBe('openid4vp-v1-signed');
		});

		it('should support openid4vp-v1-multisigned variant', () => {
			const multisignedPlugin = new OpenID4VPPlugin('v1-multisigned');
			expect(multisignedPlugin.getProtocolId()).toBe('openid4vp-v1-multisigned');
		});

		it('should handle arbitrary variant strings', () => {
			const customPlugin = new OpenID4VPPlugin('custom-variant');
			expect(customPlugin.getProtocolId()).toBe('openid4vp-custom-variant');
		});
	});

	describe('OID4VP 1.0 - Response Modes (Section 8)', () => {
		// OID4VP 1.0 defines: direct_post, direct_post.jwt, dc_api, dc_api.jwt
		// Implementation validates response_mode only via URL path (not DC API passthrough)

		describe('URL-based requests (validates response_mode)', () => {
			const makeDcqlUrl = (responseMode: string) => {
				const dcqlQuery = JSON.stringify({
					credentials: [{ id: 'cred', format: 'dc+sd-jwt', meta: { vct_values: ['IdentityCredential'] } }],
				});
				return `openid4vp://?client_id=https://verifier.example.com&response_mode=${responseMode}&dcql_query=${encodeURIComponent(dcqlQuery)}`;
			};

			it('should accept response_mode: direct_post', () => {
				const request = { url: makeDcqlUrl('direct_post') };
				expect(() => plugin.prepareRequest(request as RequestData)).not.toThrow();
			});

			it('should accept response_mode: direct_post.jwt', () => {
				const request = { url: makeDcqlUrl('direct_post.jwt') };
				expect(() => plugin.prepareRequest(request as RequestData)).not.toThrow();
			});

			// TODO: OID4VP 1.0 SPEC COMPLIANCE GAP - dc_api response modes not implemented
			it.skip('should accept response_mode: dc_api (OID4VP 1.0 Section 8.2)', () => {
				// OID4VP 1.0 Section 8.2: dc_api response mode for Digital Credentials API
				const request = { url: makeDcqlUrl('dc_api') };
				expect(() => plugin.prepareRequest(request as RequestData)).not.toThrow();
			});

			// TODO: OID4VP 1.0 SPEC COMPLIANCE GAP - dc_api.jwt response mode not implemented
			it.skip('should accept response_mode: dc_api.jwt (OID4VP 1.0 Section 8.3)', () => {
				// OID4VP 1.0 Section 8.3: dc_api.jwt for encrypted responses via DC API
				const request = { url: makeDcqlUrl('dc_api.jwt') };
				expect(() => plugin.prepareRequest(request as RequestData)).not.toThrow();
			});

			it('should reject invalid response_mode', () => {
				const request = { url: makeDcqlUrl('invalid_mode') };
				expect(() => plugin.prepareRequest(request as RequestData)).toThrow('Invalid response_mode');
			});
		});

		describe('DC API passthrough (no response_mode validation)', () => {
			// When dcql_query is present, implementation bypasses validation (DC API path)
			// This is intentional per OID4VP over DC API - validation happens at DC API layer
			const baseRequest = {
				client_id: 'https://verifier.example.com',
				dcql_query: {
					credentials: [
						{ id: 'cred', format: 'dc+sd-jwt', meta: { vct_values: ['IdentityCredential'] } },
					],
				},
			};

			it('should pass through dc_api response_mode without validation', () => {
				const request = { ...baseRequest, response_mode: 'dc_api' } as unknown as RequestData;
				// Passes through because dcql_query triggers DC API path (no validation)
				expect(() => plugin.prepareRequest(request)).not.toThrow();
			});

			it('should pass through dc_api.jwt response_mode without validation', () => {
				const request = { ...baseRequest, response_mode: 'dc_api.jwt' } as unknown as RequestData;
				// Passes through because dcql_query triggers DC API path (no validation)
				expect(() => plugin.prepareRequest(request)).not.toThrow();
			});
		});
	});

	describe('OID4VP 1.0 - Client ID Schemes (Section 5.9.3)', () => {
		// OID4VP 1.0 defines client_id prefixes in Section 5.9.3
		// Implementation validates client_id only via URL path (not DC API passthrough)

		const makeDcqlUrl = (clientId: string) => {
			const dcqlQuery = JSON.stringify({
				credentials: [{ id: 'cred', format: 'dc+sd-jwt', meta: { vct_values: ['IdentityCredential'] } }],
			});
			return `openid4vp://?client_id=${encodeURIComponent(clientId)}&dcql_query=${encodeURIComponent(dcqlQuery)}`;
		};

		describe('Implemented client_id schemes (no warning)', () => {
			it('should accept https URL as client_id without warning', () => {
				const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
				const request = { url: makeDcqlUrl('https://verifier.example.com') };
				expect(() => plugin.prepareRequest(request as RequestData)).not.toThrow();
				expect(consoleSpy).not.toHaveBeenCalled();
				consoleSpy.mockRestore();
			});

			it('should accept x509_san_dns: client_id scheme without warning', () => {
				const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
				const request = { url: makeDcqlUrl('x509_san_dns:verifier.example.com') };
				expect(() => plugin.prepareRequest(request as RequestData)).not.toThrow();
				expect(consoleSpy).not.toHaveBeenCalled();
				consoleSpy.mockRestore();
			});
		});

		describe('OID4VP 1.0 client_id schemes (warn but accept)', () => {
			// These schemes are defined in OID4VP 1.0 but implementation only warns

			it('should warn for redirect_uri: client_id scheme', () => {
				// OID4VP 1.0 Section 5.9.3: redirect_uri prefix
				const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
				const request = { url: makeDcqlUrl('redirect_uri:https://verifier.example.com/callback') };
				expect(() => plugin.prepareRequest(request as RequestData)).not.toThrow();
				expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('may not be supported'));
				consoleSpy.mockRestore();
			});

			it('should warn for x509_san_uri: client_id scheme', () => {
				// OID4VP 1.0 Section 5.9.3: x509_san_uri prefix
				const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
				const request = { url: makeDcqlUrl('x509_san_uri:https://verifier.example.com') };
				expect(() => plugin.prepareRequest(request as RequestData)).not.toThrow();
				expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('may not be supported'));
				consoleSpy.mockRestore();
			});

			it('should warn for x509_hash: client_id scheme', () => {
				// OID4VP 1.0 Section 5.9.3: x509_hash prefix
				const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
				const request = { url: makeDcqlUrl('x509_hash:Uvo3HtuIxuhC92rShpgqcT3YXwrqRxWEviRiA0OZszk') };
				expect(() => plugin.prepareRequest(request as RequestData)).not.toThrow();
				expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('may not be supported'));
				consoleSpy.mockRestore();
			});

			it('should warn for verifier_attestation: client_id scheme', () => {
				// OID4VP 1.0 Section 5.9.3.4: Verifier Attestation JWT
				const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
				const request = { url: makeDcqlUrl('verifier_attestation:example-client') };
				expect(() => plugin.prepareRequest(request as RequestData)).not.toThrow();
				expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('may not be supported'));
				consoleSpy.mockRestore();
			});

			it('should warn for decentralized_identifier: client_id scheme', () => {
				// OID4VP 1.0 Section 5.9.3: decentralized_identifier prefix for DIDs
				const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
				const request = { url: makeDcqlUrl('decentralized_identifier:did:web:verifier.example.com') };
				expect(() => plugin.prepareRequest(request as RequestData)).not.toThrow();
				expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('may not be supported'));
				consoleSpy.mockRestore();
			});

			it('should warn for openid_federation: client_id scheme', () => {
				// OID4VP 1.0 Section 5.9.3: openid_federation prefix
				const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
				const request = { url: makeDcqlUrl('openid_federation:https://federation-verifier.example.com') };
				expect(() => plugin.prepareRequest(request as RequestData)).not.toThrow();
				expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('may not be supported'));
				consoleSpy.mockRestore();
			});
		});

		describe('DC API passthrough (no client_id validation)', () => {
			// When dcql_query is present directly, implementation bypasses client_id validation

			it('should pass through any client_id without validation in DC API path', () => {
				const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
				const request = {
					client_id: 'any_scheme:any_value',
					dcql_query: {
						credentials: [{ id: 'cred', format: 'dc+sd-jwt', meta: { vct_values: ['Test'] } }],
					},
				} as unknown as RequestData;
				expect(() => plugin.prepareRequest(request)).not.toThrow();
				// No warning because DC API path bypasses validation
				expect(consoleSpy).not.toHaveBeenCalled();
				consoleSpy.mockRestore();
			});
		});
	});

	describe('OID4VP 1.0 - DCQL Query (Section 6)', () => {
		// OID4VP 1.0 Section 6: Digital Credentials Query Language
		// NOTE: Implementation does NOT validate DCQL structure - passes through via DC API path
		// NOTE: Type definition DCQLQuery doesn't match OID4VP 1.0 spec:
		//   - Spec: meta is REQUIRED, claims is array of {id?, path, values?}
		//   - Type: meta missing, claims is Record<string, unknown>

		describe('DC API passthrough (no DCQL validation)', () => {
			// The presence of dcql_query triggers DC API passthrough - no structure validation

			it('should pass through DCQL query without validation', () => {
				// OID4VP 1.0 DCQL: credentials array with id, format, meta
				const request = {
					client_id: 'https://verifier.example.com',
					dcql_query: {
						credentials: [
							{
								id: 'my_credential',
								format: 'dc+sd-jwt',
								meta: { vct_values: ['https://credentials.example.com/identity_credential'] },
							},
						],
					},
				} as unknown as RequestData;

				const result = plugin.prepareRequest(request);
				expect(result.dcql_query).toBeDefined();
				expect(result.dcql_query?.credentials).toHaveLength(1);
			});

			it('should preserve dc+sd-jwt format identifier (OID4VP 1.0 spec)', () => {
				// OID4VP 1.0 spec uses dc+sd-jwt as the format identifier
				const request = {
					client_id: 'https://verifier.example.com',
					dcql_query: {
						credentials: [
							{
								id: 'my_credential',
								format: 'dc+sd-jwt',
								meta: { vct_values: ['https://credentials.example.com/identity_credential'] },
							},
						],
					},
				} as unknown as RequestData;

				const result = plugin.prepareRequest(request);
				expect(result.dcql_query?.credentials[0].format).toBe('dc+sd-jwt');
			});

			it('should preserve multiple credentials in DCQL query', () => {
				// OID4VP 1.0: Multiple credential queries in same request
				const request = {
					client_id: 'https://verifier.example.com',
					dcql_query: {
						credentials: [
							{ id: 'cred1', format: 'dc+sd-jwt', meta: { vct_values: ['IdentityCredential'] } },
							{ id: 'cred2', format: 'mso_mdoc', meta: { doctype_value: 'org.iso.18013.5.1.mDL' } },
						],
					},
				} as unknown as RequestData;

				const result = plugin.prepareRequest(request);
				expect(result.dcql_query?.credentials).toHaveLength(2);
			});

			it('should preserve claims with path pointers (OID4VP 1.0 Section 6.3)', () => {
				// OID4VP 1.0 Section 6.3: Claims Query with path property
				const request = {
					client_id: 'https://verifier.example.com',
					dcql_query: {
						credentials: [
							{
								id: 'identity',
								format: 'dc+sd-jwt',
								meta: { vct_values: ['https://credentials.example.com/identity_credential'] },
								claims: [
									{ path: ['given_name'] },
									{ path: ['family_name'] },
									{ path: ['birthdate'] },
								],
							},
						],
					},
				} as unknown as RequestData;

				const result = plugin.prepareRequest(request);
				expect(result.dcql_query?.credentials[0].claims).toHaveLength(3);
			});

			it('should pass through any DCQL structure without validation', () => {
				// Implementation does NOT validate DCQL - this is a spec compliance gap
				const request = {
					client_id: 'https://verifier.example.com',
					dcql_query: {
						credentials: [
							{ id: 'cred', format: 'invalid-format' }, // Missing required meta
						],
						invalid_property: 'should pass through', // Unknown property
					},
				} as unknown as RequestData;

				// Does not throw because no validation occurs
				const result = plugin.prepareRequest(request);
				expect(result.dcql_query).toBeDefined();
			});
		});

		describe('URL-based DCQL (parsed from query string)', () => {
			it('should parse DCQL query from URL', () => {
				const dcqlQuery = JSON.stringify({
					credentials: [
						{
							id: 'my_credential',
							format: 'dc+sd-jwt',
							meta: { vct_values: ['IdentityCredential'] },
						},
					],
				});
				const request = {
					url: `openid4vp://?client_id=https://verifier.example.com&dcql_query=${encodeURIComponent(dcqlQuery)}`,
				};

				const result = plugin.prepareRequest(request as RequestData);
				expect(result.dcql_query).toBeDefined();
				expect(result.dcql_query?.credentials[0].format).toBe('dc+sd-jwt');
			});
		});
	});

	describe('OID4VP 1.0 - Error Responses (Section 8.5)', () => {
		it('should throw invalid_request for malformed request data', () => {
			expect(() => plugin.prepareRequest(null as unknown as RequestData)).toThrow();
		});

		it('should throw invalid_request for missing client_id', () => {
			// Use URL format to test client_id validation
			const dcqlQuery = JSON.stringify({ credentials: [{ id: 'cred', format: 'vc+sd-jwt' }] });
			const request = {
				url: `openid4vp://?dcql_query=${encodeURIComponent(dcqlQuery)}`,
			};

			expect(() => plugin.prepareRequest(request as unknown as RequestData)).toThrow('must include client_id');
		});

		it('should throw invalid_request for missing presentation mechanism', () => {
			const request: RequestData = {
				client_id: 'https://verifier.example.com',
				// Missing: request_uri, presentation_definition, presentation_definition_uri, dcql_query
			};

			expect(() => plugin.prepareRequest(request)).toThrow(
				'must include request_uri, presentation_definition, presentation_definition_uri, or dcql_query',
			);
		});

		it('should throw for invalid response in validateResponse', () => {
			expect(() => plugin.validateResponse(null as unknown as OpenID4VPResponse)).toThrow(
				'Invalid OpenID4VP response',
			);
		});

		it('should throw when response missing vp_token and encrypted response', () => {
			const response: OpenID4VPResponse = {
				state: 'abc123',
				// Missing vp_token and response (encrypted)
			};

			expect(() => plugin.validateResponse(response)).toThrow(
				'must include vp_token or encrypted response',
			);
		});
	});
});

