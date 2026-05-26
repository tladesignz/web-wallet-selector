# Makefile for Wallet Companion Browser Extensions

.PHONY: help install clean build build-chrome build-firefox build-safari \
		watch watch-chrome watch-firefox watch-safari \
		package package-chrome package-firefox \
		dev-chrome dev-firefox dev-safari \
		lint lint-fix format test test-watch test-coverage test-all typecheck \
		check-deps status all rebuild \
		changeset version tag prerelease-mode

.DEFAULT_GOAL := help

DIST := dist

help: ## Show this help
	@echo "Wallet Companion - Browser Extension Build System"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  %-18s %s\n", $$1, $$2}'

install: ## Install dependencies
	pnpm install

clean: ## Clean build artifacts
	pnpm clean
	rm -rf coverage .nyc_output node_modules/.cache
	find . -type f \( -name '.DS_Store' -o -name 'Thumbs.db' -o -name '*~' \
		-o -name '*.swp' -o -name '*.swo' -o -name '*.log' \) -delete

# Build
build: ## Build all browsers
	pnpm build

build-chrome: ## Build Chrome
	pnpm build:chrome

build-firefox: ## Build Firefox
	pnpm build:firefox

build-safari: ## Build Safari
	pnpm build:safari

# Watch
watch: ## Watch Chrome (default)
	pnpm watch

watch-chrome: ## Watch Chrome
	pnpm watch:chrome

watch-firefox: ## Watch Firefox
	pnpm watch:firefox

watch-safari: ## Watch Safari
	pnpm watch:safari

# Package
package: package-chrome package-firefox ## Package all browsers

package-chrome: build-chrome ## Package Chrome as ZIP
	pnpm package:chrome

package-firefox: build-firefox ## Package Firefox as XPI
	pnpm package:firefox

# Development
dev-chrome: ## Open Chrome extensions page
	@echo "Load extension from: $(DIST)/chrome"
	@command -v google-chrome >/dev/null && google-chrome chrome://extensions/ || \
	 command -v chromium >/dev/null && chromium chrome://extensions/ || \
	 echo "Chrome not found"

dev-firefox: ## Run Firefox with extension
	pnpm dev:firefox

dev-safari: build-safari ## Safari setup instructions
	@echo "1. xcrun safari-web-extension-converter $(DIST)/safari/ --app-name 'Wallet Companion'"
	@echo "2. Open Xcode project and run"
	@echo "3. Enable in Safari Preferences > Extensions"

# Quality
lint: ## Run linter
	pnpm lint

lint-fix: ## Fix lint errors
	pnpm lint:fix

format: ## Format code
	pnpm format

typecheck: ## Type check
	pnpm typecheck

# Testing
test: ## Run tests
	pnpm test

test-watch: ## Run tests in watch mode
	pnpm test:watch

test-coverage: ## Run tests with coverage
	pnpm test:coverage

test-all: ## Run unit tests, build, and e2e tests
	pnpm test:all

# Utility
check-deps: ## Check dependencies
	@node --version && pnpm --version
	@test -d node_modules && echo "Dependencies installed" || echo "Run 'make install'"

status: ## Show build status
	@for browser in chrome firefox safari; do \
		printf "%-8s " "$$browser:"; \
		test -f $(DIST)/$$browser/manifest.json && echo "built" || echo "not built"; \
	done

all: clean install build package ## Full build pipeline

rebuild: clean build ## Clean and rebuild

# Versioning
changeset: ## Add changeset
	pnpm changeset add

version: ## Bump version
	pnpm dotenv -e .changeset/.env -- changeset version

tag: ## Create git tag
	pnpm changeset tag

prerelease-mode: ## Enter/exit prerelease mode
	pnpm changeset pre $(filter-out $@,$(MAKECMDGOALS))
