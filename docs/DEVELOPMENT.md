# Development Guide

This guide covers setup, build, testing, and packaging for Wallet Companion using Make targets.

## Prerequisites

- Node.js 22 or newer
- pnpm 10.4.0
- Browser requirements:
  - Chrome for Chrome extension testing
  - Firefox for Firefox extension testing
  - Safari on macOS with Xcode for Safari extension testing

## Setup

```bash
# Install dependencies
make install

# Build all browsers
make build
```

## Build Targets

```bash
make build
make build-chrome
make build-firefox
make build-safari
```

## Watch Targets

```bash
make watch
make watch-chrome
make watch-firefox
make watch-safari
```

## Load In Browser

### Chrome

1. Open chrome://extensions/
2. Enable Developer mode
3. Click Load unpacked
4. Select dist/chrome

### Firefox

1. Open about:debugging#/runtime/this-firefox
2. Click Load Temporary Add-on
3. Select dist/firefox/manifest.json

Optional runner:

```bash
make dev-firefox
```

### Safari

- Enable Safari -> Settings -> Advanced -> Show features for web developers
- Enable Safari -> Settings -> Developer -> Extensions -> Allow unsigned extensions
- `open Wallet\ Companion/Wallet\ Companion.xcodeproj`
- Run "Wallet Companion (macOS)" scheme on "My Mac"
- In the app, press "Quit and Open Safari Settings…"
- Activate the "Wallet Companion" extension.

If you **really, really have to rebuild the Xcode project** (Don't!): 

```bash
make dev-safari
```

## Testing

```bash
make test
make test-unit
make test-integration
make test-e2e
make test-e2e-headed
make test-watch
make test-coverage
make test-server
make test-all
```

Fixture pages are served at:

- http://127.0.0.1:3456/
- http://127.0.0.1:3456/mock-wallet.html
- http://127.0.0.1:3456/mock-verifier.html

## Packaging

```bash
make package
make package-chrome
make package-firefox
```

Output artifacts:

- dist/chrome-extension.zip
- dist/firefox-extension.xpi

## Utility Targets

```bash
make help
make status
make check-deps
make typecheck
make lint
make lint-fix
make format
make clean
make rebuild
```

## Project Pointers

- Runtime protocols: src/shared/protocols.ts
- Extension manifests: manifests/index.ts
- Background runtime: src/background/
- Content and injected scripts: src/content/
- UI pages: src/ui/
- Tests: tests/

## Contributing

1. Create a feature branch
2. Add or update tests for changed behavior
3. Run `make test-all`
4. Open a pull request with a clear change summary
