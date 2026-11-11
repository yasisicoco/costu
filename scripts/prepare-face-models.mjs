import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const source = new URL('../node_modules/@vladmandic/human/', import.meta.url);
const target = new URL('../public/face-models/', import.meta.url);
await mkdir(target, { recursive: true });
for (const name of ['blazeface.json', 'blazeface.bin', 'facemesh.json', 'facemesh.bin']) {
  await copyFile(fileURLToPath(new URL(`models/${name}`, source)), fileURLToPath(new URL(name, target)));
}
await copyFile(fileURLToPath(new URL('LICENSE', source)), fileURLToPath(new URL('HUMAN-LICENSE.txt', target)));
