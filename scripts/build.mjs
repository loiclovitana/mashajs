import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = new URL('../dist/', import.meta.url);

// Fail clearly if a checkout contains LFS pointers instead of the actual artwork.
for (const name of ['opale', 'masha']) {
  const file = new URL(`../lib/assets/${name}.webp`, import.meta.url);
  const bytes = await readFile(file);
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error(`${name}.webp is not a WebP image. Run git lfs pull before building.`);
  }
}

await rm(dist, { recursive: true, force: true });
const compile = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc'], {
  cwd: root,
  stdio: 'inherit',
});
if (compile.error) throw compile.error;
if (compile.status !== 0) process.exit(compile.status ?? 1);

await mkdir(new URL('preview/', dist), { recursive: true });
for (const path of [
  'index.html',
  '.nojekyll',
  'LICENSE',
  'preview/index.html',
  'preview/preview.css',
  'lib/assets',
]) {
  await cp(new URL(`../${path}`, import.meta.url), new URL(path, dist), { recursive: true });
}
console.log('Built dist/: standalone library, declarations, artwork, and preview.');
