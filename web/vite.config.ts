/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { codeInspectorPlugin } from "code-inspector-plugin";
import { resolve } from "path";
import { defineConfig } from "vite";

// let devProxyServer = "https://memo.chriscurry.cc";
let devProxyServer = "http://localhost:8081";
if (process.env.DEV_PROXY_SERVER && process.env.DEV_PROXY_SERVER.length > 0) {
  console.log("Use devProxyServer from environment: ", process.env.DEV_PROXY_SERVER);
  devProxyServer = process.env.DEV_PROXY_SERVER;
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // code-inspector keeps a server alive and blocks vitest from exiting.
    !process.env.VITEST &&
      codeInspectorPlugin({
        bundler: "vite",
      }),
  ],
  server: {
    host: "0.0.0.0",
    port: 3001,
    proxy: {
      "^/api": {
        target: devProxyServer,
        xfwd: true,
        changeOrigin: true,
        cookieDomainRewrite: "localhost",
      },
      "^/memos.api.v1": {
        target: devProxyServer,
        xfwd: true,
        changeOrigin: true,
        cookieDomainRewrite: "localhost",
      },
      "^/file": {
        target: devProxyServer,
        xfwd: true,
        changeOrigin: true,
        cookieDomainRewrite: "localhost",
      },
    },
  },
  resolve: {
    alias: {
      "@/": `${resolve(__dirname, "src")}/`,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "app.[hash].js",
        chunkFileNames: "assets/chunk-vendors.[hash].js",
        assetFileNames: "assets/[name].[hash][extname]",
      },
    },
  },
});
