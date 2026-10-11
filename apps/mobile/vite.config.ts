import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import pkg from './package.json' with { type: 'json' };
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  plugins: [react()],
  resolve: { alias: [
    { find: /^\.\.\/auth\/client$/, replacement: resolve(root, 'src/synthetic-client.ts') },
    { find: './auth/AuthBoundary', replacement: resolve(root, 'src/prototype-account.tsx') },
    ...Object.keys(pkg.dependencies).map(name => ({ find: name, replacement: resolve(root, 'node_modules', name) })),
  ] },
});
