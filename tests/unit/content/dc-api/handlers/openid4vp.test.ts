/**
 * Tests for OpenID4VP DC API Handler
 */

import { OpenID4VPDCHandler } from '../../../../../src/content/dc-api/handlers/openid4vp';
import { OpenID4VPProtocols } from '../../../../../src/shared/protocols';

describe('OpenID4VPDCHandler', () => {
	let handler: OpenID4VPDCHandler;

	beforeEach(() => {
		handler = new OpenID4VPDCHandler(OpenID4VPProtocols.NORMAL);
	});

	// Valid DCQL query for tests
	const validDcqlQuery = {
		credentials: [
			{
				id: 'test-credential',
				format: 'dc+sd-jwt',
				meta: { vct_values: ['https://example.com/credential'] },
			},
		],
	};

	describe('prepareRequest', () => {
		it('should reject non-object input', () => {
			expect(() => handler.prepareRequest(null)).toThrow();
			expect(() => handler.prepareRequest('string')).toThrow();
		});

		it('should reject when both client_metadata and dcql_query are missing', () => {
			expect(() => handler.prepareRequest({ nonce: 'abc' })).toThrow();
		});

		it('should accept valid request with dcql_query', () => {
			const result = handler.prepareRequest({
				dcql_query: validDcqlQuery,
				nonce: 'test-nonce',
			});

			expect(result.protocol).toBe(OpenID4VPProtocols.NORMAL);
			expect(result.timestamp).toBeDefined();
			expect(result.nonce).toBe('test-nonce');
		});

		it('should accept valid request with client_metadata', () => {
			const result = handler.prepareRequest({
				client_metadata: { vp_formats_supported: { 'dc+sd-jwt': {} } },
			});

			expect(result.protocol).toBe(OpenID4VPProtocols.NORMAL);
			expect(result.client_metadata).toBeDefined();
		});

		it('should accept request with both client_metadata and dcql_query', () => {
			const result = handler.prepareRequest({
				client_metadata: { vp_formats_supported: { 'dc+sd-jwt': {} } },
				dcql_query: validDcqlQuery,
			});
			expect(result.client_metadata).toBeDefined();
			expect(result.dcql_query).toBeDefined();
		});

		it('should reject empty object', () => {
			expect(() => handler.prepareRequest({})).toThrow();
		});

		it('should reject invalid response_type', () => {
			expect(() => handler.prepareRequest({
				dcql_query: validDcqlQuery,
				response_type: 'invalid',
			})).toThrow();
		});

		it('should reject invalid response_mode', () => {
			expect(() => handler.prepareRequest({
				dcql_query: validDcqlQuery,
				response_mode: 'invalid',
			})).toThrow();
		});
	});

	describe('buildUrl', () => {
		const wallet = { id: '1', name: 'Test', url: 'https://wallet.example.com' };
		const request = {
			dcql_query: validDcqlQuery,
			client_metadata: { vp_formats_supported: { 'dc+sd-jwt': {} } },
		};

		it('should throw if wallet has no URL', () => {
			expect(() =>
				handler.buildUrl({ id: '1', name: 'Test' }, request, 'req-123'),
			).toThrow('Wallet URL is required');
		});

		it('should set request_id for correlation', () => {
			const url = handler.buildUrl(wallet, request, 'req-123');
			expect(url.searchParams.get('request_id')).toBe('req-123');
		});

		it('should set client_id to current origin', () => {
			const url = handler.buildUrl(wallet, request, 'req-123');
			expect(url.searchParams.get('client_id')).toBe(window.location.origin);
		});

		it('should use default response_type and response_mode', () => {
			const url = handler.buildUrl(wallet, request, 'req-123');
			expect(url.searchParams.get('response_type')).toBe('vp_token');
			expect(url.searchParams.get('response_mode')).toBe('dc_api');
		});

		it('should use custom response_type and response_mode when provided', () => {
			const url = handler.buildUrl(
				wallet,
				{
					...request,
					response_type: 'vp_token id_token',
					response_mode: 'direct_post',
				},
				'req-123',
			);

			expect(url.searchParams.get('response_type')).toBe('vp_token id_token');
			expect(url.searchParams.get('response_mode')).toBe('direct_post');
		});

		it('should include nonce and state when provided', () => {
			const url = handler.buildUrl(
				wallet,
				{
					...request,
					nonce: 'test-nonce',
					state: 'test-state',
				},
				'req-123',
			);

			expect(url.searchParams.get('nonce')).toBe('test-nonce');
			expect(url.searchParams.get('state')).toBe('test-state');
		});

		it('should JSON stringify client_metadata and dcql_query', () => {
			const url = handler.buildUrl(wallet, request, 'req-123');

			expect(url.searchParams.get('client_metadata')).toBe(
				JSON.stringify(request.client_metadata),
			);
			expect(url.searchParams.get('dcql_query')).toBe(JSON.stringify(request.dcql_query));
		});

		it('should set response_uri to current page', () => {
			const url = handler.buildUrl(wallet, request, 'req-123');
			expect(url.searchParams.get('response_uri')).toBe(window.location.href);
		});

		it('should handle wallet URL with existing query params', () => {
			const walletWithParams = { ...wallet, url: 'https://wallet.example.com?existing=param' };
			const url = handler.buildUrl(walletWithParams, request, 'req-123');
			expect(url.searchParams.get('existing')).toBe('param');
			expect(url.searchParams.get('request_id')).toBe('req-123');
		});

		it('should set empty object for missing client_metadata', () => {
			const url = handler.buildUrl(wallet, { dcql_query: validDcqlQuery }, 'req-123');
			expect(url.searchParams.get('client_metadata')).toBe('{}');
		});

		it('should set empty object for missing dcql_query', () => {
			const url = handler.buildUrl(wallet, { client_metadata: {} }, 'req-123');
			expect(url.searchParams.get('dcql_query')).toBe('{}');
		});
	});
});
