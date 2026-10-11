/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { codeInspectorPlugin } from "code-inspector-plugin";
import { resolve } from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

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
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      manifestFilename: "manifest.webmanifest",
      includeAssets: ["logo.webp", "apple-touch-icon.png"],
      manifest: {
        id: "/",
        start_url: "/",
        scope: "/",
        name: "Memos",
        short_name: "Memos",
        description: "A privacy-first, lightweight note-taking service. Capture your thoughts quickly.",
        display: "standalone",
        background_color: "#f4f4f5",
        theme_color: "#f4f4f5",
        icons: [
          { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/maskable-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,webp,png,svg,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        navigateFallback: "/index.html",
        // Network-only: API, gRPC-web, resource files, RSS and server-rendered routes.
        navigateFallbackDenylist: [/^\/api\//, /^\/memos\.api\.v1\./, /^\/file\//, /rss\.xml$/, /^\/healthz/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/api/") ||
              url.pathname.startsWith("/memos.api.v1.") ||
              url.pathname.startsWith("/file/") ||
              url.pathname.endsWith("rss.xml") ||
              url.pathname.startsWith("/healthz"),
            handler: "NetworkOnly",
          },
        ],
      },
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
