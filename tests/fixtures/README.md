# Test Fixtures

Test fixtures for integration testing the Wallet Companion extension with the Digital Credentials API.

## Mock Wallet (`mock-wallet.html`)

A programmable mock wallet for testing the extension's wallet registration and credential request handling.

### Features

- **Wallet registration** — Registers with extension via `WalletCompanion.registerWallet()`
- **Credential requests** — Handles incoming OpenID4VP requests with DCQL queries
- **Mock credentials** — Generates SD-JWT and mso_mdoc format credentials
- **Playwright-friendly** — Exposes `window.mockWallet` API for test automation
- **Activity logging** — Tracks all operations for test assertions

### API Reference (`window.mockWallet`)

#### State Access

```javascript
// Reactive state getter
mockWallet.state  // { extensionReady, registered, walletId, currentRequest, requestError, canRespond }

// Snapshot function
mockWallet.getState()  // Same as above, but a plain object copy
```

#### Action Triggers

```javascript
mockWallet.register()              // Register wallet with extension
mockWallet.checkRegistration()     // Check if wallet is registered
mockWallet.sendResponse(approved)  // Send credential response (true=approve, false=deny)
```

#### Activity Log

```javascript
mockWallet.getLog()    // Get activity log array: [{ id, time, message }, ...]
mockWallet.clearLog()  // Clear the activity log
```

#### Test Isolation

```javascript
mockWallet.reset()  // Reset all state (registration, request, log, mock data)
```

#### Mock Data Overrides

```javascript
// Override user claims returned in credentials
mockWallet.setMockUserData({ given_name: 'Jane', family_name: 'Smith' })
mockWallet.getMockUserData()  // Get current mock user data

// Override accepted credential types
mockWallet.setAcceptedTypes(['urn:custom:credential'])
mockWallet.getAcceptedTypes()  // Get current accepted types
```

#### Async Wait Helpers

```javascript
await mockWallet.waitForExtension(timeout)     // Wait for extension detection (default: 5000ms)
await mockWallet.waitForRegistration(timeout)  // Wait for wallet registration (default: 5000ms)
await mockWallet.waitForRequest(timeout)       // Wait for credential request (default: 10000ms)
```

#### Configuration

```javascript
mockWallet.config  // { name, url, protocols, description, icon, color }
```

### Query Parameters

- `?auto-register=true` — Automatically register wallet on page load

### `data-testid` Selectors

| Selector | Element |
|----------|---------|
| `extension-status` | Extension status flash message |
| `register-button` | Register wallet button |
| `check-registration-button` | Check registration button |
| `request-dialog` | Credential request dialog |
| `approve-button` | Approve/send credential button |
| `deny-button` | Deny/cancel request button |

---

## Mock Verifier (`mock-verifier.html`)

A test page for triggering Digital Credentials API requests via `navigator.credentials.get()`.

### Features

- **Preset test scenarios** — Basic identity, age verification, full profile, multi-credential
- **Custom requests** — Run arbitrary DCQL queries
- **Response decoding** — Automatically decodes SD-JWT and mso_mdoc responses
- **Playwright-friendly** — Exposes `window.mockVerifier` API for test automation
- **Activity logging** — Tracks all operations for test assertions

### API Reference (`window.mockVerifier`)

#### State Access

```javascript
// Reactive state getter
mockVerifier.state  // { extensionReady, resultVisible, lastRequest, lastResponse, lastError }

// Snapshot function
mockVerifier.getState()  // Same as above, but a plain object copy
```

#### Action Triggers

```javascript
mockVerifier.runTest('basic')       // Run preset test: 'basic', 'age', 'profile', 'multi'
mockVerifier.runCustomTest(request) // Run custom navigator.credentials.get() request
```

#### Response Access

```javascript
mockVerifier.getLastResponse()   // Get raw credential response
mockVerifier.getDecodedTokens()  // Get decoded VP tokens: [{ id, format, decoded }, ...]
```

#### Test Configs

```javascript
mockVerifier.getTestConfigs()  // Get all preset test configurations
mockVerifier.generateNonce()   // Generate cryptographically random nonce
```

#### Activity Log

```javascript
mockVerifier.getLog()    // Get activity log array: [{ id, time, message }, ...]
mockVerifier.clearLog()  // Clear the activity log
```

#### Test Isolation

```javascript
mockVerifier.reset()  // Reset all state (results, response, error, log)
```

#### Async Wait Helpers

```javascript
await mockVerifier.waitForExtension(timeout)  // Wait for DC API support (default: 5000ms)
await mockVerifier.waitForResponse(timeout)   // Wait for credential response (default: 30000ms)
```

### Preset Test Scenarios

| Test ID | Description | Claims Requested |
|---------|-------------|------------------|
| `basic` | Basic identity | `given_name`, `family_name` |
| `age` | Age verification | `age_over_18` (with value matching) |
| `profile` | Full profile | name, email, address fields |
| `multi` | Multiple credentials | SD-JWT + mso_mdoc with credential_sets |

### `data-testid` Selectors

| Selector | Element |
|----------|---------|
| `extension-status` | Extension status flash message |
| `test-basic` | Basic identity test button |
| `test-age` | Age verification test button |
| `test-profile` | Full profile test button |
| `test-multi` | Multi-credential test button |
| `result-status` | Result status flash message |
| `result-data` | Result data pre element |

---

## Playwright Usage Examples

### Setup and Register Wallet

```javascript
// Navigate and wait for extension
await walletPage.goto('/fixtures/mock-wallet.html');
await walletPage.evaluate(() => window.mockWallet.waitForExtension());

// Register via API (fast)
await walletPage.evaluate(() => window.mockWallet.register());
await walletPage.evaluate(() => window.mockWallet.waitForRegistration());

// OR register via UI (tests real flow)
await walletPage.click('[data-testid="register-button"]');
```

### Request and Approve Credential

```javascript
// On verifier page: trigger request
await verifierPage.evaluate(() => window.mockVerifier.runTest('basic'));

// On wallet page: wait for and approve request
await walletPage.evaluate(() => window.mockWallet.waitForRequest());
await walletPage.click('[data-testid="approve-button"]');

// On verifier page: verify response
const response = await verifierPage.evaluate(() => window.mockVerifier.waitForResponse());
expect(response.data.vp_token).toBeDefined();
```

### Test Isolation

```javascript
beforeEach(async () => {
  await walletPage.evaluate(() => window.mockWallet.reset());
  await verifierPage.evaluate(() => window.mockVerifier.reset());
});
```

### Assert Activity Log

```javascript
const log = await walletPage.evaluate(() => window.mockWallet.getLog());
expect(log.some(e => e.message.includes('registered'))).toBe(true);
```

### Custom Mock Data

```javascript
await walletPage.evaluate(() => {
  window.mockWallet.setMockUserData({
    given_name: 'Alice',
    age_over_18: false  // Test rejection scenario
  });
});
```

---

## Files

| File | Purpose |
|------|---------|
| `mock-wallet.html` | Wallet test page |
| `mock-wallet.js` | Wallet Alpine.js component |
| `mock-verifier.html` | Verifier test page |
| `mock-verifier.js` | Verifier Alpine.js component |
| `style.css` | Shared Primer CSS styles |
