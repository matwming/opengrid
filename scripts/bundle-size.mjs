import esbuild from 'esbuild';
import { gzipSync } from 'node:zlib';

const opengrid = await esbuild.build({
  entryPoints: ['packages/opengrid/src/index.ts'],
  bundle: true,
  minify: true,
  format: 'esm',
  write: false,
  platform: 'browser',
});
const ag = await esbuild.build({
  entryPoints: ['bench/ag-entry.ts'],
  bundle: true,
  minify: true,
  format: 'esm',
  write: false,
  platform: 'browser',
});
const opengridFile = opengrid.outputFiles[0];
const agFile = ag.outputFiles[0];
if (!opengridFile || !agFile) throw new Error('bundle output missing');
process.stdout.write(JSON.stringify({
  opengridGzip: gzipSync(opengridFile.contents).length,
  agGridGzip: gzipSync(agFile.contents).length,
  opengridRaw: opengridFile.contents.length,
  agGridRaw: agFile.contents.length,
}));
