import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  publicDir: "res",
  worker: {
    format: "es",
  },
  build: {
    rollupOptions: {
      input: resolve(import.meta.dirname, "popup.html"),
    },
  },
});
