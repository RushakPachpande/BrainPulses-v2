import fs from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { parseByteSize } from './src/lib/byte-size.ts';

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

const MB = 1024 * 1024;

/** Fail the Vite build when a cap is set to something other than a size like 10MB. */
function readByteCap(raw: string | undefined, name: string, fallback: number) {
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = parseByteSize(raw);
  if (parsed === null) {
    throw new Error(`${name} must be a size like 10MB.`);
  }
  return parsed;
}

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:3002';

/**
 * Hosts the dev server may answer, on top of Vite's localhost and IP defaults.
 * Unset allows `*.trycloudflare.com` (Cloudflare quick tunnels).
 * A set value is the full list you choose (comma-separated). A leading `.` allows that name and its subdomains.
 * `*` allows every host. `none` keeps only Vite's defaults.
 */
function devAllowedHosts(raw: string | undefined): true | string[] {
  const value = raw?.trim() ?? '';
  if (value === '') return ['.trycloudflare.com'];
  if (value === '*') return true;
  if (value === 'none') return [];
  return value
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);
}

const apiProxy = {
  '/api': {
    target: apiProxyTarget,
    changeOrigin: true,
  },
} as const;

export default defineConfig(({ command, mode }) => {
  const fileEnv = loadEnv(mode, import.meta.dirname, '');
  const uploadImageSizeCapping = readByteCap(
    fileEnv.UPLOAD_IMAGE_SIZE_CAPPING || process.env.UPLOAD_IMAGE_SIZE_CAPPING,
    'UPLOAD_IMAGE_SIZE_CAPPING',
    10 * MB,
  );
  const qaUploadImageSizeCapping = readByteCap(
    fileEnv.QA_UPLOAD_IMAGE_SIZE_CAPPING || process.env.QA_UPLOAD_IMAGE_SIZE_CAPPING,
    'QA_UPLOAD_IMAGE_SIZE_CAPPING',
    5 * MB,
  );
  const singleFile = command === 'build' && mode === 'singlefile';
  const allowedHosts = devAllowedHosts(process.env.DEV_ALLOWED_HOSTS || fileEnv.DEV_ALLOWED_HOSTS);

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(singleFile ? [viteSingleFile()] : [emptyDistKeepSingle()]),
    ],
    envPrefix: ['VITE_', 'UPLOAD_IMAGE_SIZE_CAPPING', 'QA_UPLOAD_IMAGE_SIZE_CAPPING'],
    define: {
      'import.meta.env.UPLOAD_IMAGE_SIZE_CAPPING': JSON.stringify(String(uploadImageSizeCapping)),
      'import.meta.env.QA_UPLOAD_IMAGE_SIZE_CAPPING': JSON.stringify(
        String(qaUploadImageSizeCapping),
      ),
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      open: false,
      allowedHosts,
      proxy: { ...apiProxy },
    },
    preview: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      allowedHosts,
      proxy: { ...apiProxy },
    },

    build: {
      outDir: singleFile ? 'dist/single' : 'dist',
      emptyOutDir: singleFile,
      sourcemap: false,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
              { name: 'router', test: /node_modules[\\/]react-router[\\/]/ },
              { name: 'query', test: /node_modules[\\/]@tanstack[\\/]/ },
            ],
          },
        },
      },
    },
  };
});
