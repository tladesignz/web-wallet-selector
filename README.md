# Wallet Companion

A cross-browser companion extension that intercepts W3C Digital Credentials API calls, enabling users to select from multiple digital identity wallet providers.

[![License](https://img.shields.io/badge/License-BSD%202--Clause-blue.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-332%2F332-brightgreen.svg)](DEVELOPMENT.md#testing)
[![OpenID4VP](https://img.shields.io/badge/OpenID4VP-Full%20Implementation-green.svg)](docs/design/OPENID4VP_IMPLEMENTATION.md)

## 🎯 What It Does

When a website requests credentials using the W3C Digital Credentials API, this extension:

1. **Intercepts the request** - Captures `navigator.credentials.get()` calls
2. **Filters by protocol** - Shows only compatible wallets (OpenID4VP, mDoc, W3C VC)
3. **Presents wallet choices** - User selects their preferred wallet
4. **Routes the request** - Sends the credential request to the chosen wallet
5. **Returns the credential** - Wallet response goes back to the website

## ✨ Key Features

- **OpenID4VP Support** - Full implementation with JAR and DCQL
- **JWT Verification Callbacks** - Wallets provide their own signature verification
- **Auto-Registration API** - Wallets can register themselves via JavaScript API
- **Protocol-Aware** - Filters wallets by supported protocols
- **Cross-Browser** - Works on Chrome, Firefox, and Safari
- **User-Friendly** - Beautiful modal UI with wallet management

## 🚀 Quick Start

### For Users

1. **Install the extension** (from your browser's extension store)
2. **Configure wallets** - Click the extension icon → "Configure Wallets"
3. **Add wallets** - Use pre-configured wwWallet presets or add custom wallets
4. **Done!** - Visit any website that requests credentials and select your wallet

### For Verifiers (Requesting Credentials)

Use the standard W3C Digital Credentials API:

```javascript
const credential = await navigator.credentials.get({
  digital: {
    providers: [{
      protocol: "openid4vp",
      request: {
        client_id: "https://verifier.example.com",
        response_type: "vp_token",
        dcql_query: {
          credentials: [{
            id: "org.example.identity",
            format: "vc+sd-jwt",
            claims: [{ path: ["given_name"] }]
          }]
        }
      }
    }]
  }
});
```

**[→ See Quick Start Guide](QUICKSTART.md)**

### For Wallets (Self-Registration)

Register your wallet with the extension:

```javascript
if (window.WalletCompanion?.isInstalled) {
  await window.WalletCompanion.registerWallet({
    name: 'MyWallet',
    url: 'https://wallet.example.com',
    protocols: ['openid4vp'],
    icon: '🔐',
    color: '#3b82f6'
  });
}
```

**[→ See API Reference](API_REFERENCE.md)**

## 📋 Implementation Status

### ✅ Completed

- W3C Digital Credentials API interception
- OpenID4VP protocol (JAR, DCQL)
- JWT verification callback system
- Wallet auto-registration API
- Protocol-aware wallet filtering
- Cross-browser support (Chrome, Firefox, Safari)
- 332 passing tests

### 🚧 Planned

- mDoc OpenID4VP protocol plugin
- W3C Verifiable Credentials plugin
- Response encryption callbacks
- Additional protocol support

## 📚 Documentation

### Getting Started

- **[Quick Start Guide](QUICKSTART.md)** - Get up and running in minutes
- **[Wallet Management](WALLET_MANAGEMENT.md)** - Configure and manage wallets

### Developer Documentation

- **[API Reference](API_REFERENCE.md)** - Complete API documentation
- **[Development Guide](DEVELOPMENT.md)** - Build, test, and develop the extension
- **[Wallet API Guide](WALLET_API.md)** - Auto-registration API for wallet developers

### Protocol Documentation

- **[OpenID4VP Implementation](docs/design/OPENID4VP_IMPLEMENTATION.md)** - Complete OpenID4VP guide
- **[OpenID4VP Summary](docs/design/OPENID4VP_SUMMARY.md)** - Executive summary
- **[JWT Verification Callbacks](docs/design/JWT_VERIFICATION_CALLBACKS.md)** - JWT callback system
- **[Protocol Support Architecture](docs/design/PROTOCOL_SUPPORT.md)** - Protocol plugin system

### Additional Resources

- **[Branding Guide](docs/BRANDING.md)** - Logo, colors, and UI guidelines
- **[Auto-Registration](docs/design/AUTO_REGISTRATION_SUMMARY.md)** - Wallet registration system

## 🛠️ Development

### Prerequisites

- Node.js (v14+)
- npm or yarn
- Chrome, Firefox, or Safari

### Setup

```bash
# Clone and install
cd /home/leifj/work/siros.org/browser-extensions
npm install

# Build for all browsers
npm run build

# Or build for specific browser
npm run build:chrome
npm run build:firefox
npm run build:safari

# Development with auto-rebuild
npm run watch:chrome
```

### Load in Browser

**Chrome:**
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" → Select `chrome/` directory

**Firefox:**
1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on" → Select `firefox/manifest.json`

**Safari:**
1. Convert: `xcrun safari-web-extension-converter safari/`
2. Open Xcode project and run

**[→ Complete Development Guide](DEVELOPMENT.md)**

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- tests/openid4vp.test.js
npm test -- tests/jwt-verification.test.js

# Open interactive test pages
open test-page.html
open test-wallet-api.html
```

**Test Coverage:** 332 tests passing

**[→ Testing Documentation](DEVELOPMENT.md#testing)**

## 📦 Packaging

```bash
# Package for Chrome Web Store
npm run package:chrome

# Package for Firefox Add-ons
npm run package:firefox

# Or use Makefile
make package
```

**[→ Packaging Guide](DEVELOPMENT.md#packaging-for-distribution)**

## 🏗️ Architecture

```
┌─────────────┐
│   Website   │ Calls navigator.credentials.get()
└──────┬──────┘
       │
       v
┌─────────────────────────────────────┐
│  Extension (inject.js)              │
│  - Intercepts DC API calls          │
│  - Exposes window.WalletCompanion   │
└──────┬──────────────────────────────┘
       │
       v
┌─────────────────────────────────────┐
│  Protocol Plugin (OpenID4VPPlugin)  │
│  - Parses/validates requests        │
│  - Handles JAR, DCQL, Pres. Ex.     │
└──────┬──────────────────────────────┘
       │
       v
┌─────────────────────────────────────┐
│  Wallet Selection Modal             │
│  - Filters by protocol              │
│  - User selects wallet              │
└──────┬──────────────────────────────┘
       │
       v
┌─────────────┐
│   Wallet    │ Processes request, returns credential
└─────────────┘
```

**[→ Protocol Architecture](docs/design/PROTOCOL_SUPPORT.md)**

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Write tests for new features
4. Run `npm test` to verify
5. Submit a pull request

**[→ Development Guide](DEVELOPMENT.md#contributing)**

## 📄 License

BSD 2-Clause License - see [LICENSE](LICENSE) file for details.

Copyright (c) 2025, SIROS Foundation

## 🔗 Resources

- [W3C Digital Credentials API](https://w3c.github.io/digital-credentials/)
- [OpenID4VP Specification](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html)
- [Chrome Extensions](https://developer.chrome.com/docs/extensions/)
- [Firefox Extensions](https://extensionworkshop.com/)
- [Safari Web Extensions](https://developer.apple.com/documentation/safariservices/safari_web_extensions)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/sirosfoundation/web-wallet-selector/issues)
- **Discussions**: [GitHub Discussions](https://github.com/sirosfoundation/web-wallet-selector/discussions)
- **Documentation**: See links above

---

**Made with ❤️ by the SIROS Foundation**
