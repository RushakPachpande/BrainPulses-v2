import fs from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

function emptyDistKeepSingle(): Plugin {
  return {
    name: 'empty-dist-keep-single',
    apply: 'build',
    buildStart() {
      const dist = path.resolve(import.meta.dirname, 'dist');
      if (!fs.existsSync(dist)) return;
      for (const entry of fs.readdirSync(dist)) {
        if (entry === 'single') continue;
        fs.rmSync(path.join(dist, entry), { recursive: true, force: true });
      }
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const singleFile = command === 'build' && mode === 'singlefile';

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(singleFile ? [viteSingleFile()] : [emptyDistKeepSingle()]),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      host: '0.0.0.0',
      open: false,
    },
    build: {
      outDir: singleFile ? 'dist/single' : 'dist',
      emptyOutDir: singleFile,
      sourcemap: false,
    },
  };
});
