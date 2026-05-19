# Integration Testing Proposal: Mock Wallet

## Overview

Comprehensive integration testing strategy for wallet auto-registration and JWT verification callbacks using mock wallets in a headless browser environment.

## Architecture

```
┌─────────────────────────────────────────┐
│  Integration Test (Puppeteer/Jest)      │
│  - Launches browser with extension      │
│  - Creates mock wallet page             │
│  - Executes test scenarios              │
└────────────┬────────────────────────────┘
             │
             v
┌───────────────────────────────────────────┐
│  Mock Wallet HTML Page                    │
│  - Simulates wallet behavior              │
│  - Calls WalletCompanion registration API │
│  - Provides JWT verification callback     │
│  - Exposes test interface                 │
└────────────┬──────────────────────────────┘
             │
             v
┌─────────────────────────────────────────┐
│  Extension (inject.js)                  │
│  - Receives registration request        │
│  - Stores wallet info                   │
│  - Registers JWT verifier               │
└─────────────────────────────────────────┘
```

## Test Scenarios

### 1. Wallet Registration
- ✅ Basic wallet registration
- ✅ Registration with all optional fields
- ✅ Registration with multiple protocols
- ✅ Duplicate registration detection
- ✅ Invalid URL rejection
- ✅ Invalid protocol identifier rejection
- ✅ Missing required fields handling

### 2. JWT Verification Callbacks
- ✅ Register JWT verifier
- ✅ Unregister JWT verifier
- ✅ List registered verifiers
- ✅ Callback execution during OpenID4VP JAR fetch
- ✅ Invalid callback rejection
- ✅ Multiple wallets with different verifiers

### 3. OpenID4VP Integration
- ✅ Mock wallet handles OpenID4VP request
- ✅ JAR request with mock JWT verification
- ✅ Presentation Exchange credential selection
- ✅ Response submission validation

### 4. Protocol Filtering
- ✅ Wallet appears only for supported protocols
- ✅ Multiple wallets with different protocol support
- ✅ No wallet matches protocol

## Implementation

### Test File Structure

```
tests/
├── integration.test.js            # Existing tests
├── wallet-integration.test.js     # NEW: Mock wallet tests
└── fixtures/
    ├── mock-wallet.html           # NEW: Mock wallet page
    ├── mock-verifier.html         # NEW: Mock verifier page  
    └── test-credentials.json      # NEW: Test credential data
```

### Mock Wallet Page (`tests/fixtures/mock-wallet.html`)

A simple HTML page that:
1. Detects extension presence
2. Registers itself as a wallet
3. Registers JWT verification callback
4. Exposes test interface for automation
5. Can simulate credential presentation flows

**Key Features:**
- **Programmable**: Test can inject behavior via `page.evaluate()`
- **Observable**: Exposes state for test assertions
- **Realistic**: Mimics real wallet registration patterns
- **Flexible**: Can simulate success/error scenarios

### Test Suite (`tests/wallet-integration.test.js`)

Jest/Puppeteer tests that:
1. Launch browser with extension
2. Load mock wallet page
3. Execute registration scenarios
4. Verify extension state
5. Test end-to-end flows

## Detailed Implementation Plan

### Phase 1: Basic Mock Wallet (Immediate)

**File: `tests/fixtures/mock-wallet.html`**
- Minimal HTML page
- Auto-registers on load
- Exposes `window.mockWallet` test interface
- Simple success/error states

**File: `tests/wallet-integration.test.js`**
- Load mock wallet in Puppeteer
- Verify registration succeeds
- Check wallet appears in extension storage
- Verify WalletCompanion API methods work

### Phase 2: JWT Verification Testing

**Extend mock wallet:**
- Add JWT verification callback
- Mock crypto operations
- Simulate valid/invalid signatures
- Test certificate extraction

**Extend tests:**
- Register JWT verifier
- Trigger JAR request
- Verify callback is called
- Test error handling

### Phase 3: OpenID4VP End-to-End

**Extend mock wallet:**
- Handle OpenID4VP authorization requests
- Simulate credential selection
- Generate mock vp_token
- Return presentation_submission

**Extend tests:**
- Create mock verifier page
- Trigger DC API call
- Verify wallet selection modal
- Complete full OpenID4VP flow

### Phase 4: Advanced Scenarios

- Multiple mock wallets with different protocols
- Concurrent registration attempts
- Network failure simulation
- Extension reload/persistence testing
- Performance testing with many wallets

## Code Examples

### Mock Wallet Interface

```javascript
// Exposed on window.mockWallet for test automation
window.mockWallet = {
  // State
  registered: false,
  walletInfo: null,
  verifierRegistered: false,
  
  // Actions (callable from tests)
  async register(customInfo) { /* ... */ },
  async registerVerifier(callback) { /* ... */ },
  async unregisterVerifier() { /* ... */ },
  
  // Simulation
  async simulateOpenID4VPRequest(request) { /* ... */ },
  async simulateError(errorType) { /* ... */ },
  
  // Queries (for assertions)
  getState() { /* ... */ },
  getCallHistory() { /* ... */ }
};
```

### Test Example

```javascript
test('should register wallet and JWT verifier', async () => {
  const page = await browser.newPage();
  const mockWalletPath = path.join(__dirname, 'fixtures', 'mock-wallet.html');
  await page.goto(`file://${mockWalletPath}`);
  
  // Wait for registration
  await page.waitForFunction(
    () => window.mockWallet?.registered === true,
    { timeout: 5000 }
  );
  
  // Verify wallet info
  const walletInfo = await page.evaluate(() => 
    window.mockWallet.getState().walletInfo
  );
  
  expect(walletInfo.name).toBe('Mock Wallet');
  expect(walletInfo.protocols).toContain('openid4vp');
  
  // Register JWT verifier
  await page.evaluate(() => {
    return window.mockWallet.registerVerifier(async (jwt, options) => {
      return { valid: true, payload: { test: true } };
    });
  });
  
  // Verify verifier is registered
  const verifierRegistered = await page.evaluate(() =>
    window.mockWallet.getState().verifierRegistered
  );
  
  expect(verifierRegistered).toBe(true);
});
```

## Benefits

1. **No External Dependencies**: Tests run in isolation
2. **Fast Execution**: No real network calls or crypto operations
3. **Deterministic**: Controlled test scenarios
4. **Comprehensive Coverage**: Can test error paths easily
5. **CI/CD Friendly**: Runs in headless mode
6. **Documentation**: Mock wallet serves as integration example

## Limitations & Future Work

**Current Limitations:**
- Not testing real wallet implementations
- Mocked crypto doesn't catch algorithm issues
- No network layer testing

**Future Enhancements:**
- Real wallet integration tests (with test instances)
- Network interception for offline testing
- Performance benchmarks
- Cross-browser testing (Firefox, Safari)

## Testing Tools Stack

- **Jest**: Test framework and assertions
- **Puppeteer**: Browser automation
- **Chrome Extension**: Loaded in test browser
- **Mock HTML Pages**: Simulate wallet/verifier behavior

## Success Metrics

- ✅ 100% coverage of WalletCompanion API methods
- ✅ All registration scenarios tested
- ✅ All JWT callback scenarios tested
- ✅ End-to-end OpenID4VP flow tested
- ✅ Tests run in < 30 seconds
- ✅ Tests are deterministic (no flakiness)

## Next Steps

1. Create `tests/fixtures/mock-wallet.html`
2. Create `tests/wallet-integration.test.js`
3. Implement basic registration tests
4. Add JWT verification tests
5. Add OpenID4VP integration tests
6. Document mock wallet API
7. Add to CI/CD pipeline

## Example Test Scenarios

### Scenario 1: Basic Registration
```javascript
describe('Mock Wallet Registration', () => {
  test('registers successfully with minimal info', async () => {
    // Load mock wallet
    // Verify auto-registration
    // Check extension storage
  });
  
  test('registers with all optional fields', async () => {
    // Load mock wallet with full config
    // Verify all fields stored correctly
  });
});
```

### Scenario 2: JWT Verification
```javascript
describe('JWT Verification Callbacks', () => {
  test('registers and uses JWT verifier for JAR', async () => {
    // Register mock wallet with verifier
    // Create mock verifier page with JAR
    // Trigger DC API call
    // Verify callback was called
    // Verify JWT was validated
  });
});
```

### Scenario 3: Protocol Filtering
```javascript
describe('Protocol-Aware Wallet Selection', () => {
  test('shows only compatible wallets', async () => {
    // Register wallet A with openid4vp
    // Register wallet B with w3c-vc
    // Trigger openid4vp request
    // Verify only wallet A appears in modal
  });
});
```

## Conclusion

This approach provides comprehensive integration testing without requiring real wallet deployments. The mock wallet approach is:

- **Practical**: Easy to implement and maintain
- **Flexible**: Can simulate any scenario
- **Fast**: No external dependencies
- **Reliable**: Deterministic test results
- **Educational**: Serves as integration example

The implementation can be done incrementally, starting with basic registration tests and progressively adding more complex scenarios.
