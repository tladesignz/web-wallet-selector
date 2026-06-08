# Wallet Companion

A browser extension that enhances web wallets with standards-based credential flows, auto-registration, and protocol-aware routing.

![GitHub package.json version](https://img.shields.io/github/package-json/v/sirosfoundation/wallet-companion)
[![Test](https://github.com/sirosfoundation/wallet-companion/actions/workflows/test.yml/badge.svg)](https://github.com/sirosfoundation/wallet-companion/actions/workflows/test.yml)
[![Lint](https://github.com/sirosfoundation/wallet-companion/actions/workflows/lint.yml/badge.svg)](https://github.com/sirosfoundation/wallet-companion/actions/workflows/lint.yml)
[![Security](https://github.com/sirosfoundation/wallet-companion/actions/workflows/security.yml/badge.svg)](https://github.com/sirosfoundation/wallet-companion/actions/workflows/security.yml)
[![CodeQL](https://github.com/sirosfoundation/wallet-companion/actions/workflows/codeql.yml/badge.svg)](https://github.com/sirosfoundation/wallet-companion/actions/workflows/codeql.yml)
[![SBOM](https://github.com/sirosfoundation/wallet-companion/actions/workflows/sbom.yml/badge.svg)](https://github.com/sirosfoundation/wallet-companion/actions/workflows/sbom.yml)

## Why?

Wallet Companion helps web wallets align closely with standards such as the W3C Digital Credentials API while offering practical capabilities that are harder to deliver in browser-only environments. It also improves day-to-day wallet access with the DC API support and sets a clear path for additional transport flows and privacy-focused features as they become available.

## Features

- [Wallet auto-registration API](#wallet-auto-registration-api)
- [Digital Credentials API support](#digital-credentials-dc-api-support)
- [Protocol-aware wallet routing](#protocol-aware-wallet-routing)
- Cross-browser support (Chrome, Firefox, Safari)

### Wallet auto-registration API

Wallets can register themselves with Wallet Companion through `window.WalletCompanion`, so users do not need to manually enter wallet endpoints. Registered wallet metadata and supported protocols are then used for wallet selection and request routing.

Related docs:
- [docs/API_REFERENCE.md](docs/API_REFERENCE.md)
- [docs/design/WALLET_API.md](docs/design/WALLET_API.md)

### Digital Credentials (DC) API support

Wallet Companion integrates with `navigator.credentials.get()` and routes eligible requests through compatible wallets. This keeps verifier integration aligned with the standard API surface while giving users a wallet selection step when multiple wallets can satisfy the request.

We support:
- OpenID4VP request handling for DC API flows.
- OpenID4VP variants: `openid4vp`, `openid4vp-v1-unsigned`, `openid4vp-v1-signed`, `openid4vp-v1-multisigned`.

Related docs:
- [docs/QUICKSTART.md](docs/QUICKSTART.md)
- [docs/API_REFERENCE.md](docs/API_REFERENCE.md)

### Protocol-aware wallet routing

When a request arrives, Wallet Companion filters wallet options by supported protocol and request format before presenting choices to the user. This reduces failed handoffs and keeps routing behavior predictable as new capability modules are added.

Related docs:
- [docs/design/PROTOCOL_SUPPORT.md](docs/design/PROTOCOL_SUPPORT.md)

## Development Instructions

### Prerequisites

- Node.js 22 or newer
- pnpm 10.4.0 (invoked by Makefile targets)
- Chrome, Firefox, or Safari

### Setup

```bash
# Install dependencies
make install

# Build for all browsers
make build

# Build for a specific browser
make build-chrome
make build-firefox
make build-safari

# Watch mode
make watch-chrome
```

### Load In Browser

Chrome:
1. Go to `chrome://extensions/`
2. Enable Developer mode
3. Click Load unpacked and select `dist/chrome`

Firefox:
1. Go to `about:debugging#/runtime/this-firefox`
2. Click Load Temporary Add-on
3. Select `dist/firefox/manifest.json`

Safari:
1. Run `xcrun safari-web-extension-converter dist/safari/ --app-name "Wallet Companion"`
2. Open the generated Xcode project and run it

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the complete contributor workflow.

## Quick Start

### For Users

1. Install the extension in your browser.
2. Open the extension UI and configure wallets.
3. Visit a site that requests digital credentials.
4. Select the wallet you want to use.

### For Verifiers

Use the standard W3C Digital Credentials API:

```javascript
const credential = await navigator.credentials.get({
  digital: {
    requests: [{
      protocol: "openid4vp",
      data: {
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

See [docs/QUICKSTART.md](docs/QUICKSTART.md) for full verifier setup.

### For Wallets

Register your wallet with the extension:

```javascript
if (window.WalletCompanion?.isInstalled) {
  await window.WalletCompanion.registerWallet({
    name: "MyWallet",
    url: "https://wallet.example.com",
    protocols: ["openid4vp"],
    color: "#3b82f6"
  });
}
```

See [docs/API_REFERENCE.md](docs/API_REFERENCE.md) for API details.

## Testing

```bash
# Run unit test suite
make test

# Run integration tests
make test-integration

# Run e2e tests
make test-e2e

# Serve test fixtures locally
make test-server
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#testing) for full testing workflow.

## Packaging

```bash
# Package for Chrome Web Store
make package-chrome

# Package for Firefox Add-ons
make package-firefox

# Or package both with Makefile
make package
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#packaging) for release details.

## Architecture

```
┌─────────────┐
│   Website   │ Calls navigator.credentials.get()
└──────┬──────┘
       │
       v
┌─────────────────────────────────────┐
│  Extension (inject.js)              │
│  - Polyfills DC API                 │
│  - Exposes window.WalletCompanion   │
└──────┬──────────────────────────────┘
       │
       v
┌─────────────────────────────────────┐
│  Protocol Plugin (OpenID4VPPlugin)  │
│  - Parses/validates requests        │
│  - Handles JAR, DCQL                │
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

## Documentation

- [docs/QUICKSTART.md](docs/QUICKSTART.md) - verifier and wallet quickstart
- [docs/API_REFERENCE.md](docs/API_REFERENCE.md) - extension API details
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) - contributor setup and workflow
- [docs/design/OPENID4VP_IMPLEMENTATION.md](docs/design/OPENID4VP_IMPLEMENTATION.md) - OpenID4VP implementation details
- [docs/design/JWT_VERIFICATION_CALLBACKS.md](docs/design/JWT_VERIFICATION_CALLBACKS.md) - JWT callback design
- [docs/design/PROTOCOL_SUPPORT.md](docs/design/PROTOCOL_SUPPORT.md) - protocol plugin architecture
- [docs/design/WALLET_MANAGEMENT.md](docs/design/WALLET_MANAGEMENT.md) - wallet management model
- [docs/design/WALLET_API.md](docs/design/WALLET_API.md) - wallet API design

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Write tests for new features
4. Run `make test-all` to verify
5. Submit a pull request

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#contributing) for contribution workflow.

## Resources

- [W3C Digital Credentials API](https://w3c.github.io/digital-credentials/)
- [OpenID4VP Specification](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html)
- [Chrome Extensions](https://developer.chrome.com/docs/extensions/)
- [Firefox Extensions](https://extensionworkshop.com/)
- [Safari Web Extensions](https://developer.apple.com/documentation/safariservices/safari_web_extensions)

## Support

- Issues: [GitHub Issues](https://github.com/sirosfoundation/wallet-companion/issues)
- Discussions: [GitHub Discussions](https://github.com/sirosfoundation/wallet-companion/discussions)
- Documentation: see links above

## License

BSD 2-Clause License - see [LICENSE](LICENSE) file for details.

Copyright (c) 2025 - present, SIROS Foundation