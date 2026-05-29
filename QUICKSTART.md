# Quick Start Guide

Get started with the Wallet Companion extension in minutes.

## For Verifiers (Websites Requesting Credentials)

Use the standard W3C Digital Credentials API with OpenID4VP protocol:

```javascript
const credential = await navigator.credentials.get({
  digital: {
    providers: [{
      protocol: "openid4vp",
      request: {
        client_id: "https://verifier.example.com",
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

### OpenID4VP Request Formats

**1. JAR - JWT-secured Authorization Request (By Reference)**

```javascript
const credential = await navigator.credentials.get({
  digital: {
    providers: [{
      protocol: "openid4vp",
      request: {
        client_id: "https://verifier.example.com",
        request_uri: "https://verifier.example.com/request/abc123"
      }
    }]
  }
});
```

**2. DCQL - Digital Credentials Query Language**

```javascript
const credential = await navigator.credentials.get({
  digital: {
    providers: [{
      protocol: "openid4vp",
      request: {
        client_id: "https://verifier.example.com",
        dcql_query: {
          credentials: [{
            id: "org.example.driver_license",
            claims: [
              { path: ["document_number"] },
              { path: ["driving_privileges"] }
            ]
          }]
        }
      }
    }]
  }
});
```

## For Wallets (Self-Registration)

Register your wallet with the extension:

```javascript
// Check if extension is installed
if (window.WalletCompanion?.isInstalled) {
  await window.WalletCompanion.registerWallet({
    name: 'MyWallet',
    url: 'https://wallet.example.com',
    protocols: ['openid4vp', 'w3c-vc'],  // Required: supported protocols
    description: 'My digital identity wallet',
    icon: '🔐',  // Emoji or URL to icon
    color: '#3b82f6'  // Brand color (hex)
  });
}
```

### Complete Wallet Integration Example

```javascript
// wallet-integration.js
(async function() {
  // Wait for extension to be ready
  if (!window.WalletCompanion?.isInstalled) {
    console.log('Extension not installed');
    return;
  }
  
  // Check if already registered
  const walletUrl = 'https://wallet.example.com';
  const isRegistered = await window.WalletCompanion.isWalletRegistered(walletUrl);
  
  if (!isRegistered) {
    // Register the wallet
    await window.WalletCompanion.registerWallet({
      name: 'Example Wallet',
      url: walletUrl,
      protocols: ['openid4vp', 'w3c-vc'],
      description: 'Secure digital identity wallet with biometric support',
      icon: 'https://wallet.example.com/icon.png',
      color: '#1a73e8'
    });
  }
  
  console.log('Wallet integration complete');
})();
```

## Testing Your Integration

### Test the Digital Credentials API

Open the included test page:

```bash
open test-page.html  # macOS
xdg-open test-page.html  # Linux
start test-page.html  # Windows
```

### Test Wallet Registration

Open the wallet API test page:

```bash
open test-wallet-api.html
```

## Next Steps

- **[Complete API Reference](API_REFERENCE.md)** - Full API documentation with all methods and options
- **[Development Guide](DEVELOPMENT.md)** - Building, testing, and developing the extension
- **[OpenID4VP Documentation](docs/design/OPENID4VP_IMPLEMENTATION.md)** - Comprehensive OpenID4VP protocol guide
- **[Wallet Management](WALLET_MANAGEMENT.md)** - User guide for managing wallets
