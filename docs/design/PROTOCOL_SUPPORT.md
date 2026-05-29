# Protocol Support and Plugin Architecture

This document describes the protocol-aware business logic implemented in the Wallet Companion extension.

## Overview

The extension now includes sophisticated protocol filtering and plugin architecture to:

1. **Filter credential requests by supported protocols** - Only intercept requests for protocols supported by registered web wallets
2. **Pass unsupported protocols to native API** - Silently delegate unsupported protocols to the browser's native implementation
3. **Plugin-based request/response processing** - Extensible architecture for protocol-specific validation and formatting
4. **Override `userAgentAllowsProtocol()`** - Report protocols supported by registered web wallets

## Architecture

### Protocol Flow

```
1. Website calls navigator.credentials.get({ digital: { requests: [...] } })
   ↓
2. inject.js intercepts the call
   ↓
3. Extract protocols from digital.requests[]
   ↓
4. Filter: Check if any registered wallets support these protocols
   ↓
   ├─> No matching wallets: Pass to native DC API (silent fallback)
   ├─> Some matching: Process supported protocols, ignore unsupported
   └─> All matching: Process all requests
   ↓
5. Protocol plugins prepare and validate request data
   ↓
6. Show wallet selector with only matching wallets
   ↓
7. User selects wallet
   ↓
8. Protocol plugin validates response
   ↓
9. Return validated credential to website
```

### Components

#### 1. Protocol Registry (`protocols.js`)

**Base Class: `ProtocolPlugin`**
```javascript
class ProtocolPlugin {
  getProtocolId()        // Returns protocol identifier (e.g., 'openid4vp')
  prepareRequest(data)   // Validates and formats request data
  validateResponse(data) // Validates response from wallet
  formatForWallet(data, walletUrl) // Formats request for wallet transmission
}
```

**Built-in Plugins:**
- `OpenID4VPPlugin` - OpenID for Verifiable Presentations
- `MDocOpenID4VPPlugin` - Mobile Driver's License over OpenID4VP
- `W3CVCPlugin` - W3C Verifiable Credentials

**Registry Methods:**
```javascript
const registry = new ProtocolPluginRegistry();
registry.register(customPlugin)           // Add custom protocol
registry.isSupported(protocolId)          // Check if protocol supported
registry.prepareRequest(protocol, data)   // Process request
registry.validateResponse(protocol, data) // Validate response
```

#### 2. Protocol Filtering (`inject.js`)

**Updated Wallet Registration:**
```javascript
window.WalletCompanion.registerWallet({
  name: 'My Wallet',
  url: 'https://wallet.example.com',
  protocols: ['openid4vp', 'w3c-vc'],  // NEW: Required protocols array
  description: 'My digital wallet',
  icon: '🔐',
  color: '#1C4587'
});
```

**Protocol Validation:**
- Protocol identifiers must match regex: `/^[a-z0-9-]+$/`
- At least one protocol required
- Protocols stored in wallet configuration

**Request Filtering:**
```javascript
// Extract protocols from request
const digitalRequests = options.digital?.requests || [];

// Filter by supported protocols
const supportedRequests = digitalRequests.filter(req => 
  supportedProtocols.has(req.protocol)
);

// If no matches, use native API
if (supportedRequests.length === 0) {
  return originalCredentialsGet(options);
}
```

#### 3. `userAgentAllowsProtocol()` Override

**Implementation:**
```javascript
DigitalCredential.userAgentAllowsProtocol = function(protocol) {
  // Check if any registered web wallet supports this protocol
  if (supportedProtocols.has(protocol)) {
    return true;
  }
  
  // Fall back to native implementation if available
  if (originalUserAgentAllowsProtocol) {
    return originalUserAgentAllowsProtocol(protocol);
  }
  
  return false;
};
```

**Behavior:**
- Returns `true` if any enabled web wallet supports the protocol
- Falls back to native implementation for additional protocols
- Enables websites to feature-detect protocol support

#### 4. Background Script Updates (`background.js`)

**New Functions:**
```javascript
async function getSupportedProtocols()
  // Returns array of all protocols supported by enabled wallets

async function getWalletsForProtocol(protocol)
  // Returns wallets that support specific protocol
```

**Updated Message Handlers:**
- `SHOW_WALLET_SELECTOR`: Filters wallets by requested protocols
- `GET_SUPPORTED_PROTOCOLS`: Returns aggregated protocol list
- `REGISTER_WALLET`: Stores wallet.protocols array

#### 5. Content Script Updates (`content/index.ts`)

**Protocol Update Flow:**
```javascript
// RPC handler receives GET_SUPPORTED_PROTOCOLS
new RPC(async (type, payload) => {
  if (type === 'GET_SUPPORTED_PROTOCOLS') {
    return sendMessage({ 
      type: InboundMessages.GET_SUPPORTED_PROTOCOLS,
      origin: window.location.origin
    });
  }
});
```

**Enhanced Wallet Selection:**
- Passes processed requests with protocols to modal
- Filters wallet list based on protocol compatibility
- Returns protocol information with response

## Example Usage

### Website Integration

```javascript
// Check if protocol is supported
if (DigitalCredential.userAgentAllowsProtocol('openid4vp')) {
  // Request credential using OpenID4VP
  const credential = await navigator.credentials.get({
    digital: {
      requests: [{
        protocol: 'openid4vp',
        data: {
          dcql_query: {
            credentials: [{
              id: 'org.example.age_verification',
              format: 'vc+sd-jwt',
              claims: [
                { path: ['age'], filter: { type: 'number', minimum: 18 } }
              ]
            }]
          }
        }
      }]
    }
  });
  
  // credential.protocol === 'openid4vp'
  // credential.data contains validated VP token
}
```

### Wallet Registration

```javascript
// Wallet registers with extension
window.WalletCompanion.registerWallet({
  name: 'Example Wallet',
  url: 'https://wallet.example.com/present',
  protocols: ['openid4vp', 'mdoc-openid4vp'],
  description: 'Supports OpenID4VP and mDL',
  icon: '🔐',
  color: '#4285f4'
});
```

### Custom Protocol Plugin

```javascript
class CustomProtocolPlugin extends ProtocolPlugin {
  getProtocolId() {
    return 'my-custom-protocol';
  }
  
  prepareRequest(requestData) {
    // Validate and prepare request
    if (!requestData.customField) {
      throw new Error('customField required');
    }
    return {
      ...requestData,
      timestamp: new Date().toISOString()
    };
  }
  
  validateResponse(responseData) {
    // Validate response
    if (!responseData.signature) {
      throw new Error('signature required');
    }
    return responseData;
  }
}

// Register custom plugin
const registry = new ProtocolPluginRegistry();
registry.register(new CustomProtocolPlugin());
```

## Protocol Specifications

### OpenID4VP

**Request Structure:**
```javascript
{
  protocol: 'openid4vp',
  data: {
    dcql_query: {
      credentials: [...]
    }
    // OR
    request_uri: string
  }
}
```

**Response Structure:**
```javascript
{
  vp_token: string
}
```

### mDoc OpenID4VP

**Request Structure:**
```javascript
{
  protocol: 'mdoc-openid4vp',
  data: {
    doctype: 'org.iso.18013.5.1.mDL'
  }
}
```

**Response Structure:**
```javascript
{
  vp_token: string  // Base64-encoded mDoc data
}
```

### W3C VC

**Request Structure:**
```javascript
{
  protocol: 'w3c-vc',
  data: {
    type: ['VerifiableCredential', 'UniversityDegreeCredential']
    // OR
    credentialSubject: {...}
  }
}
```

**Response Structure:**
```javascript
{
  '@context': [
    'https://www.w3.org/2018/credentials/v1',
    ...
  ],
  type: ['VerifiableCredential', ...],
  credentialSubject: {...},
  proof: {...}
}
```

## Security Considerations

1. **Protocol Validation**: All protocol identifiers are validated against the pattern `/^[a-z0-9-]+$/` to prevent injection attacks

2. **Request Inspection**: Credential requests remain unencrypted to enable browser-side validation and user transparency

3. **Response Encryption**: While responses are encrypted between wallet and verifier, the extension validates structure before forwarding

4. **Plugin Isolation**: Protocol plugins run in isolated contexts and cannot access wallet credentials directly

5. **Silent Fallback**: Unsupported protocols silently fall back to native API, preventing information leakage about installed wallets

## Testing

**Run protocol tests:**
```bash
pnpm test:unit  # Includes 35 protocol plugin tests
```

**Test Coverage:**
- Base plugin interface and abstract methods
- Each built-in plugin (OpenID4VP, mDoc, W3C VC)
- Registry management and lookup
- Request preparation and validation
- Response validation
- Custom plugin registration
- Error handling

**All tests passing:** 105/105 ✓

## Future Enhancements

1. **Dynamic Plugin Loading**: Load protocol plugins from external sources
2. **Protocol Registry**: Maintain a public registry of well-known protocols
3. **Protocol Negotiation**: Automatically select best common protocol between wallet and verifier
4. **Protocol Versioning**: Support multiple versions of the same protocol
5. **Cross-Protocol Translation**: Convert between compatible protocol formats

## References

- [W3C Digital Credentials API Specification](https://www.w3.org/TR/digital-credentials/)
- [OpenID for Verifiable Presentations](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html)
- [ISO/IEC 18013-5:2021 (mDL)](https://www.iso.org/standard/69084.html)
- [W3C Verifiable Credentials Data Model](https://www.w3.org/TR/vc-data-model-2.0/)
