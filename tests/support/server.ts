/**
 * Minimal test server for serving fixture pages during e2e tests.
 */

import { createServer, type Server } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

export interface TestServer {
	url: string;
	close: () => Promise<void>;
}

const MIME: Record<string, string> = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
};

function createHandler(root: string) {
	return (req: import('http').IncomingMessage, res: import('http').ServerResponse) => {
		const path = (req.url || '/').split('?')[0];
		const file = join(root, path === '/' ? 'index.html' : path);

		if (!existsSync(file) || statSync(file).isDirectory()) {
			res.writeHead(404);
			res.end('Not found');
			return;
		}

		res.setHeader('Content-Type', MIME[extname(file)] || 'application/octet-stream');
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.end(readFileSync(file));
	};
}

export function startTestServer(root: string): Promise<TestServer> {
	return new Promise((resolve, reject) => {
		const server: Server = createServer(createHandler(root));
		server.on('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const addr = server.address();
			if (!addr || typeof addr === 'string') {
				reject(new Error('Failed to get server address'));
				return;
			}
			resolve({
				url: `http://127.0.0.1:${addr.port}`,
				close: () => new Promise<void>((r) => server.close(() => r())),
			});
		});
	});
}

// CLI: run directly with `tsx tests/support/server.ts`
if (process.argv[1] && fileURLToPath(import.meta.url).includes(process.argv[1].replace(/\.ts$/, ''))) {
	const __dirname = dirname(fileURLToPath(import.meta.url));
	const root = join(__dirname, '../fixtures');
	const server = createServer(createHandler(root));
	server.listen(3456, '127.0.0.1', () => {
		console.log(`Serving ${root} at http://127.0.0.1:3456`);
	});
}
