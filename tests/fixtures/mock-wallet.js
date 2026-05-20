// ============================================
// Mock Wallet - Alpine.js Component
// ============================================

const WALLET_CONFIG = {
	name: 'Mock Wallet',
	url: window.location.origin + window.location.pathname,
	protocols: ['openid4vp-v1-unsigned', 'openid4vp-v1-signed'],
	description: 'Mock wallet for testing the Digital Credentials API',
	icon: null,
	color: '#3b82f6',
};

// Accepted credential types that this wallet can issue
// These are matched against vct_values (SD-JWT) or doctype_value (mso_mdoc)
let ACCEPTED_CREDENTIAL_TYPES = ['urn:siros:id:pid', 'urn:siros:id:pid:mso_mdoc'];

// Default mock user data (can be overridden via testing API)
let mockUserData = {
	given_name: 'John',
	family_name: 'Doe',
	email: 'john.doe@example.com',
	birthdate: '1990-01-15',
	age_over_18: true,
	age_over_21: true,
	address: {
		street_address: '123 Main Street',
		locality: 'Springfield',
		region: 'IL',
		postal_code: '62701',
		country: 'US',
	},
};

const DEFAULT_ACCEPTED_TYPES = [...ACCEPTED_CREDENTIAL_TYPES];
const DEFAULT_USER_DATA = { ...mockUserData };

// Helper to check if a credential matches accepted types
function isAcceptedCredential(cred) {
	if (cred.format === 'mso_mdoc') {
		return ACCEPTED_CREDENTIAL_TYPES.includes(cred.meta?.doctype_value);
	}
	// SD-JWT: check vct_values array
	const vctValues = cred.meta?.vct_values || [];
	return vctValues.some((vct) => ACCEPTED_CREDENTIAL_TYPES.includes(vct));
}

function walletApp() {
	return {
		// Extension status
		extensionReady: false,
		extensionStatusText: 'Checking extension...',
		extensionStatusClass: '',

		// Registration
		registered: false,
		walletId: null,

		// Request handling
		currentRequest: null,
		requestError: null,
		requestStatusText: 'Awaiting request...',
		requestStatusClass: 'flash-warn',
		canRespond: false,
		openerWindow: null,

		// Activity log
		log: [],

		// Computed state JSON for display
		get stateJson() {
			return JSON.stringify(
				{
					extensionReady: this.extensionReady,
					registered: this.registered,
					walletId: this.walletId,
					currentRequest: this.currentRequest,
					openerWindow: this.openerWindow ? '[Window]' : null,
				},
				null,
				2,
			);
		},

		async init() {
			const self = this;

			// Set up watcher first
			this.$watch('currentRequest', (value) => {
				if (value) {
					this.$refs.requestDialog.showModal();
				} else {
					this.$refs.requestDialog.close();
				}
			});

			await this.checkExtension();
			await this.parseIncomingRequest();

			// Auto-register if specified
			if (window.location.search.includes('auto-register=true')) {
				await this.registerWallet();
			}

			// Expose for testing (Playwright-friendly API)
			window.mockWallet = {
				// State access
				get state() {
					return {
						extensionReady: self.extensionReady,
						registered: self.registered,
						walletId: self.walletId,
						currentRequest: self.currentRequest,
						requestError: self.requestError,
						canRespond: self.canRespond,
					};
				},
				config: WALLET_CONFIG,
				getState: () => ({
					extensionReady: self.extensionReady,
					registered: self.registered,
					walletId: self.walletId,
					currentRequest: self.currentRequest,
					requestError: self.requestError,
					canRespond: self.canRespond,
				}),

				// Action triggers
				register: () => self.registerWallet(),
				checkRegistration: () => self.checkRegistration(),
				sendResponse: (approved) => self.sendResponse(approved),

				// Activity log access
				getLog: () => [...self.log],
				clearLog: () => {
					self.log = [];
				},

				// Test isolation - reset state between tests
				reset: () => {
					self.registered = false;
					self.walletId = null;
					self.currentRequest = null;
					self.requestError = null;
					self.canRespond = false;
					self.log = [];
					self.requestStatusText = 'Awaiting request...';
					self.requestStatusClass = 'flash-warn';
					// Reset mock data to defaults
					mockUserData = { ...DEFAULT_USER_DATA };
					ACCEPTED_CREDENTIAL_TYPES = [...DEFAULT_ACCEPTED_TYPES];
				},

				// Mock data overrides for testing different scenarios
				setMockUserData: (data) => {
					mockUserData = { ...mockUserData, ...data };
				},
				getMockUserData: () => ({ ...mockUserData }),
				setAcceptedTypes: (types) => {
					ACCEPTED_CREDENTIAL_TYPES = [...types];
				},
				getAcceptedTypes: () => [...ACCEPTED_CREDENTIAL_TYPES],

				// Async wait helpers for Playwright synchronization
				waitForExtension: (timeout = 5000) => {
					return new Promise((resolve, reject) => {
						const start = Date.now();
						const check = () => {
							if (self.extensionReady) resolve(true);
							else if (Date.now() - start > timeout) reject(new Error('Extension detection timeout'));
							else setTimeout(check, 50);
						};
						check();
					});
				},
				waitForRegistration: (timeout = 5000) => {
					return new Promise((resolve, reject) => {
						const start = Date.now();
						const check = () => {
							if (self.registered) resolve(self.walletId);
							else if (Date.now() - start > timeout) reject(new Error('Registration timeout'));
							else setTimeout(check, 50);
						};
						check();
					});
				},
				waitForRequest: (timeout = 10000) => {
					return new Promise((resolve, reject) => {
						const start = Date.now();
						const check = () => {
							if (self.currentRequest) resolve(self.currentRequest);
							else if (Date.now() - start > timeout) reject(new Error('Request timeout'));
							else setTimeout(check, 50);
						};
						check();
					});
				},
			};
		},

		addLog(message) {
			const time = new Date().toLocaleTimeString();
			const id = Date.now() + Math.random().toString(36).slice(2);
			this.log.unshift({ id, time, message });
			console.log(`[Mock Wallet] ${message}`);
		},

		async checkExtension() {
			this.extensionStatusText = 'Waiting for extension...';

			// Wait for extension to be injected (with timeout)
			const startTime = Date.now();
			const timeout = 3000;

			while (typeof window.WalletCompanion === 'undefined' && Date.now() - startTime < timeout) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}

			if (typeof window.WalletCompanion === 'undefined') {
				this.extensionStatusClass = 'flash-error';
				this.extensionStatusText = 'Extension not detected (timeout)';
				this.addLog('Extension not found after timeout');
				return false;
			}

			if (window.WalletCompanion.isInstalled) {
				this.extensionStatusClass = 'flash-success';
				this.extensionStatusText = `Extension v${window.WalletCompanion.version} detected`;
				this.extensionReady = true;
				this.addLog(`Extension detected (v${window.WalletCompanion.version})`);
				return true;
			}

			this.extensionStatusClass = 'flash-error';
			this.extensionStatusText = 'Extension API not active';
			return false;
		},

		async registerWallet() {
			if (!this.extensionReady) {
				this.addLog('Cannot register: extension not ready');
				return;
			}

			try {
				this.addLog('Registering wallet...');
				const result = await window.WalletCompanion.registerWallet(WALLET_CONFIG);

				this.registered = true;
				this.walletId = result.wallet?.id;

				if (result.alreadyRegistered) {
					this.extensionStatusClass = 'flash-success';
					this.extensionStatusText = 'Wallet already registered';
					this.addLog(`Wallet already registered: ${result.wallet?.id}`);
				} else {
					this.extensionStatusClass = 'flash-success';
					this.extensionStatusText = 'Wallet registered successfully';
					this.addLog(`Wallet registered: ${result.wallet?.id}`);
				}
			} catch (error) {
				this.addLog(`Registration failed: ${error.message}`);
				this.extensionStatusClass = 'flash-error';
				this.extensionStatusText = `Error: ${error.message}`;
			}
		},

		async checkRegistration() {
			if (!this.extensionReady) return;

			this.addLog('Checking registration status...');
			try {
				const isRegistered = await window.WalletCompanion.isWalletRegistered(WALLET_CONFIG.url);
				this.addLog(`Registration check: ${isRegistered ? 'registered' : 'not registered'}`);
				this.registered = isRegistered;
			} catch (error) {
				this.addLog(`Check failed: ${error.message}`);
			}
		},

		async parseIncomingRequest() {
			const params = new URLSearchParams(window.location.search);

			// Reject JAR (request_uri) - not supported by mock wallet
			if (params.has('request_uri')) {
				this.addLog('request_uri (JAR) not supported by mock wallet');
				this.requestError = 'request_uri (JAR) not supported - use inline parameters';
				return;
			}

			if (!params.has('request_id')) {
				return;
			}

			const request = {
				request_id: params.get('request_id'),
				client_id: params.get('client_id'),
				response_type: params.get('response_type'),
				response_mode: params.get('response_mode'),
				nonce: params.get('nonce'),
				state: params.get('state'),
				response_uri: params.get('response_uri'),
				client_metadata: null,
				dcql_query: null,
			};

			try {
				if (params.has('client_metadata')) {
					request.client_metadata = JSON.parse(params.get('client_metadata'));
				}
				if (params.has('dcql_query')) {
					request.dcql_query = JSON.parse(params.get('dcql_query'));
				}
			} catch (e) {
				this.addLog('Failed to parse JSON params: ' + e.message);
			}

			this.currentRequest = request;
			this.openerWindow = window.opener;
			this.requestStatusText = 'Credential request received - awaiting user action';
			this.requestStatusClass = 'flash-warn';
			this.canRespond = true;
			this.addLog(`Request received from ${request.client_id}`);
		},

		generateMockCredential() {
			const credentials = this.currentRequest?.dcql_query?.credentials || [];

			// Filter to only accepted credential types (by vct_values or doctype_value)
			const acceptedCredentials = credentials.filter(isAcceptedCredential);

			if (acceptedCredentials.length === 0) {
				const requestedTypes = credentials.map((c) => (c.format === 'mso_mdoc' ? c.meta?.doctype_value : c.meta?.vct_values?.join(','))).join('; ');
				this.addLog(`No accepted credentials found. Requested types: ${requestedTypes}`);
				this.addLog(`Accepted types: ${ACCEPTED_CREDENTIAL_TYPES.join(', ')}`);
				return { error: 'unsupported_credential_type', error_description: `None of the requested credentials are supported. Accepted: ${ACCEPTED_CREDENTIAL_TYPES.join(', ')}` };
			}

			// Use module-level mockUserData (can be overridden via testing API)

			const vp_token = {};
			for (const cred of acceptedCredentials) {
				this.addLog(`Generating credential for: ${cred.id}`);

				if (cred.format === 'mso_mdoc') {
					// Generate mDL/mdoc format
					const namespace = 'org.iso.18013.5.1';

					const elements = [];
					for (const claim of cred.claims || []) {
						const path = claim.path || [];
						const elementId = path.length > 1 ? path[1] : path[0];

						let value = mockUserData[elementId];
						if (typeof value === 'object') {
							value = JSON.stringify(value);
						}

						elements.push({
							elementIdentifier: elementId,
							elementValue: value ?? `mock_${elementId}`,
						});
					}

					// Encode mdoc as base64 string (simulating CBOR-encoded mDL)
					const mdocObject = {
						docType: cred.meta?.doctype_value || 'org.iso.18013.5.1.mDL',
						issuerSigned: {
							nameSpaces: {
								[namespace]:
									elements.length > 0
										? elements
										: [
												{ elementIdentifier: 'given_name', elementValue: mockUserData.given_name },
												{ elementIdentifier: 'family_name', elementValue: mockUserData.family_name },
											],
							},
						},
						deviceSigned: { mock: true },
					};

					// For testing purposes, we'll just base64-encode the JSON representation of the mdoc.
					// This is obviously not how a real mdoc would be encoded. Perhaps adding cbor encoding is a future todo.
					vp_token[cred.id] = [btoa(JSON.stringify(mdocObject))];
				} else {
					// Generate SD-JWT VC format - build claims from requested paths
					const claims = {};
					for (const claim of cred.claims || []) {
						const path = claim.path || [];
						let current = claims;

						for (let i = 0; i < path.length; i++) {
							const key = path[i];
							if (i === path.length - 1) {
								let value = mockUserData;
								for (const p of path) {
									value = value?.[p];
								}
								current[key] = value ?? `mock_${key}`;
							} else {
								current[key] = current[key] || {};
								current = current[key];
							}
						}
					}

					if (Object.keys(claims).length === 0) {
						claims.given_name = mockUserData.given_name;
						claims.family_name = mockUserData.family_name;
					}

					const header = { alg: 'ES256', typ: 'vc+sd-jwt' };
					const payload = {
						iss: 'https://issuer.example.com',
						iat: Math.floor(Date.now() / 1000),
						exp: Math.floor(Date.now() / 1000) + 86400 * 365,
						vct: cred.meta?.vct_values?.[0] || 'https://credentials.example.com/identity_credential',
						...claims,
					};

					const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '');
					const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '');

					// Per OpenID4VP spec, vp_token values must be arrays
					vp_token[cred.id] = [`${headerB64}.${payloadB64}.mock_signature_${cred.id}`];
				}
			}

			return { vp_token };
		},

		sendResponse(approved) {
			if (!this.currentRequest) {
				this.addLog('No current request to respond to');
				return;
			}

			const requestId = this.currentRequest.request_id;

			if (approved) {
				const credential = this.generateMockCredential();

				if (window.opener) {
					window.opener.postMessage(
						{
							type: 'WC_WALLET_RESPONSE',
							requestId: requestId,
							response: credential,
						},
						this.currentRequest.response_uri || '*',
					);

					this.addLog(`Credential sent for request ${requestId}`);
					this.requestStatusClass = 'flash-success';
					this.requestStatusText = 'Credential sent successfully';
				} else {
					this.addLog('No opener window to send response to');
					this.requestStatusClass = 'flash-error';
					this.requestStatusText = 'No opener window found';
				}
			} else {
				if (window.opener) {
					window.opener.postMessage(
						{
							type: 'WC_WALLET_RESPONSE',
							requestId: requestId,
							error: 'user_cancelled',
						},
						this.currentRequest.response_uri || '*',
					);

					this.addLog(`Request ${requestId} denied by user`);
					this.requestStatusClass = 'flash-error';
					this.requestStatusText = 'Request denied';
				}
			}

			this.canRespond = false;

			// Close popup after short delay
			setTimeout(() => {
				if (window.opener) {
					window.close();
				}
			}, 1500);
		},
	};
}
