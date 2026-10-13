import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3001,
    host: "localhost",
    open: false,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
