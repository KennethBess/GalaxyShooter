import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "../../packages/shared/src")
    }
  },
  server: {
    port: 5173
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        controller: resolve(__dirname, "controller.html")
      },
      output: {
        manualChunks: {
          phaser: ["phaser"]
        }
      }
    }
  }
});
