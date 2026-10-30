import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

execSync('npx tsc -p packages/opengrid/tsconfig.build.json', { stdio: 'inherit' });

const workerEntry = resolve(root, 'packages/opengrid/src/worker.ts');
const indexEntry = resolve(root, 'packages/opengrid/src/index.ts');

await esbuild.build({
  absWorkingDir: root,
  entryPoints: [workerEntry],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  outfile: resolve(root, 'packages/opengrid/dist/worker.js'),
});

await esbuild.build({
  absWorkingDir: root,
  entryPoints: [indexEntry],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  outfile: resolve(root, 'packages/opengrid/dist/index.js'),
  plugins: [
    {
      name: 'worker-url',
      setup(build) {
        build.onLoad({ filter: /engine-client\.ts$/ }, () => {
          const contents = readFileSync('packages/opengrid/src/engine-client.ts', 'utf8').replaceAll(
            "new URL('./worker.ts', import.meta.url)",
            "new URL('./worker.js', import.meta.url)",
          );
          return { contents, loader: 'ts' };
        });
      },
    },
  ],
});

const entry = readFileSync('packages/opengrid/dist/index.js', 'utf8');
if (!entry.includes('new URL("./worker.js", import.meta.url)')) {
  throw new Error('built entry does not point at worker.js');
}
readFileSync('packages/opengrid/dist/worker.js');
readFileSync('packages/opengrid/dist/index.d.ts');
