// Generate cryptographically random nonce
function generateNonce() {
	const array = new Uint8Array(32);
	crypto.getRandomValues(array);
	return btoa(String.fromCharCode(...array))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '');
}

// Test request configurations (per OpenID4VP spec)
const TEST_REQUESTS = {
	basic: {
		name: 'Basic Identity Request',
		request: {
			digital: {
				requests: [
					{
						protocol: 'openid4vp-v1-unsigned',
						data: {
							response_type: 'vp_token',
							response_mode: 'dc_api',
							nonce: generateNonce(),
							dcql_query: {
								credentials: [
									{
										id: 'pid',
										format: 'dc+sd-jwt',
										meta: {
											vct_values: ['urn:siros:id:pid'],
										},
										claims: [{ path: ['given_name'] }, { path: ['family_name'] }],
									},
								],
							},
						},
					},
				],
			},
		},
	},

	age: {
		name: 'Age Verification Request',
		request: {
			digital: {
				requests: [
					{
						protocol: 'openid4vp-v1-unsigned',
						data: {
							response_type: 'vp_token',
							response_mode: 'dc_api',
							nonce: generateNonce(),
							dcql_query: {
								credentials: [
									{
										id: 'pid',
										format: 'dc+sd-jwt',
										meta: {
											vct_values: ['urn:siros:id:pid'],
										},
										claims: [{ id: 'age_check', path: ['age_over_18'], values: [true] }],
									},
								],
							},
						},
					},
				],
			},
		},
	},

	profile: {
		name: 'Full Profile Request',
		request: {
			digital: {
				requests: [
					{
						protocol: 'openid4vp-v1-unsigned',
						data: {
							response_type: 'vp_token',
							response_mode: 'dc_api',
							nonce: generateNonce(),
							client_metadata: {
								vp_formats_supported: {
									'dc+sd-jwt': { 'sd-jwt_alg_values': ['ES256'] },
								},
							},
							dcql_query: {
								credentials: [
									{
										id: 'pid',
										format: 'dc+sd-jwt',
										meta: {
											vct_values: ['urn:siros:id:pid'],
										},
										claims: [
											{ path: ['given_name'] },
											{ path: ['family_name'] },
											{ path: ['email'] },
											{ path: ['address', 'street_address'] },
											{ path: ['address', 'locality'] },
											{ path: ['address', 'postal_code'] },
										],
									},
								],
							},
						},
					},
				],
			},
		},
	},

	multi: {
		name: 'Multiple Credentials Request',
		request: {
			digital: {
				requests: [
					{
						protocol: 'openid4vp-v1-unsigned',
						data: {
							response_type: 'vp_token',
							response_mode: 'dc_api',
							nonce: generateNonce(),
							dcql_query: {
								credentials: [
									{
										id: 'pid',
										format: 'dc+sd-jwt',
										meta: { vct_values: ['urn:siros:id:pid'] },
										claims: [{ path: ['given_name'] }, { path: ['family_name'] }],
									},
									{
										id: 'mdl',
										format: 'mso_mdoc',
										meta: { doctype_value: 'urn:siros:id:pid:mso_mdoc' },
										claims: [{ path: ['org.iso.18013.5.1', 'given_name'] }, { path: ['org.iso.18013.5.1', 'family_name'] }],
									},
								],
								credential_sets: [{ options: [['pid'], ['mdl']] }],
							},
						},
					},
				],
			},
		},
	},
};

function verifierApp() {
	return {
		// Extension status
		extensionReady: false,
		extensionStatusText: 'Checking...',
		extensionStatusClass: '',

		// Result display
		resultVisible: false,
		resultStatusText: '',
		resultStatusClass: '',
		resultData: '',
		decodedTokens: [],

		// Last request/response tracking
		lastRequest: 'No request sent yet',
		lastResponse: null,
		lastError: null,

		// Activity log
		log: [],

		init() {
			const self = this;
			this.checkExtension();

			// Expose for testing (Playwright-friendly API)
			window.mockVerifier = {
				// State access
				get state() {
					return {
						extensionReady: self.extensionReady,
						resultVisible: self.resultVisible,
						lastRequest: self.lastRequest,
						lastResponse: self.lastResponse,
						lastError: self.lastError,
					};
				},
				getState: () => ({
					extensionReady: self.extensionReady,
					resultVisible: self.resultVisible,
					lastRequest: self.lastRequest,
					lastResponse: self.lastResponse,
					lastError: self.lastError,
				}),

				// Action triggers
				runTest: (id) => self.runTest(id),
				runCustomTest: (request) => self.runCustomTest(request),

				// Test configs
				getTestConfigs: () => ({ ...TEST_REQUESTS }),
				generateNonce,

				// Response access
				getLastResponse: () => self.lastResponse,
				getDecodedTokens: () => [...self.decodedTokens],

				// Activity log access
				getLog: () => [...self.log],
				clearLog: () => {
					self.log = [];
				},

				// Test isolation - reset state between tests
				reset: () => {
					self.resultVisible = false;
					self.resultStatusText = '';
					self.resultStatusClass = '';
					self.resultData = '';
					self.decodedTokens = [];
					self.lastRequest = 'No request sent yet';
					self.lastResponse = null;
					self.lastError = null;
					self.log = [];
				},

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
				waitForResponse: (timeout = 30000) => {
					return new Promise((resolve, reject) => {
						const start = Date.now();
						const check = () => {
							if (self.lastResponse) resolve(self.lastResponse);
							else if (self.lastError) reject(self.lastError);
							else if (Date.now() - start > timeout) reject(new Error('Response timeout'));
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
			console.log(`[Mock Verifier] ${message}`);
		},

		async checkExtension() {
			this.addLog('Checking for Digital Credentials API support...');

			// Check for native DigitalCredential API
			if (typeof DigitalCredential !== 'undefined') {
				this.extensionStatusClass = 'flash-success';
				this.extensionStatusText = 'Native Digital Credentials API supported';
				this.extensionReady = true;
				this.addLog('Native Digital Credentials API detected');
				return true;
			}

			// Check for extension polyfill
			if (typeof window.WalletCompanion !== 'undefined' && window.WalletCompanion.isInstalled) {
				this.extensionStatusClass = 'flash-success';
				this.extensionStatusText = `Wallet Companion extension detected (v${window.WalletCompanion.version})`;
				this.extensionReady = true;
				this.addLog(`Wallet Companion extension detected (v${window.WalletCompanion.version})`);
				return true;
			}

			this.extensionStatusClass = 'flash-error';
			this.extensionStatusText = 'No Digital Credentials API support detected';
			this.addLog('No Digital Credentials API support detected');
			return false;
		},

		async runTest(testId) {
			const test = TEST_REQUESTS[testId];
			if (!test) {
				this.addLog(`Unknown test: ${testId}`);
				console.error('Unknown test:', testId);
				return;
			}

			// Regenerate nonce for each request
			test.request.digital.requests[0].data.nonce = generateNonce();

			// Clear previous response/error
			this.lastResponse = null;
			this.lastError = null;

			// Display request
			this.lastRequest = JSON.stringify(test.request, null, 2);
			this.addLog(`Starting test: ${test.name}`);

			// Show pending status
			this.resultVisible = true;
			this.resultStatusClass = 'flash-warn';
			this.resultStatusText = `${test.name} - Waiting for wallet selection...`;
			this.resultData = '';
			this.decodedTokens = [];

			try {
				this.addLog('Calling navigator.credentials.get()...');
				console.log(`[Mock Verifier] Starting ${test.name}`);
				console.log('[Mock Verifier] Request:', test.request);

				const credential = await navigator.credentials.get(test.request);

				console.log('[Mock Verifier] Response:', credential);
				this.lastResponse = credential;

				this.resultStatusClass = 'flash-success';
				this.resultStatusText = `${test.name} - Credential received successfully!`;
				this.resultData = JSON.stringify(credential, null, 2);
				this.decodeCredentials(credential);
				this.addLog(`Credential received successfully`);
			} catch (error) {
				console.error('[Mock Verifier] Error:', error);
				this.lastError = error;

				this.resultStatusClass = 'flash-error';

				if (error.name === 'AbortError') {
					this.resultStatusText = `${test.name} - User cancelled the request`;
					this.addLog('User cancelled the request');
				} else {
					this.resultStatusText = `${test.name} - Error: ${error.message}`;
					this.addLog(`Error: ${error.message}`);
				}

				this.resultData = `Error: ${error.name}\nMessage: ${error.message}`;
				this.decodedTokens = [];
			}
		},

		// Run a custom DCQL request (for testing edge cases)
		async runCustomTest(request) {
			// Clear previous response/error
			this.lastResponse = null;
			this.lastError = null;

			// Display request
			this.lastRequest = JSON.stringify(request, null, 2);
			this.addLog('Starting custom test');

			// Show pending status
			this.resultVisible = true;
			this.resultStatusClass = 'flash-warn';
			this.resultStatusText = 'Custom Request - Waiting for wallet selection...';
			this.resultData = '';
			this.decodedTokens = [];

			try {
				this.addLog('Calling navigator.credentials.get()...');
				console.log('[Mock Verifier] Starting custom test');
				console.log('[Mock Verifier] Request:', request);

				const credential = await navigator.credentials.get(request);

				console.log('[Mock Verifier] Response:', credential);
				this.lastResponse = credential;

				this.resultStatusClass = 'flash-success';
				this.resultStatusText = 'Custom Request - Credential received successfully!';
				this.resultData = JSON.stringify(credential, null, 2);
				this.decodeCredentials(credential);
				this.addLog('Credential received successfully');
			} catch (error) {
				console.error('[Mock Verifier] Error:', error);
				this.lastError = error;

				this.resultStatusClass = 'flash-error';

				if (error.name === 'AbortError') {
					this.resultStatusText = 'Custom Request - User cancelled the request';
					this.addLog('User cancelled the request');
				} else {
					this.resultStatusText = `Custom Request - Error: ${error.message}`;
					this.addLog(`Error: ${error.message}`);
				}

				this.resultData = `Error: ${error.name}\nMessage: ${error.message}`;
				this.decodedTokens = [];
			}
		},

		decodeCredentials(credential) {
			this.decodedTokens = [];

			// Get vp_token from credential response
			const vpToken = credential?.data?.vp_token;
			if (!vpToken || typeof vpToken !== 'object') {
				return;
			}

			for (const [id, tokenArray] of Object.entries(vpToken)) {
				const token = Array.isArray(tokenArray) ? tokenArray[0] : tokenArray;
				try {
					if (typeof token === 'string' && token.includes('.')) {
						// SD-JWT format: header.payload.signature~disclosures
						const parts = token.split('~')[0].split('.');
						if (parts.length >= 2) {
							const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
							const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

							this.decodedTokens.push({
								id,
								format: 'SD-JWT',
								decoded: JSON.stringify({ header, payload }, null, 2),
							});
						}
					} else if (typeof token === 'string') {
						// Base64-encoded mdoc (no dots = not JWT)
						const decoded = JSON.parse(atob(token));
						this.decodedTokens.push({
							id,
							format: 'mso_mdoc (base64)',
							decoded: JSON.stringify(decoded, null, 2),
						});
					}
				} catch (e) {
					this.decodedTokens.push({
						id,
						format: 'unknown',
						decoded: `Failed to decode: ${e.message}\nRaw: ${typeof token === 'string' ? token.substring(0, 200) + '...' : JSON.stringify(token)}`,
					});
				}
			}
		},
	};
}
