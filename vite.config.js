import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png', 'screenshots/*.png'],
      // The manifest is hand-written in public/manifest.json.
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json}'],
        // The push handlers keep living in their own file and are pulled into
        // the generated worker, so a single worker owns the scope and does both
        // jobs. Registering two workers on "/" would have them fight over it.
        importScripts: ['/sw-push.js'],
        // Every path is a client route except the worker itself.
        navigateFallbackDenylist: [/^\/sw-push\.js$/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Answers go stale fast, so this is a short grace period for a
            // flaky connection rather than a real cache.
            urlPattern: /^https:\/\/api\.groq\.com/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'groq-api',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 },
            },
          },
        ],
      },
      devOptions: { enabled: true },
    }),
  ],
})
