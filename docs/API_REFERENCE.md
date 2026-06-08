# API Reference

Complete API reference for the Wallet Companion extension.

## Table of Contents

- [Digital Credentials API (Verifier Side)](#digital-credentials-api-verifier-side)
- [Wallet Registration API](#wallet-registration-api)
- [OpenID4VP Protocol Details](#openid4vp-protocol-details)

## Digital Credentials API (Verifier Side)

The extension polyfills the W3C Digital Credentials API for cross-browser support. Websites request credentials using the standard browser API.

### Basic Request

```javascript
const credential = await navigator.credentials.get({
  digital: {
    requests: [{
      protocol: "openid4vp",
      data: {
        // OpenID4VP authorization request
        client_id: "https://verifier.example.com",
        client_id_scheme: "https",
        response_type: "vp_token",
        response_mode: "direct_post",
        response_uri: "https://verifier.example.com/callback",
        nonce: "n-0S6_WzA2Mj",
        dcql_query: {
          credentials: [{
            id: "org.example.identity",
            format: "vc+sd-jwt",
            claims: [
              { path: ["given_name"] },
              { path: ["family_name"] }
            ]
          }]
        }
      }
    }]
  }
});
```

## Wallet Registration API

The `window.WalletCompanion` API allows wallets to auto-register with the extension.

### API Object

```javascript
window.WalletCompanion = {
  isInstalled: true,
  version: '1.0.0',
  supportedProtocols: ['openid4vp', ...],
  registerWallet: async function(walletInfo) { /* ... */ },
  isWalletRegistered: async function(url) { /* ... */ }
};
```

### Methods

#### `isInstalled`

Boolean property indicating if the extension is installed.

**Type:** `boolean`

**Example:**

```javascript
if (window.WalletCompanion?.isInstalled) {
  console.log('Extension is installed');
}
```

#### `registerWallet(walletInfo)`

Register a wallet with the extension.

**Parameters:**

- `walletInfo` (Object) - Wallet information
  - `name` (string, required) - Display name of the wallet
  - `url` (string, required) - Wallet endpoint URL
  - `protocols` (string[], required) - Supported protocol identifiers (e.g., `['openid4vp', 'w3c-vc']`)
  - `description` (string, optional) - Description of the wallet
  - `icon` (string, optional) - Icon emoji or URL
  - `logo` (string, optional) - Logo URL (alternative to icon)
  - `color` (string, optional) - Brand color in hex format (default: `'#1C4587'`)

**Returns:** `Promise<Object>`

```typescript
{
  success: boolean;
  alreadyRegistered: boolean;
  wallet: Object;
}
```

**Example:**

```javascript
const result = await window.WalletCompanion.registerWallet({
  name: 'MyWallet',
  url: 'https://wallet.example.com',
  protocols: ['openid4vp', 'w3c-vc'],
  description: 'My digital identity wallet',
  icon: '🔐',
  color: '#3b82f6'
});

if (result.success) {
  console.log('Registered:', result.wallet);
}
```

**Validation:**

- URL must be valid
- Protocols array must not be empty
- Protocol identifiers must match `/^[a-z0-9-]+$/` (lowercase letters, digits, hyphens)

#### `isWalletRegistered(url)`

Check if a wallet is already registered.

**Parameters:**

- `url` (string) - Wallet URL to check

**Returns:** `Promise<boolean>`

**Example:**

```javascript
const isRegistered = await window.WalletCompanion.isWalletRegistered('https://wallet.example.com');
if (!isRegistered) {
  await window.WalletCompanion.registerWallet({...});
}
```

## OpenID4VP Protocol Details

### Supported Client ID Schemes

- `x509_san_dns` - X.509 certificate with DNS SAN (preferred for production)
- `https` - HTTPS URL (must match request origin)
- `redirect_uri` - OAuth 2.0 redirect URI (legacy support)

### Supported Response Modes

- `direct_post` - HTTP POST to response_uri
- `direct_post.jwt` - Encrypted JWT POST to response_uri
- `fragment` - URL fragment (limited support)

### Request Formats

#### 1. JAR (JWT-secured Authorization Request)

Request by reference using `request_uri`:

```javascript
{
  protocol: "openid4vp",
  data: {
    client_id: "https://verifier.example.com",
    request_uri: "https://verifier.example.com/request/abc123"
  }
}
```

The extension will:
1. Fetch the JWT from `request_uri`
2. Extract and validate the authorization request from the JWT payload

#### 2. DCQL (Digital Credentials Query Language)

Credential requests using DCQL format:

```javascript
{
  protocol: "openid4vp",
  data: {
    client_id: "https://verifier.example.com",
    response_type: "vp_token",
    dcql_query: {
      credentials: [{
        id: "org.example.driver_license",
        format: "vc+sd-jwt",
        claims: [
          { path: ["document_number"] },
          { path: ["driving_privileges"] }
        ]
      }]
    }
  }
}
```

### Response Validation

The extension validates responses according to OpenID4VP:

**vp_token:** Must be a valid JWT or JSON object containing verifiable presentation

## See Also

- [Quick Start Guide](QUICKSTART.md) - Get started quickly
- [Development Guide](DEVELOPMENT.md) - Build and test the extension
- [OpenID4VP Implementation](design/OPENID4VP_IMPLEMENTATION.md) - Complete protocol documentation
- [Wallet Management](design/WALLET_MANAGEMENT.md) - User guide for managing wallets
