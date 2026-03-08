import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "../../packages/shared/src")
    }
  },
  server: {
    port: 5173
  }
});
