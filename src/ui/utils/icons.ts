/**
 * Icon utilities for wallet icons
 * Handles favicon fetching, identicon generation, and initial avatars
 */

/**
 * Color palette for generated icons (brand-safe colors)
 */
const ICON_COLORS = [
	'#1C4587', // Primary blue
	'#19712f', // Green
	'#7c3aed', // Purple
	'#ea580c', // Orange
	'#0891b2', // Cyan
	'#be185d', // Pink
	'#4f46e5', // Indigo
	'#059669', // Emerald
	'#dc2626', // Red
	'#ca8a04', // Yellow
];

/**
 * Generate a deterministic hash from a string
 */
function hashString(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32bit integer
	}
	return Math.abs(hash);
}

/**
 * Get a color from the palette based on input string
 */
function getColorFromString(str: string): string {
	const hash = hashString(str);
	return ICON_COLORS[hash % ICON_COLORS.length];
}

/**
 * Generate an SVG identicon based on a string
 * Creates a unique pattern based on the hash of the input
 */
function generateIdenticon(input: string, size: number = 48): string {
	const hash = hashString(input);
	const color = getColorFromString(input);
	const bgColor = '#e8e9ea';

	// Create a 5x5 grid pattern (symmetric)
	const gridSize = 5;
	const cellSize = size / gridSize;
	const cells = [];

	for (let y = 0; y < gridSize; y++) {
		for (let x = 0; x < Math.ceil(gridSize / 2); x++) {
			// Use different bits of the hash for each cell
			const bitIndex = y * Math.ceil(gridSize / 2) + x;
			const isFilled = (hash >> bitIndex) & 1;

			if (isFilled) {
				// Add cell on the left side
				cells.push({ x: x * cellSize, y: y * cellSize });
				// Mirror on the right side (skip center column if gridSize is odd)
				if (x !== Math.floor(gridSize / 2)) {
					cells.push({ x: (gridSize - 1 - x) * cellSize, y: y * cellSize });
				}
			}
		}
	}

	const cellsHtml = cells
		.map(
			(cell) =>
				`<rect x="${cell.x}" y="${cell.y}" width="${cellSize}" height="${cellSize}" fill="${color}"/>`,
		)
		.join('');

	return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="${bgColor}" rx="8"/>
    ${cellsHtml}
  </svg>`;
}

/**
 * Generate an initial avatar (letter-based icon)
 */
function generateInitialAvatar(name: string, size: number = 48): string {
	const color = getColorFromString(name);

	// Extract initials (up to 2 characters)
	const words = name.trim().split(/\s+/);
	let initials: string;
	if (words.length >= 2) {
		initials = (words[0][0] + words[1][0]).toUpperCase();
	} else {
		initials = name.substring(0, 2).toUpperCase();
	}

	const fontSize = size * 0.4;

	return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="${color}" rx="8"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
          fill="white" font-family="Inter, sans-serif" font-weight="600" font-size="${fontSize}">
      ${initials}
    </text>
  </svg>`;
}

/**
 * Generate a geometric pattern icon
 */
function generateGeometricIcon(input: string, size: number = 48): string {
	const hash = hashString(`${input}geo`);
	const color = getColorFromString(`${input}geo`);
	const bgColor = '#e8e9ea';

	// Choose a pattern based on hash
	const patternType = hash % 4;
	let pattern = '';

	switch (patternType) {
		case 0: {
			// Concentric circles
			const numCircles = 3;
			for (let i = numCircles; i > 0; i--) {
				const r = (size / 2 - 4) * (i / numCircles);
				const opacity = 0.3 + (0.7 * (numCircles - i)) / numCircles;
				pattern += `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="${color}" fill-opacity="${opacity}"/>`;
			}
			break;
		}

		case 1: {
			// Diamond
			const mid = size / 2;
			const _offset = size / 3;
			pattern = `<polygon points="${mid},4 ${size - 4},${mid} ${mid},${size - 4} 4,${mid}" fill="${color}"/>`;
			break;
		}

		case 2: {
			// Stripes
			const stripeWidth = size / 6;
			for (let i = 0; i < 3; i++) {
				pattern += `<rect x="${4 + i * stripeWidth * 2}" y="8" width="${stripeWidth}" height="${size - 16}" fill="${color}" rx="2"/>`;
			}
			break;
		}

		case 3: {
			// Grid dots
			const dotSize = size / 10;
			const spacing = size / 4;
			for (let y = 1; y <= 3; y++) {
				for (let x = 1; x <= 3; x++) {
					pattern += `<circle cx="${x * spacing}" cy="${y * spacing}" r="${dotSize}" fill="${color}"/>`;
				}
			}
			break;
		}
	}

	return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="${bgColor}" rx="8"/>
    ${pattern}
  </svg>`;
}

/**
 * Try to fetch favicon from a URL
 */
async function fetchFavicon(url: string, timeout: number = 3000): Promise<string | null> {
	try {
		// Route through background script to avoid CORS issues
		const runtime = typeof browser !== 'undefined' ? browser.runtime : chrome.runtime;
		const result = await runtime.sendMessage({
			type: 'FETCH_FAVICON',
			url: url,
			timeout: timeout,
		});

		if (result?.success && result.dataUri) {
			return result.dataUri;
		}
		return null;
	} catch (e) {
		console.error('Error fetching favicon:', e);
		return null;
	}
}

export type IconOption = {
	type: string;
	value: string;
};

type WalletIconOptionsResult = {
	favicon: string | null;
	generated: IconOption[];
};

/**
 * Generate all icon options for a wallet
 * Returns generated icons immediately, favicon is fetched asynchronously
 */
async function generateWalletIconOptions(
	url: string,
	name: string,
): Promise<WalletIconOptionsResult> {
	const identifier = url || name || 'wallet';
	const walletName = name || 'Wallet';

	// Generate icons synchronously (these are fast)
	const identiconSvg = generateIdenticon(identifier);
	const initialSvg = generateInitialAvatar(walletName);
	const geometric1Svg = generateGeometricIcon(identifier);
	const geometric2Svg = generateGeometricIcon(`${identifier}2`);

	const result: WalletIconOptionsResult = {
		favicon: null,
		generated: [
			{ type: 'identicon', value: svgToDataUrl(identiconSvg) },
			{ type: 'initial', value: svgToDataUrl(initialSvg) },
			{ type: 'geometric-1', value: svgToDataUrl(geometric1Svg) },
			{ type: 'geometric-2', value: svgToDataUrl(geometric2Svg) },
		],
	};

	// Try to fetch favicon (with timeout)
	if (url) {
		try {
			result.favicon = await fetchFavicon(url, 2000);
		} catch (_e) {
			// Favicon fetch failed, that's okay
			result.favicon = null;
		}
	}

	return result;
}

/**
 * Convert SVG string to data URL
 */
function svgToDataUrl(svg: string): string {
	const encoded = encodeURIComponent(svg);
	return `data:image/svg+xml,${encoded}`;
}

/**
 * Check if a string is a data URL or external URL (not an emoji)
 */
function isIconUrl(icon: string): boolean {
	return !!(icon && (icon.startsWith('data:') || icon.startsWith('http')));
}

export {
	fetchFavicon,
	generateGeometricIcon,
	generateIdenticon,
	generateInitialAvatar,
	generateWalletIconOptions,
	getColorFromString,
	ICON_COLORS,
	isIconUrl,
	svgToDataUrl,
};
