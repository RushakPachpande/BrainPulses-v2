import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

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
  '/api': { target: apiProxyTarget, changeOrigin: true },
  '/health': { target: apiProxyTarget, changeOrigin: true },
} as const;

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, import.meta.dirname, '');
  const allowedHosts = devAllowedHosts(process.env.DEV_ALLOWED_HOSTS || fileEnv.DEV_ALLOWED_HOSTS);

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      port: 5174,
      strictPort: true,
      allowedHosts,
      proxy: { ...apiProxy },
    },
    preview: {
      host: '0.0.0.0',
      port: 5174,
      strictPort: true,
      allowedHosts,
      proxy: { ...apiProxy },
    },
    build: {
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
