import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export default defineConfig({
  plugins: [react(), {
    name: 'costu-offline',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = ['/', '/icon.svg', '/manifest.webmanifest', ...Object.entries(bundle).filter(([, output]) => output.type !== 'chunk' || !output.moduleIds.some(id => id.includes('@vladmandic/human'))).map(([file]) => `/${file}`)];
      const version = createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 12);
      const source = readFileSync('src/sw.template.js', 'utf8').replace('__CACHE_NAME__', `costu-${version}`).replace('__PRECACHE__', JSON.stringify(files));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  }],
  server: { port: 5173, strictPort: true, headers: { 'Permissions-Policy': 'camera=(self), microphone=()' }, proxy: { '/socket.io': { target: 'http://127.0.0.1:3001', ws: true }, '/api': 'http://127.0.0.1:3001' } },
});
