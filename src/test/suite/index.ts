import * as path from 'path';

// Use require to avoid TypeScript ESM-interop issues with mocha and glob under strict mode
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Mocha = require('mocha');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const glob = require('glob');

export function run(): Promise<void> {
	const mocha = new Mocha({ ui: 'tdd', color: true });
	const testsRoot = path.resolve(__dirname, '..');

	return new Promise((resolve, reject) => {
		// Only pick up suite/** tests — unit tests run outside of VS Code
		glob('suite/**.test.js', { cwd: testsRoot }, (err: Error | null, files: string[]) => {
			if (err) {
				return reject(err);
			}

			files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

			try {
				mocha.run((failures: number) => {
					if (failures > 0) {
						reject(new Error(`${failures} tests failed.`));
					} else {
						resolve();
					}
				});
			} catch (err) {
				console.error(err);
				reject(err);
			}
		});
	});
}
