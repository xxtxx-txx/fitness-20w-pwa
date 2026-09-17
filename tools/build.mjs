/** Copy only deployable assets: no build toolchain or network dependency. */
import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const name of ['index.html', 'app.js', 'program.js', 'date-engine.js', 'state.js', 'styles.css', 'manifest.webmanifest', 'sw.js', 'icons', '.nojekyll']) {
  await cp(path.join(root, name), path.join(out, name), { recursive: true });
}
console.log('Static deployment ready: dist/');
