import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const runtimeFiles = ["background.js", "content.js", "provider-page.js"];

function runtimeAssetsPlugin() {
  return {
    name: "ckb-wallet-runtime-assets",
    generateBundle() {
      for (const fileName of runtimeFiles) {
        this.emitFile({
          type: "asset",
          fileName,
          source: readFileSync(resolve(import.meta.dirname, "src", fileName), "utf8"),
        });
      }
    },
  };
}

export default defineConfig({
  root: resolve(import.meta.dirname, "src"),
  plugins: [runtimeAssetsPlugin()],
  publicDir: resolve(import.meta.dirname, "res"),
  worker: {
    format: "es",
  },
  build: {
    outDir: resolve(import.meta.dirname, "dist"),
    rollupOptions: {
      input: resolve(import.meta.dirname, "src", "popup.html"),
    },
  },
});
