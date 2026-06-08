import { InlineConfig, build as viteBuild } from 'vite';
import { readFileSync, watch } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { CHROME_MANIFEST, FIREFOX_MANIFEST, SAFARI_MANIFEST } from './manifests';
import { type BrowserManifest } from './manifests/resources';
import { readdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';

process.env.VITE_APP_VERSION = process.env.npm_package_version ?? '0.0.0';

const __dirname = dirname(fileURLToPath(import.meta.url));

type Browser = 'chrome' | 'firefox' | 'safari';

const browser = (process.env.BROWSER ?? 'chrome') as Browser;
const srcDir = resolve(__dirname, 'src');
const outDir = resolve(__dirname, 'dist', browser);

(async () => {

	let emptyOutDir = true;

	const browserManifest = (() => {
		switch (browser) {
			case 'chrome':
				return CHROME_MANIFEST;
			case 'firefox':
				return FIREFOX_MANIFEST;
			case 'safari':
				return SAFARI_MANIFEST;
			default:
				throw new Error(`Unsupported browser: ${browser}`);
		}
	})();

	browserManifest.setProjectRoot(resolve(__dirname));
	browserManifest.collectSourceFiles();

	await build({ browserManifest, emptyOutDir });

	if (process.env.WATCH) {
		watcher(['src', 'manifests'], async () => {
			browserManifest.collectSourceFiles();
			await build({ browserManifest, emptyOutDir });
		});
	}
})();

type BuildOptions = {
	emptyOutDir?: boolean;
	browserManifest: BrowserManifest;
}

/**
 * Build the extension for the specified browser, using the provided manifest definition.
 */
async function build({
	emptyOutDir,
	browserManifest,
}: BuildOptions) {
	const cfg = (
		input: Record<string, string>,
		format: 'iife' | 'es',
	): InlineConfig => ({
		configFile: false,
		root: srcDir,
		base: './',
		define: {
			'process.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
			'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
			'import.meta.env.VITE_LOG_LEVEL': JSON.stringify(process.env.LOG_LEVEL),
		},
		build: {
			outDir,
			emptyOutDir,
			target: 'esnext',
			minify: true,
			sourcemap: true,
			rollupOptions: {
				input,
				output: {
					format,
					entryFileNames: '[name]--[hash].js',
					chunkFileNames: '[name]--[hash].js',
					assetFileNames: '[name]--[hash].[ext]',
					codeSplitting: format !== 'iife',
				},
			},
		},
		plugins: [{
			name: 'post-build',
			async generateBundle(_, bundle) {
				const iconSizes = [16, 32, 48, 128];

				const projectPrefix = resolve(__dirname) + '/';

				for (const [fileName, chunk] of Object.entries(bundle)) {
					if (chunk.type === 'chunk' && chunk.facadeModuleId?.startsWith(projectPrefix)) {
						const relSource = chunk.facadeModuleId.slice(projectPrefix.length);
						if (!relSource.endsWith('.html')) {
							browserManifest.collectEntryOutputFile(relSource, fileName);
						}
					}
				}

				for (const [key, entry] of browserManifest.getCollectedEntries()) {
					if (entry.source.endsWith('.html')) {
						const htmlPath = entry.source
							.slice((projectPrefix + 'src/').length)
							.split('/')
							.pop();

						if (!htmlPath) throw new Error('Failed to get html path');

						browserManifest.collectEntryOutputFile(key, htmlPath);
					}
				}

				for (const [key, icons] of browserManifest.getCollectedIcons()) {
					const generated = await generateIcons(__dirname, icons.source, iconSizes, this);
					browserManifest.collectIconOutputFiles(key, generated);
				}
			},
			async closeBundle() {
				const files = await readdir(outDir, { withFileTypes: true, recursive: true });
				for (const f of files) {
					if (!f.isFile() || !f.name.endsWith('.html')) continue;

					const src = resolve(f.parentPath, f.name);

					if (dirname(src) === outDir) continue;

					const depth = relative(outDir, src).split('/').length - 1;
        			const prefix = '../'.repeat(depth);
					const html = (await readFile(src, 'utf-8'))
        				.replaceAll(`"${prefix}`, '"./')
        				.replaceAll(`'${prefix}`, "'./");

					await writeFile(resolve(outDir, f.name), html);

					await unlink(src);

					const dir = dirname(src);
					const remaining = await readdir(dir);
					if (remaining.length === 0) {
						await rm(dir, { recursive: true });
					}
				}
			},
		}],
    });

	const allEntries = Object.entries(browserManifest.getCollectedEntryInputs());

	const esInput = Object.fromEntries(
		allEntries
			.filter(([, { format }]) => format !== 'iife')
			.map(([name, { source }]) => [name, source]),
	);

	const iifeBuildInputs = allEntries
		.filter(([, { format }]) => format === 'iife')
		.map(([name, { source }]) => ({ input: { [name]: source }, format: 'iife' as const }));

	const builds = [
		...(Object.keys(esInput).length > 0 ? [{ input: esInput, format: 'es' as const }] : []),
		...iifeBuildInputs,
	];

	for (const { input, format } of builds) {
		await viteBuild(cfg(input, format));

		if (emptyOutDir) {
			emptyOutDir = false;
		}
	}

	const manifest = browserManifest.generateManifest();
	const manifestWithAssets = {
		...manifest,
		__meta: {
			entries: browserManifest.getEntryMap(),
		}
	};
	await writeFile(resolve(outDir, 'manifest.json'), JSON.stringify(manifestWithAssets, null, 2));
}

/**
 * Watch the src/ and manifests/ directories for changes, and trigger a rebuild when they change.
 */
function watcher(target: string | string[], action: () => Promise<void>) {
  let timer: NodeJS.Timeout | undefined;

  const rerun = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        console.log('[multi-watch] rebuilding…');
        await action();
        console.log('[multi-watch] done');
      } catch (e) {
        console.error('[multi-watch] build failed', e);
      }
    }, 100);
  };

  if (typeof target === 'string') {
	target = [target];
  }

  for (const t of target) {
	watch(resolve(__dirname, t), { recursive: true }, rerun);
  }

  console.log('[multi-watch] watching for changes…');
}

/**
 * Generate PNG icons at standard sizes from an SVG source, emitting them as hashed assets.
 */
async function generateIcons(
	projectRoot: string,
	srcPath: string,
	sizes: readonly number[],
	ctx: { emitFile: (file: { type: 'asset'; name: string; source: Uint8Array }) => string; getFileName: (refId: string) => string },
): Promise<chrome.runtime.ManifestIcons> {
	const svgBuffer = readFileSync(resolve(projectRoot, srcPath));
	const sizeRefs = new Map<number, string>();

	for (const size of sizes) {
		const png = await sharp(svgBuffer)
			.resize(size, size)
			.png()
			.toBuffer();

		const refId = ctx.emitFile({
			type: 'asset',
			name: `icon-${size}.png`,
			source: png,
		});
		sizeRefs.set(size, refId);
	}

	return Object.fromEntries(
		sizes.map((size) => [String(size), ctx.getFileName(sizeRefs.get(size)!)]),
	);
}
