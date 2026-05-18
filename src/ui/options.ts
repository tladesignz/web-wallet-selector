/**
 * Options page script for Wallet Companion extension
 */

import type { GetSettingsResponse } from '@shared/schemas/messages';
import { InboundMessages } from '@shared/schemas/messages';
import type { Wallet, WalletRegistrationInput } from '@shared/schemas/resources';
import {
	fetchFavicon,
	generateGeometricIcon,
	generateIdenticon,
	generateInitialAvatar,
	type IconOption,
	isIconUrl,
	svgToDataUrl,
} from './utils/icons';
import { sendMessage } from './utils/messaging';

// ============================================================================
// Types
// ============================================================================

type FaviconElements = {
	section: HTMLElement;
	img: HTMLImageElement;
	status: HTMLElement;
};

type ExportConfig = {
	version: string;
	exportDate: string;
	wallets: Wallet[];
	settings: GetSettingsResponse;
};

type NotificationType = 'success' | 'error' | 'warning' | 'info';

// Cross-browser compatibility (storage still needed for direct stats clear)
const storage = typeof browser !== 'undefined' ? browser.storage : chrome.storage;

// SIROS ID preset providers
const SIROS_ID_PRESETS: readonly WalletRegistrationInput[] = [
	{
		name: 'SIROS ID',
		url: 'https://id.siros.org/id/default',
		icon: '<svg width="24" height="24" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="1024" height="1024" rx="512" fill="white"/><path fill-rule="evenodd" clip-rule="evenodd" d="M374.192 204.43C398.46 362.058 398.46 362.058 556.087 386.441C398.514 410.701 398.46 411.056 374.217 568.404C374.208 568.458 374.2 568.513 374.192 568.568C349.808 410.825 349.808 410.825 192.181 386.441C349.808 362.058 349.808 362.058 374.192 204.43ZM386.441 658.938C662.636 616.18 662.636 616.18 705.394 339.87C746.997 609.13 748.037 616.064 1003.55 655.702C1016.84 610.055 1024 561.865 1024 512.058C1024 229.161 794.839 0 511.942 0C229.161 0 0 229.161 0 512.058C0 794.839 229.161 1024 511.942 1024C742.49 1024 937.328 871.804 1001.58 662.405C747.921 701.696 746.881 709.785 705.394 977.775C662.636 701.58 662.636 701.58 386.441 658.938Z" fill="#1C4587"/></svg>',
		color: '#1C4587',
		description: 'Default SIROS ID tenant',
		protocols: ['openid4vp', 'openid4vp-v1-unsigned', 'openid4vp-v1-signed'],
	},
];

let wallets: Wallet[] = [];
let settings: GetSettingsResponse = {
	enabled: true,
	developerMode: false,
	stats: { interceptCount: 0, walletUses: {} },
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
	await loadData();
	setupEventListeners();
	setupIconSelectors();
	renderAll();
	updateDeveloperModeUI();
});

/**
 * Load wallets and settings from storage
 */
async function loadData(): Promise<void> {
	try {
		const walletsResponse = await sendMessage({ type: InboundMessages.GET_WALLETS });
		const settingsResponse = await sendMessage({ type: InboundMessages.GET_SETTINGS });

		wallets = walletsResponse.wallets || [];
		settings = settingsResponse || {
			enabled: true,
			developerMode: false,
			stats: { interceptCount: 0, walletUses: {} },
		};
	} catch (error) {
		console.error('Failed to load data:', error);
		showNotification('Failed to load data', 'error');
	}
}

/**
 * Setup all event listeners
 */
function setupEventListeners(): void {
	// Tab switching
	document.querySelectorAll<HTMLElement>('.tab-btn').forEach((tab) => {
		tab.addEventListener('click', () => {
			const tabName = tab.dataset.tab;
			if (tabName) switchTab(tabName);
		});
	});

	// Add wallet button
	const addWalletBtn = document.getElementById('add-wallet-btn');
	if (addWalletBtn) {
		addWalletBtn.addEventListener('click', () => {
			switchTab('add');
		});
	}

	// Add wallet form
	const addWalletForm = document.getElementById('add-wallet-form');
	if (addWalletForm) {
		addWalletForm.addEventListener('submit', handleAddWallet);
	}

	// Edit modal
	const deleteEdit = document.getElementById('delete-edit');
	if (deleteEdit) deleteEdit.addEventListener('click', handleDeleteEdit);

	const cancelEdit = document.getElementById('cancel-edit');
	if (cancelEdit) cancelEdit.addEventListener('click', closeEditModal);

	const closeEdit = document.getElementById('close-edit');
	if (closeEdit) closeEdit.addEventListener('click', closeEditModal);

	const saveEdit = document.getElementById('save-edit');
	if (saveEdit) saveEdit.addEventListener('click', handleSaveEdit);

	const editWalletEnabled = document.getElementById('edit-wallet-enabled');
	if (editWalletEnabled) {
		editWalletEnabled.addEventListener('change', updateWalletStatusLabel);
	}

	// Settings
	const extensionEnabled = document.getElementById('extension-enabled');
	if (extensionEnabled) extensionEnabled.addEventListener('change', handleToggleEnabled);

	const developerMode = document.getElementById('developer-mode');
	if (developerMode) developerMode.addEventListener('change', handleToggleDeveloperMode);

	const clearStats = document.getElementById('clear-stats');
	if (clearStats) clearStats.addEventListener('click', handleClearStats);

	const exportConfig = document.getElementById('export-config');
	if (exportConfig) exportConfig.addEventListener('click', handleExportConfig);

	const importConfig = document.getElementById('import-config');
	if (importConfig) importConfig.addEventListener('change', handleImportConfig);

	// Close modal on outside click
	const editModal = document.getElementById('edit-modal');
	if (editModal) {
		editModal.addEventListener('click', (e) => {
			if (e.target === editModal) {
				closeEditModal();
			}
		});
	}
}

/**
 * Setup icon selector buttons
 */
function setupIconSelectors() {
	// Add form icon selector - emoji buttons
	const iconGrid = document.getElementById('icon-emoji-grid');
	if (iconGrid) {
		iconGrid.querySelectorAll<HTMLElement>('.emoji-btn').forEach((btn) => {
			btn.addEventListener('click', () => {
				const emoji = btn.dataset.emoji;
				if (emoji) selectIcon('emoji', emoji);
			});
		});
	}

	// Add form favicon button
	const faviconBtn = document.getElementById('favicon-option');
	if (faviconBtn) {
		faviconBtn.addEventListener('click', () => {
			const faviconImg = document.getElementById('favicon-img');
			if (faviconImg instanceof HTMLImageElement && faviconImg.src) {
				selectIcon('favicon', faviconImg.src);
			}
		});
	}

	// Edit form icon selector - emoji buttons
	const editIconGrid = document.getElementById('edit-icon-emoji-grid');
	if (editIconGrid) {
		editIconGrid.querySelectorAll<HTMLElement>('.emoji-btn').forEach((btn) => {
			btn.addEventListener('click', () => {
				const emoji = btn.dataset.emoji;
				if (emoji) selectEditIcon('emoji', emoji);
			});
		});
	}

	// Edit form favicon button
	const editFaviconBtn = document.getElementById('edit-favicon-option');
	if (editFaviconBtn) {
		editFaviconBtn.addEventListener('click', () => {
			const faviconImg = document.getElementById('edit-favicon-img');
			if (faviconImg instanceof HTMLImageElement && faviconImg.src) {
				selectEditIcon('favicon', faviconImg.src);
			}
		});
	}

	// URL input listener for favicon fetching
	const urlInput = document.getElementById('wallet-url');
	const nameInput = document.getElementById('wallet-name');

	if (urlInput) {
		urlInput.addEventListener('blur', handleUrlChange);
		urlInput.addEventListener('change', handleUrlChange);
	}

	if (nameInput) {
		nameInput.addEventListener('input', debounce(handleNameChange, 300));
	}

	// Edit form URL and name listeners
	const editUrlInput = document.getElementById('edit-wallet-url');
	const editNameInput = document.getElementById('edit-wallet-name');

	if (editUrlInput) {
		editUrlInput.addEventListener('blur', handleEditUrlChange);
		editUrlInput.addEventListener('change', handleEditUrlChange);
	}

	if (editNameInput) {
		editNameInput.addEventListener('input', debounce(handleEditNameChange, 300));
	}
}

/**
 * Debounce helper
 */
function debounce<T extends (...args: unknown[]) => void>(func: T, wait: number): T {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	return function executedFunction(...args: unknown[]) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	} as T;
}

/**
 * Handle URL input change - fetch favicon and generate icons
 */
async function handleUrlChange(): Promise<void> {
	const urlInput = document.getElementById('wallet-url');
	const nameInput = document.getElementById('wallet-name');

	if (!(urlInput instanceof HTMLInputElement) || !(nameInput instanceof HTMLInputElement)) {
		console.error('handleUrlChange: Missing required form inputs', { urlInput, nameInput });
		return;
	}

	const url = urlInput.value.trim();
	const name = nameInput.value.trim();

	if (!url) return;

	const iconOptions = document.getElementById('icon-options');
	const generatedIconsContainer = document.getElementById('generated-icons');
	const faviconSection = document.getElementById('favicon-section');
	const faviconImg = document.getElementById('favicon-img');
	const faviconStatus = document.getElementById('favicon-status');

	if (
		!generatedIconsContainer ||
		!faviconSection ||
		!(faviconImg instanceof HTMLImageElement) ||
		!faviconStatus
	) {
		console.error('handleUrlChange: Missing icon elements', {
			generatedIconsContainer,
			faviconSection,
			faviconImg,
			faviconStatus,
		});
		return;
	}

	// Generate and render icons
	const generatedIcons = generateIconsArray(url, name);
	renderIconButtons(generatedIconsContainer, generatedIcons, selectIcon);

	// Auto-select first generated icon
	selectIcon(generatedIcons[0].type, generatedIcons[0].value);

	// Fetch favicon in background
	await fetchAndDisplayFavicon(
		url,
		{
			section: faviconSection,
			img: faviconImg,
			status: faviconStatus,
		},
		(favicon) => selectIcon('favicon', favicon),
	);

	if (iconOptions) iconOptions.classList.remove('_hidden');
}

/**
 * Handle name input change - regenerate icons
 */
function handleNameChange(): void {
	const urlInput = document.getElementById('wallet-url');
	const nameInput = document.getElementById('wallet-name');

	if (!(urlInput instanceof HTMLInputElement) || !(nameInput instanceof HTMLInputElement)) {
		console.error('handleNameChange: Missing required form inputs', { urlInput, nameInput });
		return;
	}

	const url = urlInput.value.trim();
	const name = nameInput.value.trim();

	if (!name) return;

	const generatedIconsContainer = document.getElementById('generated-icons');
	if (!generatedIconsContainer) {
		console.error('handleNameChange: Missing generated-icons container');
		return;
	}

	const generatedIcons = generateIconsArray(url, name);
	renderIconButtons(generatedIconsContainer, generatedIcons, selectIcon);
}

/**
 * Generate icon options for the edit form
 */
async function generateEditIconOptions(
	url: string,
	name: string,
	currentIcon: string | null | undefined,
	currentIconType: string | null | undefined,
): Promise<void> {
	const iconOptions = document.getElementById('edit-icon-options');
	const generatedIconsContainer = document.getElementById('edit-generated-icons');
	const preview = document.getElementById('edit-icon-preview');
	const faviconSection = document.getElementById('edit-favicon-section');
	const faviconImg = document.getElementById('edit-favicon-img');
	const faviconStatus = document.getElementById('edit-favicon-status');

	if (!generatedIconsContainer) {
		console.error('generateEditIconOptions: Missing edit-generated-icons container');
		return;
	}

	// Generate and render icons
	const generatedIcons = generateIconsArray(url, name);
	renderIconButtons(generatedIconsContainer, generatedIcons, selectEditIcon);

	// Show icon options
	if (iconOptions) iconOptions.classList.remove('_hidden');

	// Fetch favicon in background
	if (url && faviconSection && faviconImg instanceof HTMLImageElement && faviconStatus) {
		await fetchAndDisplayFavicon(
			url,
			{
				section: faviconSection,
				img: faviconImg,
				status: faviconStatus,
			},
			(favicon) => {
				// If current icon is favicon type, select it
				if (currentIconType === 'favicon') {
					selectEditIcon('favicon', favicon);
				}
			},
		);
	}

	// Select current icon
	if (currentIcon) {
		if (currentIconType === 'emoji' || !isIconUrl(currentIcon)) {
			selectEditIcon('emoji', currentIcon);
		} else if (currentIconType && currentIconType !== 'favicon') {
			// It's a generated icon type - select matching generated icon
			selectEditIcon(currentIconType, currentIcon);
		} else if (currentIconType !== 'favicon' && preview) {
			// Default: show the current icon in preview but don't select anything
			if (isIconUrl(currentIcon)) {
				preview.innerHTML = `<img src="${currentIcon}" alt="Wallet icon">`;
			} else {
				preview.innerHTML = `<span style="font-size: 32px;">${currentIcon}</span>`;
			}
		}
	}
}

/**
 * Handle URL change in edit form - regenerate icons
 */
async function handleEditUrlChange(): Promise<void> {
	const urlInput = document.getElementById('edit-wallet-url');
	const nameInput = document.getElementById('edit-wallet-name');

	if (!(urlInput instanceof HTMLInputElement) || !(nameInput instanceof HTMLInputElement)) {
		console.error('handleEditUrlChange: Missing required form inputs', { urlInput, nameInput });
		return;
	}

	const url = urlInput.value.trim();
	const name = nameInput.value.trim();

	if (!url) return;

	const generatedIconsContainer = document.getElementById('edit-generated-icons');
	const iconOptions = document.getElementById('edit-icon-options');
	const faviconSection = document.getElementById('edit-favicon-section');
	const faviconImg = document.getElementById('edit-favicon-img');
	const faviconStatus = document.getElementById('edit-favicon-status');

	if (!generatedIconsContainer) {
		console.error('handleEditUrlChange: Missing edit-generated-icons container');
		return;
	}

	// Generate and render icons
	const generatedIcons = generateIconsArray(url, name);
	renderIconButtons(generatedIconsContainer, generatedIcons, selectEditIcon);

	// Auto-select first generated icon
	selectEditIcon(generatedIcons[0].type, generatedIcons[0].value);

	// Fetch favicon in background
	if (faviconSection && faviconImg instanceof HTMLImageElement && faviconStatus) {
		await fetchAndDisplayFavicon(
			url,
			{
				section: faviconSection,
				img: faviconImg,
				status: faviconStatus,
			},
			(favicon) => selectEditIcon('favicon', favicon),
		);
	}

	if (iconOptions) iconOptions.classList.remove('_hidden');
}

/**
 * Handle name change in edit form - regenerate icons
 */
function handleEditNameChange(): void {
	const urlInput = document.getElementById('edit-wallet-url');
	const nameInput = document.getElementById('edit-wallet-name');

	if (!(urlInput instanceof HTMLInputElement) || !(nameInput instanceof HTMLInputElement)) {
		console.error('handleEditNameChange: Missing required form inputs', { urlInput, nameInput });
		return;
	}

	const url = urlInput.value.trim();
	const name = nameInput.value.trim();

	if (!name) return;

	const generatedIconsContainer = document.getElementById('edit-generated-icons');
	if (!generatedIconsContainer) {
		console.error('handleEditNameChange: Missing edit-generated-icons container');
		return;
	}

	const generatedIcons = generateIconsArray(url, name);
	renderIconButtons(generatedIconsContainer, generatedIcons, selectEditIcon);
}

/**
 * Switch between tabs
 */
function switchTab(tabName: string): void {
	// Update tab buttons
	document.querySelectorAll<HTMLElement>('.tab-btn').forEach((tab) => {
		tab.classList.toggle('-active', tab.dataset.tab === tabName);
	});

	// Update tab content
	document.querySelectorAll('.tab-content').forEach((content) => {
		content.classList.toggle('-active', content.id === `${tabName}-tab`);
	});
}

/**
 * Render all content
 */
function renderAll() {
	renderWallets();
	renderPresets();
	renderStats();
	renderSettings();
}

/**
 * Render wallets list
 */
function renderWallets(): void {
	const container = document.getElementById('wallets-container');
	if (!container) {
		console.error('renderWallets: Missing wallets-container');
		return;
	}

	if (wallets.length === 0) {
		container.innerHTML = `
      <div class="empty-state">
        <div class="icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus-icon lucide-plus"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
        </div>
        <div class="title">Configure a wallet</div>
        <div class="text">No wallets configured, add one to get started.</div>
        <button class="s-button empty-state-add-btn">Add Your First Wallet</button>
      </div>
    `;
		// Attach click handler for empty state button
		const addBtn = container.querySelector('.empty-state-add-btn');
		if (addBtn) {
			addBtn.addEventListener('click', () => {
				switchTab('add');
			});
		}
		return;
	}

	container.innerHTML = `
    <div class="wallet-grid">
      ${wallets.map((wallet) => renderWalletCard(wallet)).join('')}
      <div class="add-card">
        <div class="icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus-icon lucide-plus"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
        </div>
        <h3 class="title">Add Another Wallet</h3>
        <p class="description">Connect a new digital identity provider to your dashboard.</p>
      </div>
    </div>
  `;

	// Attach click handler for add another wallet card
	const addCard = container.querySelector('.add-card');
	if (addCard) {
		addCard.addEventListener('click', () => {
			switchTab('add');
		});
	}

	// Attach event listeners to wallet actions
	wallets.forEach((wallet) => {
		const card = container.querySelector(`[data-wallet-id="${wallet.id}"]`);
		if (card) {
			const editBtn = card.querySelector('.btn-edit');
			if (editBtn) {
				editBtn.addEventListener('click', () => openEditModal(wallet));
			}

			const toggleWallet = card.querySelector('.toggle-wallet');
			if (toggleWallet) {
				toggleWallet.addEventListener('change', (e) => {
					const target = e.target;
					if (target instanceof HTMLInputElement) {
						handleToggleWallet(wallet.id, target.checked);
					}
				});
			}
		}
	});
}

/**
 * Render a single wallet card
 */
function renderWalletCard(wallet: Wallet): string {
	const uses = settings.stats.walletUses[wallet.id] || 0;
	const isDefault = wallets.findIndex((w) => w.id === wallet.id) === 0;

	// Build protocols display for developer mode
	let protocolsDisplay = '';
	if (settings.developerMode && wallet.protocols && wallet.protocols.length > 0) {
		protocolsDisplay = `
      <div class="wallet-protocols">
        <div class="label">Protocols</div>
        <div class="protocols">${wallet.protocols.map((p) => `<code>${escapeHtml(p)}</code>`).join('')}</div>
      </div>
    `;
	}

	// Render icon - handle both emoji and image icons
	let iconHtml: string;
	let icon = wallet.icon;

	// If icon is missing or is the default emoji, generate one dynamically
	if (!icon || icon === '🔐') {
		// Generate an identicon based on the wallet URL or name
		const identifier = wallet.url || wallet.name || wallet.id;
		try {
			const svg = generateIdenticon(identifier);
			icon = svgToDataUrl(svg);
		} catch (e) {
			console.error('Icon generation failed:', e);
			icon = '🔐'; // Fallback to emoji if generation fails
		}
	}

	// Check if icon is a URL (data: or http)
	const iconIsUrl = icon && (icon.startsWith('data:') || icon.startsWith('http'));
	if (iconIsUrl) {
		iconHtml = `<img src="${escapeHtml(icon)}" alt="${escapeHtml(wallet.name)}" style="width: 32px; height: 32px; object-fit: contain;">`;
	} else {
		iconHtml = `<span class="wallet-emoji">${icon}</span>`;
	}

	return `
    <div class="wallet-card ${wallet.enabled ? '' : '-disabled'}" data-wallet-id="${wallet.id}">
      <div class="header">
        <div class="wallet-icon -large">
          ${iconHtml}
        </div>
        <div class="info">
          <div class="name">${escapeHtml(wallet.name)}</div>
          <div class="url">${escapeHtml(wallet.url)}</div>
        </div>
      </div>
      ${wallet.description ? `<div class="description">${escapeHtml(wallet.description)}</div>` : ''}

      ${protocolsDisplay}

      <div class="meta">
        ${wallet.enabled ? '<span class="badge-label -success">Active</span>' : '<span class="badge-label -warning">Inactive</span>'}
        ${isDefault ? '<span class="badge-label -info">Default</span>' : ''}
        ${uses > 0 ? `<span class="badge-label -info">Used ${uses}x</span>` : ''}
      </div>

      <div class="actions">
        <div class="left">
          <label class="toggle-switch -large" title="${wallet.enabled ? 'Deactivate' : 'Activate'} wallet">
            <input type="checkbox" class="toggle-wallet" ${wallet.enabled ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
        <div class="right">
          <button class="s-button -secondary btn-edit">Edit</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render preset wallets
 */
function renderPresets(): void {
	const container = document.getElementById('preset-wallets');
	if (!container) {
		console.error('renderPresets: Missing preset-wallets container');
		return;
	}

	container.innerHTML = SIROS_ID_PRESETS.map((preset) => {
		const isAdded = wallets.some((w) => w.url === preset.url);
		return `
      <div class="preset-card ${isAdded ? '-added' : ''}" data-preset='${JSON.stringify(preset)}'>
        <div class="icon">${preset.icon}</div>
        <div class="info">
          <div class="name">${escapeHtml(preset.name)}</div>
          ${
						isAdded
							? '<div class="status -added"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Added</div>'
							: '<div class="status">Click to add</div>'
					}
        </div>
        ${!isAdded ? '<button class="btn">Add</button>' : ''}
      </div>
    `;
	}).join('');

	// Attach click handlers
	container.querySelectorAll<HTMLElement>('.preset-card:not(.-added)').forEach((card) => {
		const btn = card.querySelector('.btn');
		if (btn) {
			btn.addEventListener('click', (e) => {
				e.stopPropagation();
				const presetData = card.dataset.preset;
				if (presetData) {
					const preset = JSON.parse(presetData);
					addPresetWallet(preset);
				}
			});
		}
	});
}

/**
 * Render statistics
 */
function renderStats(): void {
	const totalWallets = document.getElementById('total-wallets');
	const activeWallets = document.getElementById('active-wallets');
	const totalRequests = document.getElementById('total-requests');

	if (totalWallets) totalWallets.textContent = String(wallets.length);
	if (activeWallets) activeWallets.textContent = String(wallets.filter((w) => w.enabled).length);
	if (totalRequests) totalRequests.textContent = String(settings.stats.interceptCount || 0);
}

/**
 * Render settings
 */
function renderSettings(): void {
	const extensionEnabled = document.getElementById('extension-enabled');
	const developerMode = document.getElementById('developer-mode');

	if (extensionEnabled instanceof HTMLInputElement) {
		extensionEnabled.checked = settings.enabled !== false;
	}
	if (developerMode instanceof HTMLInputElement) {
		developerMode.checked = settings.developerMode === true;
	}
}

/**
 * Add preset wallet
 */
async function addPresetWallet(preset: Wallet): Promise<void> {
	// Check if this preset already exists
	const exists = wallets.some((w) => w.url === preset.url);
	if (exists) {
		showNotification(`${preset.name} is already configured`, 'warning');
		return;
	}

	const wallet: Wallet = {
		id: generateId(),
		name: preset.name,
		url: preset.url,
		icon: preset.icon,
		color: preset.color,
		description: preset.description,
		protocols: preset.protocols || [],
		enabled: true,
	};

	wallets.push(wallet);
	await saveWallets();
	renderAll();
	showNotification(`${preset.name} added successfully`, 'success');
	switchTab('wallets');
}

/**
 * Handle add wallet form submission
 */
async function handleAddWallet(e: Event): Promise<void> {
	e.preventDefault();

	const nameInput = document.getElementById('wallet-name');
	const urlInput = document.getElementById('wallet-url');
	const descInput = document.getElementById('wallet-description');
	const iconInput = document.getElementById('wallet-icon');
	const iconTypeInput = document.getElementById('wallet-icon-type');
	const enabledInput = document.getElementById('wallet-enabled');
	const protocolsInput = document.getElementById('wallet-protocols');

	if (!(nameInput instanceof HTMLInputElement)) {
		console.error('handleAddWallet: wallet-name is not an input');
		return;
	}
	if (!(urlInput instanceof HTMLInputElement)) {
		console.error('handleAddWallet: wallet-url is not an input');
		return;
	}
	if (!(descInput instanceof HTMLInputElement || descInput instanceof HTMLTextAreaElement)) {
		console.error('handleAddWallet: wallet-description is not an input/textarea');
		return;
	}
	if (!(iconInput instanceof HTMLInputElement)) {
		console.error('handleAddWallet: wallet-icon is not an input');
		return;
	}
	if (!(enabledInput instanceof HTMLInputElement)) {
		console.error('handleAddWallet: wallet-enabled is not an input');
		return;
	}

	const wallet: Wallet = {
		id: generateId(),
		name: nameInput.value,
		url: urlInput.value,
		description: descInput.value,
		icon: iconInput.value || '🔐',
		iconType: iconTypeInput instanceof HTMLInputElement ? iconTypeInput.value || 'emoji' : 'emoji',
		color: '#1C4587',
		enabled: enabledInput.checked,
	};

	// Add protocols if developer mode is enabled
	if (settings.developerMode && protocolsInput instanceof HTMLTextAreaElement) {
		const protocolsText = protocolsInput.value.trim();
		if (protocolsText) {
			wallet.protocols = protocolsText
				.split('\n')
				.map((p: string) => p.trim())
				.filter((p: string) => p.length > 0);
		}
	}

	wallets.push(wallet);
	await saveWallets();

	if (e.target instanceof HTMLFormElement) {
		e.target.reset();
	}
	// Reset icon selector
	resetIconSelector();

	renderAll();
	showNotification(`${wallet.name} added successfully`, 'success');
	switchTab('wallets');
}

/**
 * Reset the icon selector to default state
 */
function resetIconSelector(): void {
	const preview = document.getElementById('icon-preview');
	const iconOptions = document.getElementById('icon-options');
	const iconInput = document.getElementById('wallet-icon');
	const iconTypeInput = document.getElementById('wallet-icon-type');
	const faviconSection = document.getElementById('favicon-section');
	const generatedIcons = document.getElementById('generated-icons');

	// Clear all selections
	document.querySelectorAll('#icon-emoji-grid .emoji-btn').forEach((b) => {
		b.classList.remove('-selected');
	});

	// Reset preview
	if (preview) preview.innerHTML = '<span class="placeholder">?</span>';
	if (iconOptions) iconOptions.classList.add('_hidden');
	if (iconInput instanceof HTMLInputElement) iconInput.value = '';
	if (iconTypeInput instanceof HTMLInputElement) iconTypeInput.value = '';
	if (faviconSection) faviconSection.classList.add('_hidden');
	if (generatedIcons) generatedIcons.innerHTML = '';
}
/**
 * Open edit modal
 */
async function openEditModal(wallet: Wallet): Promise<void> {
	const idInput = document.getElementById('edit-wallet-id');
	const nameInput = document.getElementById('edit-wallet-name');
	const urlInput = document.getElementById('edit-wallet-url');
	const descInput = document.getElementById('edit-wallet-description');
	const iconInput = document.getElementById('edit-wallet-icon');
	const iconTypeInput = document.getElementById('edit-wallet-icon-type');
	const enabledInput = document.getElementById('edit-wallet-enabled');
	const protocolsInput = document.getElementById('edit-wallet-protocols');
	const modal = document.getElementById('edit-modal');

	if (idInput instanceof HTMLInputElement) idInput.value = wallet.id;
	if (nameInput instanceof HTMLInputElement) nameInput.value = wallet.name;
	if (urlInput instanceof HTMLInputElement) urlInput.value = wallet.url;
	if (descInput instanceof HTMLInputElement || descInput instanceof HTMLTextAreaElement) {
		descInput.value = wallet.description || '';
	}
	if (iconInput instanceof HTMLInputElement) iconInput.value = wallet.icon || '🔐';
	if (iconTypeInput instanceof HTMLInputElement) iconTypeInput.value = wallet.iconType || 'emoji';
	if (enabledInput instanceof HTMLInputElement) enabledInput.checked = wallet.enabled;
	updateWalletStatusLabel();

	// Generate and display icon options
	await generateEditIconOptions(wallet.url, wallet.name, wallet.icon, wallet.iconType);

	// Populate protocols if developer mode is enabled
	if (settings.developerMode && wallet.protocols && protocolsInput instanceof HTMLTextAreaElement) {
		protocolsInput.value = wallet.protocols.join('\n');
	} else if (protocolsInput instanceof HTMLTextAreaElement) {
		protocolsInput.value = '';
	}

	// Ensure developer mode UI is updated for the modal
	updateDeveloperModeUI();

	if (modal) modal.classList.add('-active');
}

/**
 * Handle delete wallet from edit modal
 */
async function handleDeleteEdit(): Promise<void> {
	const idInput = document.getElementById('edit-wallet-id');
	if (!(idInput instanceof HTMLInputElement)) {
		console.error('handleDeleteEdit: edit-wallet-id is not an input');
		return;
	}
	await handleRemoveWallet(idInput.value);
	closeEditModal();
}

/**
 * Update the wallet status label based on toggle state
 */
function updateWalletStatusLabel(): void {
	const enabledInput = document.getElementById('edit-wallet-enabled');
	const statusLabel = document.getElementById('edit-wallet-status');
	if (enabledInput instanceof HTMLInputElement && statusLabel) {
		statusLabel.textContent = enabledInput.checked ? 'Active' : 'Inactive';
	}
}

/**
 * Close edit modal
 */
function closeEditModal(): void {
	const modal = document.getElementById('edit-modal');
	if (modal) modal.classList.remove('-active');
}

/**
 * Handle save edit
 */
async function handleSaveEdit(): Promise<void> {
	const idInput = document.getElementById('edit-wallet-id');
	const nameInput = document.getElementById('edit-wallet-name');
	const urlInput = document.getElementById('edit-wallet-url');
	const descInput = document.getElementById('edit-wallet-description');
	const iconInput = document.getElementById('edit-wallet-icon');
	const iconTypeInput = document.getElementById('edit-wallet-icon-type');
	const enabledInput = document.getElementById('edit-wallet-enabled');
	const protocolsInput = document.getElementById('edit-wallet-protocols');

	if (!(idInput instanceof HTMLInputElement)) {
		console.error('handleSaveEdit: edit-wallet-id is not an input');
		return;
	}
	if (!(nameInput instanceof HTMLInputElement)) {
		console.error('handleSaveEdit: edit-wallet-name is not an input');
		return;
	}
	if (!(urlInput instanceof HTMLInputElement)) {
		console.error('handleSaveEdit: edit-wallet-url is not an input');
		return;
	}
	if (!(enabledInput instanceof HTMLInputElement)) {
		console.error('handleSaveEdit: edit-wallet-enabled is not an input');
		return;
	}

	const walletId = idInput.value;
	const walletIndex = wallets.findIndex((w) => w.id === walletId);

	if (walletIndex === -1) return;

	const updatedWallet: Wallet = {
		...wallets[walletIndex],
		name: nameInput.value,
		url: urlInput.value,
		description:
			descInput instanceof HTMLInputElement || descInput instanceof HTMLTextAreaElement
				? descInput.value
				: wallets[walletIndex].description,
		icon: iconInput instanceof HTMLInputElement ? iconInput.value || '🔐' : '🔐',
		iconType: iconTypeInput instanceof HTMLInputElement ? iconTypeInput.value || 'emoji' : 'emoji',
		enabled: enabledInput.checked,
	};

	// Update protocols if developer mode is enabled
	if (settings.developerMode && protocolsInput instanceof HTMLTextAreaElement) {
		const protocolsText = protocolsInput.value.trim();
		if (protocolsText) {
			updatedWallet.protocols = protocolsText
				.split('\n')
				.map((p: string) => p.trim())
				.filter((p: string) => p.length > 0);
		} else {
			updatedWallet.protocols = [];
		}
	}

	wallets[walletIndex] = updatedWallet;

	await saveWallets();
	closeEditModal();
	renderAll();
	showNotification('Wallet updated successfully', 'success');
}

/**
 * Handle remove wallet
 */
async function handleRemoveWallet(walletId: string): Promise<void> {
	if (!confirm('Are you sure you want to remove this wallet?')) {
		return;
	}

	wallets = wallets.filter((w) => w.id !== walletId);
	await saveWallets();
	renderAll();
	showNotification('Wallet removed successfully', 'success');
}

/**
 * Handle toggle wallet
 */
async function handleToggleWallet(walletId: string, enabled: boolean): Promise<void> {
	const wallet = wallets.find((w) => w.id === walletId);
	if (!wallet) return;

	wallet.enabled = enabled;
	await saveWallets();
	renderAll();
	showNotification(`Wallet ${wallet.enabled ? 'activated' : 'deactivated'}`, 'success');
}

/**
 * Handle toggle enabled
 */
async function handleToggleEnabled(e: Event): Promise<void> {
	const target = e.target;
	if (!(target instanceof HTMLInputElement)) {
		console.error('handleToggleEnabled: event target is not an input');
		return;
	}
	settings.enabled = target.checked;
	await saveSettings();
	showNotification(settings.enabled ? 'Extension active' : 'Extension inactive', 'success');
}

/**
 * Handle toggle developer mode
 */
async function handleToggleDeveloperMode(e: Event): Promise<void> {
	const target = e.target;
	if (!(target instanceof HTMLInputElement)) {
		console.error('handleToggleDeveloperMode: event target is not an input');
		return;
	}
	settings.developerMode = target.checked;
	await saveSettings();
	updateDeveloperModeUI();
	showNotification(
		settings.developerMode ? 'Developer mode enabled' : 'Developer mode disabled',
		'success',
	);
}

/**
 * Update UI based on developer mode state
 */
function updateDeveloperModeUI() {
	const devMode = settings.developerMode === true;

	// Show/hide protocols fields in add and edit forms
	const addProtocolsGroup = document.getElementById('add-protocols-group');
	const editProtocolsGroup = document.getElementById('edit-protocols-group');

	if (addProtocolsGroup) {
		addProtocolsGroup.classList.toggle('_hidden', !devMode);
	}
	if (editProtocolsGroup) {
		editProtocolsGroup.classList.toggle('_hidden', !devMode);
	}
}

/**
 * Handle clear stats
 */
async function handleClearStats() {
	if (!confirm('Are you sure you want to clear all statistics?')) {
		return;
	}

	try {
		await storage.local.set({ usage_stats: { interceptCount: 0, walletUses: {} } });
		await loadData();
		renderStats();
		showNotification('Statistics cleared', 'success');
	} catch (error) {
		console.error('Failed to clear stats:', error);
		showNotification('Failed to clear statistics', 'error');
	}
}

/**
 * Handle export configuration
 */
function handleExportConfig(): void {
	const config: ExportConfig = {
		version: '1.0',
		exportDate: new Date().toISOString(),
		wallets: wallets,
		settings: settings,
	};

	const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `wallet-config-${Date.now()}.json`;
	a.click();
	URL.revokeObjectURL(url);

	showNotification('Configuration exported', 'success');
}

/**
 * Handle import configuration
 */
async function handleImportConfig(e: Event): Promise<void> {
	const target = e.target;
	if (!(target instanceof HTMLInputElement)) {
		console.error('handleImportConfig: event target is not an input');
		return;
	}
	const file = target.files?.[0];
	if (!file) return;

	try {
		const text = await file.text();
		const config = JSON.parse(text);

		if (!config.wallets || !Array.isArray(config.wallets)) {
			throw new Error('Invalid configuration format');
		}

		if (!confirm(`This will import ${config.wallets.length} wallet(s). Continue?`)) {
			return;
		}

		// Merge with existing wallets, avoiding duplicates
		config.wallets.forEach((importedWallet: Wallet) => {
			const exists = wallets.some((w) => w.url === importedWallet.url);
			if (!exists) {
				wallets.push({
					...importedWallet,
					id: generateId(), // Regenerate ID to avoid conflicts
				});
			}
		});

		await saveWallets();
		renderAll();
		showNotification(`Imported ${config.wallets.length} wallet(s)`, 'success');
	} catch (error) {
		console.error('Failed to import config:', error);
		showNotification('Failed to import configuration', 'error');
	}

	target.value = ''; // Reset file input
}

/**
 * Save wallets to storage
 */
async function saveWallets(): Promise<void> {
	try {
		await sendMessage({ type: InboundMessages.SAVE_WALLETS, wallets: wallets });
	} catch (error) {
		console.error('Failed to save wallets:', error);
		showNotification('Failed to save changes', 'error');
		throw error;
	}
}

/**
 * Save settings to storage
 */
async function saveSettings(): Promise<void> {
	try {
		await sendMessage({
			type: InboundMessages.SAVE_SETTINGS,
			enabled: settings.enabled,
			developerMode: settings.developerMode,
		});
	} catch (error) {
		console.error('Failed to save settings:', error);
		showNotification('Failed to save settings', 'error');
		throw error;
	}
}

/**
 * Generate unique ID
 */
function generateId(): string {
	return `wallet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(unsafe: string | undefined | null): string {
	if (!unsafe) return '';
	return unsafe
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

/**
 * Show notification
 */
function showNotification(message: string, type: NotificationType = 'info'): void {
	const types = {
		success: {
			title: 'Success!',
			icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-icon lucide-check"><path d="M20 6 9 17l-5-5"/></svg>',
		},
		error: {
			title: 'Error!',
			icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
		},
		warning: {
			title: 'Warning!',
			icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-triangle-alert-icon lucide-triangle-alert"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
		},
		info: {
			title: 'Info',
			icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-info-icon lucide-info"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
		},
	};

	const toast = document.createElement('div');
	toast.className = `toast-item -${type}`;
	toast.innerHTML = `
    <span class="icon">${types[type]?.icon || types.info.icon}</span>
    <div class="body">
      <div class="title">${types[type]?.title || types.info.title}</div>
      <div class="message">${escapeHtml(message)}</div>
    </div>
    <button class="close" aria-label="Close">&times;</button>
  `;

	const closeBtn = toast.querySelector('.close');
	if (closeBtn) {
		closeBtn.addEventListener('click', () => {
			toast.style.animation = 'slideOut 0.3s ease';
			setTimeout(() => toast.remove(), 300);
		});
	}

	const container = document.getElementById('toast-container');
	if (container) container.appendChild(toast);

	setTimeout(() => {
		toast.style.animation = 'slideOut 0.3s ease';
		setTimeout(() => toast.remove(), 300);
	}, 3000);
}

// ============================================================================
// Icon Selector Helpers (shared between add and edit forms)
// ============================================================================

/**
 * Generate icon options array from URL and name
 */
function generateIconsArray(url: string, name: string): IconOption[] {
	const identifier = url || name || 'wallet';
	const walletName = name || 'Wallet';

	return [
		{ type: 'identicon', value: svgToDataUrl(generateIdenticon(identifier)) },
		{ type: 'initial', value: svgToDataUrl(generateInitialAvatar(walletName)) },
		{ type: 'geometric-1', value: svgToDataUrl(generateGeometricIcon(identifier)) },
		{ type: 'geometric-2', value: svgToDataUrl(generateGeometricIcon(`${identifier}2`)) },
	];
}

/**
 * Render icon buttons into a container
 */
function renderIconButtons(
	container: HTMLElement,
	icons: IconOption[],
	onSelect: (type: string, value: string) => void,
): void {
	container.innerHTML = '';
	icons.forEach((iconData) => {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'icon-option';
		btn.dataset.type = iconData.type;
		btn.dataset.value = iconData.value;
		btn.title = iconData.type;
		btn.innerHTML = `<img src="${iconData.value}" alt="${iconData.type}">`;
		btn.addEventListener('click', () => onSelect(iconData.type, iconData.value));
		container.appendChild(btn);
	});
}

/**
 * Fetch and display favicon with validation
 */
async function fetchAndDisplayFavicon(
	url: string,
	elements: FaviconElements,
	onSuccess: (favicon: string) => void,
): Promise<void> {
	const { section, img, status } = elements;

	// Reset state
	section.classList.add('_hidden');
	status.innerHTML = '';

	if (!url) return;

	try {
		const favicon = await fetchFavicon(url, 2000);
		if (favicon) {
			// Validate image actually loads
			const testImg = new Image();
			testImg.onload = () => {
				section.classList.remove('_hidden');
				img.src = favicon;
				onSuccess(favicon);
			};
			testImg.onerror = () => {
				section.classList.add('_hidden');
			};
			testImg.src = favicon;
		}
	} catch (e) {
		console.log('Favicon fetch failed:', e);
	}
}

/**
 * Select an icon in a form (unified for both add and edit forms)
 * @param {string} prefix - Element ID prefix ('' for add form, 'edit-' for edit form)
 * @param {string} type - Icon type: 'emoji', 'favicon', or generated type
 * @param {string} value - Icon value (emoji char or data URL)
 */
function selectIconInForm(prefix: string, type: string, value: string): void {
	const preview = document.getElementById(`${prefix}icon-preview`);
	const iconInput = document.getElementById(`${prefix}wallet-icon`);
	const iconTypeInput = document.getElementById(`${prefix}wallet-icon-type`);

	// Build selectors for this form
	const emojiSelector = `#${prefix}icon-emoji-grid .emoji-btn`;
	const generatedSelector = `#${prefix}generated-icons .icon-option`;
	const faviconSelector = `#${prefix}favicon-option`;

	// Clear all selections
	document
		.querySelectorAll(`${emojiSelector}, ${generatedSelector}, ${faviconSelector}`)
		.forEach((btn) => {
			btn.classList.remove('-selected');
		});

	if (!preview) {
		console.error(`selectIconInForm: Missing ${prefix}icon-preview`);
		return;
	}
	if (!(iconInput instanceof HTMLInputElement)) {
		console.error(`selectIconInForm: ${prefix}wallet-icon is not an input`);
		return;
	}

	// Update preview and inputs
	if (type === 'emoji') {
		preview.innerHTML = `<span style="font-size: 32px;">${value}</span>`;
		iconInput.value = value;
		if (iconTypeInput instanceof HTMLInputElement) iconTypeInput.value = 'emoji';

		const emojiBtn = document.querySelector(`${emojiSelector}[data-emoji="${CSS.escape(value)}"]`);
		if (emojiBtn) emojiBtn.classList.add('-selected');
	} else if (type === 'favicon') {
		preview.innerHTML = `<img src="${value}" alt="Wallet icon">`;
		iconInput.value = value;
		if (iconTypeInput instanceof HTMLInputElement) iconTypeInput.value = 'favicon';

		const faviconBtn = document.getElementById(`${prefix}favicon-option`);
		if (faviconBtn) faviconBtn.classList.add('-selected');
	} else {
		// Generated icons (identicon, initial, geometric)
		preview.innerHTML = `<img src="${value}" alt="Wallet icon">`;
		iconInput.value = value;
		if (iconTypeInput instanceof HTMLInputElement) iconTypeInput.value = type;

		const genBtn = document.querySelector(
			`${generatedSelector}[data-value="${CSS.escape(value)}"]`,
		);
		if (genBtn) genBtn.classList.add('-selected');
	}
}

// Convenience wrappers for backward compatibility
function selectIcon(type: string, value: string): void {
	selectIconInForm('', type, value);
}

function selectEditIcon(type: string, value: string): void {
	selectIconInForm('edit-', type, value);
}
