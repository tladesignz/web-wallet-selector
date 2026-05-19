# Development Guide

Complete guide for building, testing, and developing the Digital Credentials Wallet Selector extension.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Project Setup](#project-setup)
- [Development Workflow](#development-workflow)
- [Building](#building)
- [Testing](#testing)
- [Browser-Specific Development](#browser-specific-development)
- [Packaging for Distribution](#packaging-for-distribution)
- [Project Structure](#project-structure)
- [Debugging](#debugging)

## Prerequisites

- Node.js (v18 or higher)
- pnpm (v10 or higher)
- Browser-specific requirements:
  - **Chrome**: Chrome browser with Developer mode enabled
  - **Firefox**: Firefox browser
  - **Safari**: macOS with Xcode (for Safari Web Extension conversion)

## Project Setup

1. Clone the repository and enter the project directory.

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Build for your target browser:

   ```bash
   # Build for all browsers
   pnpm build

   # Or build for specific browser
   pnpm build:chrome
   pnpm build:firefox
   pnpm build:safari
   ```

## Development Workflow

### Watch Mode (Recommended)

Use watch mode for automatic rebuilds during development:

```bash
# Watch Chrome (default)
pnpm watch

# Watch specific browser
pnpm watch:chrome
pnpm watch:firefox
pnpm watch:safari
```

Watch mode will automatically rebuild when you save changes to source files.

### Manual Builds

```bash
# Build all
pnpm build

# Build specific browser
pnpm build:chrome
pnpm build:firefox
pnpm build:safari
```

## Building

### Using pnpm Scripts

```bash
# Build all extensions
pnpm build

# Build specific browser
pnpm build:chrome
pnpm build:firefox
pnpm build:safari
```

### Using Makefile

```bash
# Build all extensions
make build

# Build specific browser
make build-chrome
make build-firefox
make build-safari

# Watch mode
make watch-chrome
make watch-firefox
make watch-safari

# Clean build artifacts
make clean

# Type check
make typecheck
```

## Testing

### Interactive Test Pages

#### 1. Digital Credentials API Test

Test basic DC API interception and wallet selection:

```bash
# Open the test page
open test-page.html  # macOS
xdg-open test-page.html  # Linux
start test-page.html  # Windows
```

**Features tested:**
- Basic digital identity credential requests
- Requests with specific claims
- Protocol-specific requests (OpenID4VP)
- Difference between digital identity and regular credential requests

#### 2. Wallet Auto-Registration Test

Test the wallet registration API:

```bash
open test-wallet-api.html  # macOS
xdg-open test-wallet-api.html  # Linux
start test-wallet-api.html  # Windows
```

**Features tested:**
- Extension detection (`WalletCompanion.DigitalCredentials.isInstalled`)
- Wallet registration with protocols
- JWT verifier registration
- API error handling

### Unit Tests

Run the complete test suite:

```bash
# Run all tests
pnpm test

# Run specific test files
pnpm vitest run tests/openid4vp.test.js
pnpm vitest run tests/jwt-verification.test.js

# Run with coverage
pnpm test:coverage

# Run unit tests only (no integration)
pnpm test:unit

# Watch mode for tests
pnpm test:watch
```

### Test Coverage

Current test coverage:
- ✅ 332 tests passing (9 test suites)
- ✅ OpenID4VP: Request parsing, JAR handling, response validation (36 tests)
- ✅ JWT Verification: Registration, callback execution, integration (21 tests)
- ✅ Protocol plugins: Registration, filtering, request processing (20 tests)
- ✅ Inject script: DC API interception, URL building (61 tests)
- ✅ Options page: Wallet management, presets, settings (59 tests)
- ✅ Popup: UI state, wallet display (33 tests)
- ✅ Modal: Wallet selector UI (45 tests)
- ✅ Content script: Message bridge (44 tests)
- ✅ Background: Storage, settings (13 tests)

### Integration Tests

Integration tests use Puppeteer to test the extension in a real browser:

```bash
pnpm test:integration
```

## Browser-Specific Development

### Chrome

1. Build the extension:

   ```bash
   pnpm build:chrome
   # or
   pnpm watch:chrome
   ```

2. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/chrome` directory

3. Reload after changes:
   - Click the reload icon on the extension card
   - Or use `Ctrl+R` when focused on `chrome://extensions/`

4. View logs:
   - Click "Inspect views: background page" for service worker logs
   - Use browser DevTools console for content script logs

### Firefox

1. Build the extension:

   ```bash
   pnpm build:firefox
   # or
   pnpm watch:firefox
   ```

2. Load in Firefox:
   - Open `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on"
   - Select `manifest.json` from the `dist/firefox` directory

3. Or use web-ext for development:

   ```bash
   pnpm dev:firefox
   ```

   This will:
   - Build the extension
   - Launch Firefox with the extension loaded
   - Auto-reload on changes

4. View logs:
   - Click "Inspect" button in `about:debugging`
   - Use browser console for logs

### Safari

1. Build the extension:

   ```bash
   pnpm build:safari
   # or
   pnpm watch:safari
   ```

2. Convert to Safari Web Extension (first time only):

   ```bash
   xcrun safari-web-extension-converter dist/safari/ --app-name "Wallet Companion"
   ```

3. Open the generated Xcode project and run it

4. Enable in Safari:
   - Safari → Preferences → Extensions
   - Enable "Wallet Companion"

5. View logs:
   - Develop menu → Show Extension Background Page

## Packaging for Distribution

### Chrome Web Store

```bash
# Using Make
make package-chrome

# Using pnpm
pnpm package:chrome
```

Creates `dist/chrome-extension.zip` ready for Chrome Web Store submission.

**Submission checklist:**
- [ ] Update version in `manifests/index.ts`
- [ ] Test in Chrome
- [ ] Run all tests
- [ ] Create package
- [ ] Upload to Chrome Web Store Developer Dashboard
- [ ] Fill in store listing details

### Firefox Add-ons

```bash
# Using Make
make package-firefox

# Using pnpm
pnpm package:firefox
```

Creates `dist/firefox-extension.xpi` ready for Firefox Add-ons submission.

**Submission checklist:**
- [ ] Update version in `manifests/index.ts`
- [ ] Test in Firefox
- [ ] Run all tests
- [ ] Create package
- [ ] Upload to addons.mozilla.org
- [ ] Fill in add-on details

### Safari App Store

Use Xcode to archive and export the app:

1. Open the Xcode project
2. Product → Archive
3. Distribute App → Mac App Store
4. Follow App Store submission workflow

## Project Structure

```
web-wallet-selector/
├── src/                    # Shared source code
│   ├── background/
│   │   └── index.js        # Background script (service worker)
│   ├── content/            # Content scripts
│   │   ├── index.js        # Content script (bridge)
│   │   ├── inject.js       # Page context (DC API interception)
│   │   ├── modal.js        # Wallet selection modal UI
│   │   ├── protocols.js    # Protocol plugin system
│   │   └── protocols/      # Protocol plugins
│   │       └── OpenID4VPPlugin.js  # OpenID4VP implementation
│   ├── ui/                 # Extension UI
│   │   ├── popup.html      # Extension popup
│   │   ├── popup.js
│   │   ├── options.html    # Wallet management options page
│   │   ├── options.js
│   │   ├── assets/
│   │   │   └── icons/      # Source icons and logos (SVG)
│   │   ├── style/
│   │   │   └── style.css
│   │   └── utils/
│   │       └── icons.ts
│   └── globals.d.ts
├── manifests/              # Browser manifest definitions
│   └── index.ts
├── dist/                   # Built extensions
│   ├── chrome/             # Chrome extension (built)
│   ├── firefox/            # Firefox extension (built)
│   └── safari/             # Safari extension (built)
├── tests/                  # Test suites
│   ├── *.test.js           # Unit tests (Vitest)
│   ├── openid4vp.test.js   # OpenID4VP protocol tests
│   ├── jwt-verification.test.js  # JWT callback tests
│   ├── integration.test.js # Integration tests
│   ├── setup.js
│   └── fixtures/           # Test fixtures
│       └── mock-wallet.html
├── docs/                   # Documentation
│   ├── design/             # Design documents
│   │   ├── OPENID4VP_IMPLEMENTATION.md
│   │   ├── JWT_VERIFICATION_CALLBACKS.md
│   │   ├── PROTOCOL_SUPPORT.md
│   │   └── AUTO_REGISTRATION_SUMMARY.md
│   ├── browser/            # Browser-specific docs
│   │   ├── chrome.md
│   │   └── safari.md
│   ├── icons/              # Icon documentation
│   ├── BRANDING.md         # Brand guidelines
│   └── BRANDING_UPDATE.md  # Branding changelog
├── tsconfig/               # TypeScript configurations
│   ├── background.json
│   ├── content.json
│   ├── node.json
│   └── ui.json
├── test-page.html          # DC API test page
├── test-wallet-api.html    # Wallet registration test
├── Makefile                # Build automation
├── package.json            # Dependencies and scripts
├── pnpm-lock.yaml          # pnpm lockfile
├── biome.json              # Biome linter/formatter config
├── vite.config.ts          # Vite build configuration
├── vitest.config.ts        # Vitest test configuration
├── tsconfig.json           # TypeScript configuration
├── README.md               # This file
├── QUICKSTART.md           # Quick start guide
├── API_REFERENCE.md        # Complete API reference
└── DEVELOPMENT.md          # This file
```

### Key Files

- **`src/content/inject.js`** - Injected into page context, intercepts `navigator.credentials.get()`, exposes `window.WalletCompanion` API
- **`src/content/index.js`** - Content script, bridges inject script and background script
- **`src/background/index.js`** - Service worker (Chrome) / background script (Firefox/Safari), manages wallets and state
- **`src/content/protocols.js`** - Protocol plugin registry and base classes
- **`src/content/protocols/OpenID4VPPlugin.js`** - Complete OpenID4VP protocol implementation
- **`src/content/modal.js`** - Wallet selection modal UI
- **`src/ui/options.js`** - Wallet management options page
- **`manifests/index.ts`** - Browser extension manifest definitions

## Debugging

### Chrome

1. **Background Script (Service Worker)**:
   - Go to `chrome://extensions/`
   - Find your extension
   - Click "Inspect views: background page"

2. **Content Script**:
   - Open DevTools on any page
   - Look for content script logs in the console

3. **Inject Script**:
   - Open DevTools
   - Logs from inject.js appear in the page console

4. **Common Issues**:
   - Manifest errors: Check `manifests/index.ts` and the generated `dist/chrome/manifest.json`
   - API not intercepted: Check URL patterns in `src/content/inject.js`
   - Modal not showing: Check console for errors

### Firefox

1. **Background Script**:
   - Go to `about:debugging#/runtime/this-firefox`
   - Find your extension
   - Click "Inspect"

2. **Content Script**:
   - Open DevTools (F12)
   - Check console for content script logs

3. **Debugging with web-ext**:
   ```bash
   pnpm dev:firefox
   ```
   Auto-reloads on file changes

4. **Common Issues**:
   - Manifest v2 compatibility: Firefox uses different manifest format
   - Background page vs service worker: Firefox uses persistent background pages

### Safari

1. **Background Page**:
   - Develop → Show Extension Background Page

2. **Content Script**:
   - Enable Develop menu
   - Inspect page
   - Check console

3. **Common Issues**:
   - Extension not appearing: Check Safari Preferences → Extensions
   - Code signing: Safari requires proper code signing for distribution

### General Debugging Tips

1. **Check Extension is Loaded**:
   ```javascript
   // On any page, in console:
   window.WalletCompanion?.isInstalled  // Should return true
   ```

2. **Test DC API Interception**:
   - Open `test-page.html`
   - Click "Request Digital Identity Credential"
   - Modal should appear

3. **Check Wallet Registration**:
   - Open extension options page
   - Should see configured wallets

4. **View Logs**:
   - Enable verbose logging in `src/background/index.js`
   - Check all three contexts: background, content, inject

5. **Reset Extension State**:
   ```javascript
   // In background script console:
   chrome.storage.local.clear();  // Chrome
   browser.storage.local.clear(); // Firefox/Safari
   ```

## Configuration

### Update URL Patterns

Edit `src/content/inject.js` to customize which URLs trigger DC API interception:

```javascript
function isDCApiCall(options) {
  // Customize this logic based on your needs
  return options?.digital !== undefined;
}
```

### Customize Default Wallets

Edit `src/background/index.js`:

```javascript
const DEFAULT_WALLETS = [
  {
    id: 'my-wallet',
    name: 'My Digital Wallet',
    url: 'https://wallet.example.com',
    protocols: ['openid4vp'],
    icon: '🔐',
    color: '#3b82f6',
    description: 'My preferred digital identity wallet',
    enabled: true
  }
];
```

### Update Extension Metadata

All browser manifests are generated from a single source:
- `manifests/index.ts` - Manifest definitions for all browsers (Chrome MV3, Firefox MV2, Safari MV2)

Update version, name, description, icons, and permissions there. The built manifests are written to `dist/<browser>/manifest.json` during the build.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `pnpm test`
5. Build all browsers: `pnpm build`
6. Submit a pull request

## Changesets

This project uses [Changesets](https://github.com/changesets/changesets) to manage versioning and changelog generation.

### Adding a Changeset

When your PR includes a user-facing change (bug fix, new feature, refactor, breaking change), add a changeset before opening the PR:

```bash
make changeset
```

This launches an interactive prompt asking you to:
1. Select the bump type: `patch` (bug fix), `minor` (new feature), or `major` (breaking change)
2. Write a summary of what changed

A new file is created in `.changeset/`. Commit it alongside your code changes.

### When Not to Add a Changeset

Skip the changeset for changes that don't affect consumers:
- Documentation updates
- Test-only changes
- CI/build config changes

### Releasing

To cut a release, run:

```bash
# 1. Apply all pending changesets — bumps version in package.json and updates CHANGELOG.md, and makes a commit automatically.
make version

# 2. Tag the commit and push
make tag
git push && git push --tags
```

### Pre-releases

To enter pre-release mode (e.g. for a `beta`):

```bash
make prerelease-mode enter beta
# add changesets and run `make version` as normal
make prerelease-mode exit
```

### GitHub Changelog Integration

The project uses `@changesets/changelog-github` to link PRs and contributors in the changelog. This requires a `GITHUB_TOKEN` environment variable with repo read access. Copy `.changeset/.env.example` to `.changeset/.env` and fill in your token — `make version` loads it automatically.

### Code Style

- Indent with tabs (size 4), except YAML files which use 2 spaces (and other rules in`.editorconfig`)
- Add JSDoc comments for public APIs
- Write tests for new features
- Follow existing code patterns
- Lint and format with Biome: `pnpm lint` / `pnpm lint:fix` / `pnpm format`

## Troubleshooting

### Extension not loading
- Ensure all files are built: `pnpm build`
- Check browser console for errors
- Verify manifest: check `manifests/index.ts` and rebuild

### API calls not intercepted
- Check URL patterns in `isDCApiCall()` function
- Verify permissions in `manifest.json`
- Check content script injection timing

### Changes not reflected
- Reload the extension in browser
- Use watch mode for automatic rebuilds: `pnpm watch:chrome`
- Clear browser cache if needed

### Tests failing
- Ensure dependencies are installed: `pnpm install`
- Check Node.js version (v18+)
- Run tests individually to isolate issues

## Resources

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Firefox Extension Workshop](https://extensionworkshop.com/)
- [Safari Web Extensions](https://developer.apple.com/documentation/safariservices/safari_web_extensions)
- [W3C Digital Credentials API](https://w3c.github.io/digital-credentials/)
- [OpenID4VP Specification](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html)
