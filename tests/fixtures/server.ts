/**
 * Test server for manual testing and E2E tests
 *
 * Usage:
 *   Standalone: pnpm test:server
 *   Programmatic: import { startTestServer } from './server'
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'http';
import { readFile, stat } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const FIXTURES_DIR = join(__dirname);

const MIME_TYPES: Record<string, string> = {
	'.html': 'text/html',
	'.js': 'application/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
};


function createRequestHandler() {
	return async function handleRequest(req: IncomingMessage, res: ServerResponse) {
		const url = new URL(req.url || '/', 'http://localhost');
		let urlPath = url.pathname;

		// Short routes
		if (urlPath === '/wallet') {
			urlPath = '/mock-wallet.html';
		} else if (urlPath === '/verifier') {
			urlPath = '/mock-verifier.html';
		}

		// Default to index.html for root
		if (urlPath === '/') {
			urlPath = '/index.html';
		}

		// All paths served from fixtures dir
		const fullPath = join(FIXTURES_DIR, urlPath);

		try {
			const stats = await stat(fullPath);

			if (stats.isDirectory()) {
				const indexPath = join(fullPath, 'index.html');
				try {
					const content = await readFile(indexPath);
					res.writeHead(200, { 'Content-Type': 'text/html' });
					res.end(content);
					return;
				} catch {
					res.writeHead(404);
					res.end('Not Found');
					return;
				}
			}

			const ext = extname(fullPath);
			const contentType = MIME_TYPES[ext] || 'application/octet-stream';
			const content = await readFile(fullPath);

			res.writeHead(200, { 'Content-Type': contentType });
			res.end(content);
		} catch {
			res.writeHead(404);
			res.end('Not Found');
		}
	};
}

export interface TestServer {
	url: string;
	port: number;
	close: () => Promise<void>;
}

/**
 * Start test server programmatically (for E2E tests)
 */
export function startTestServer(port = 0): Promise<TestServer> {
	return new Promise((resolve, reject) => {
		const server: Server = createServer(createRequestHandler());

		server.on('error', reject);

		server.listen(port, 'localhost', () => {
			const address = server.address();
			if (typeof address === 'object' && address !== null) {
				const actualPort = address.port;
				resolve({
					url: `http://localhost:${actualPort}`,
					port: actualPort,
					close: () => new Promise<void>((res) => server.close(() => res())),
				});
			} else {
				reject(new Error('Failed to get server address'));
			}
		});
	});
}

/**
 * Run as standalone server
 */
async function main() {
	const port = process.env.PORT ? parseInt(process.env.PORT) : 3456;
	const server = await startTestServer(port);

	console.log('');
	console.log('Wallet Companion Test Server');
	console.log('============================');
	console.log('');
	console.log(`  Local:   ${server.url}`);
	console.log('');
	console.log('  Test Pages:');
	console.log(`    - Wallet:    ${server.url}/wallet`);
	console.log(`    - Verifier:  ${server.url}/verifier`);
	console.log('');
	console.log('  Press Ctrl+C to stop');
	console.log('');

	process.on('SIGINT', async () => {
		console.log('\nShutting down...');
		await server.close();
		process.exit(0);
	});
}

// Run standalone if executed directly
const isMain = process.argv[1]?.includes('server.ts') || process.argv[1]?.includes('server.js');
if (isMain) {
	main().catch(console.error);
}
