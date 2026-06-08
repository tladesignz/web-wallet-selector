import { resolve } from 'node:path';

export type ManifestProps = {
	/**
	 * Helper that returns the output path of a bundled file based on its source file declared in the manifest.
	 */
	entry: (format: 'iife' | 'es', file: string) => string;
	/**
	 * Helper that generates all required icons from a single source file.
	 */
	icons: (file: string) => chrome.runtime.ManifestIcons;
}

export type CreateBrowserManifest = (props: ManifestProps) => chrome.runtime.ManifestV3 | chrome.runtime.ManifestV2;

export type ManifestFile = {
	name: string;
	source: string;
	output?: string;
	format: 'iife' | 'es';
}

export type ManifestIcons = ManifestFile & {
	icons?: chrome.runtime.ManifestIcons;
}

export type ManifestFiles = {
	entries: Map<string, ManifestFile>;
	icons: Map<string, ManifestIcons>;
};

export type CollectedInput = {
	source: string;
	format: 'iife' | 'es';
}

export class BrowserManifest {
	#projectRoot?: string;

	#manifestFiles: ManifestFiles= {
		entries: new Map(),
		icons: new Map(),
	};

	#createManifest: CreateBrowserManifest;

	get projectRoot() {
		if (!this.#projectRoot) {
			throw new Error('projectRoot is not set. Please call setProjectRoot()');
		}

		return this.#projectRoot;
	}

	constructor(manifest: CreateBrowserManifest) {
		this.#createManifest = manifest;
	}

	public setProjectRoot(dir: string) {
		if (!resolve(dir).startsWith(resolve(process.cwd()))) {
			throw new Error(`Invalid projectRoot "${dir}". It must be an absolute path within the project directory.`);
		}

		this.#projectRoot = dir;
	}

	public collectSourceFiles() {
		this.#createManifest({
			entry: (format, file) => {
				this.#manifestFiles.entries.set(file, {
					name: this.#formatEntryName(file),
					source: resolve(this.projectRoot, file),
					format,
				});

				return file;
			},
			icons: (file) => {
				this.#manifestFiles.icons.set(file, {
					name: this.#formatEntryName(file),
					source: resolve(this.projectRoot, file),
					format: 'iife',
				});
				return {};
			},
		});

		return this.#manifestFiles;
	}

	public getCollectedEntries(): Map<string, ManifestFile> {
		return this.#manifestFiles.entries
	}
	public getCollectedIcons(): Map<string, ManifestFile> {
		return this.#manifestFiles.icons
	}

	public getCollectedEntryInputs(): Record<string, CollectedInput> {
		return this.#getCollectedInputs('entries');
	}

	public getCollectedIconInputs(): Record<string, CollectedInput> {
		return this.#getCollectedInputs('icons');
	}

	public collectEntryOutputFile(key: string, value: string) {
		const existingEntry = this.#manifestFiles.entries.get(key);
		if (!existingEntry) {
			throw new Error(`Collected bundled file "${key}" for manifest entry was not declared in the manifest.`);
		}

		if (existingEntry.output) {
			console.warn(`Warning: File "${key}" for manifest entry was already collected. Overwriting with "${value}".`);
		}

		this.#manifestFiles.entries.set(key, {
			...existingEntry,
			output: value,
		})
	}

	public collectIconOutputFiles(key: string, icons: chrome.runtime.ManifestIcons) {
		const existingIcons = this.#manifestFiles.icons.get(key);
		if (!existingIcons) {
			throw new Error(`Collected bundled file "${key}" for manifest icon was not declared in the manifest.`);
		}

		if (existingIcons.icons) {
			console.warn(`Warning: File "${key}" for manifest icon was already collected. Overwriting with "${icons}".`);
		}

		this.#manifestFiles.icons.set(key, {
			...existingIcons,
			icons,
		});
	}

	public generateManifest(): chrome.runtime.ManifestV3 | chrome.runtime.ManifestV2 {
		const manifestProps: ManifestProps = {
			entry: (_format, file) => {
				const entry = this.#manifestFiles.entries.get(file);
				if (!entry?.output) {
					throw new Error(`Error: File "${file}" was declared in the manifest but not collected as a bundled file.`);
				}
				return entry.output;
			},
			icons: (file) => {
				const icons = this.#manifestFiles.icons.get(file);
				if (!icons?.icons) {
					throw new Error(`Error: File "${file}" was declared in the manifest but not collected as bundled icons.`);
				}
				return icons.icons;
			},
		};

		return this.#createManifest(manifestProps);
	}

	public getEntryMap(): Record<string, string> {
		const map: Record<string, string> = {};
		for (const [key, entry] of this.#manifestFiles.entries) {
			if (entry.output) {
				map[key] = entry.output;
			}
		}
		return map;
	}

	#formatEntryName(name: string): string {
		const output = name.replace(/^src\//, '').replace(/\.[^/.]+$/, '').replaceAll('/index', '').split('/').pop();
		if (!output) throw new Error('Failed to format entry file name: ' + name);

		return output;
	}

	#getCollectedInputs(type: keyof ManifestFiles): Record<string, CollectedInput> {
		const output: Record<string, CollectedInput> = {};

		for (const entry of this.#manifestFiles[type].values()) {
			output[entry.name] = {
				source: entry.source,
				format: entry.format,
			};
		}

		return output;
	}
}
