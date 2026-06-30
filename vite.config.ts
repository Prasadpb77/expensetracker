import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'FamilyFinance',
        short_name: 'FamilyFinance',
        description: 'Personal expense management for couples',
        start_url: '/expensetracker/',
        scope: '/expensetracker/',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        orientation: 'portrait-primary',
        background_color: '#0f172a',
        theme_color: '#0284c7',
        categories: ['finance', 'productivity'],
        icons: [
          { src: '/expensetracker/icons/icon-72.png', sizes: '72x72', type: 'image/png', purpose: 'any' },
          { src: '/expensetracker/icons/icon-96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
          { src: '/expensetracker/icons/icon-128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
          { src: '/expensetracker/icons/icon-144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
          { src: '/expensetracker/icons/icon-152.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
          { src: '/expensetracker/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/expensetracker/icons/icon-384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
          { src: '/expensetracker/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            urlPattern: /\.(?:js|css)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-resources-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              }
            }
          },
          {
            urlPattern: /\/expensetracker\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-shell-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              },
              networkTimeoutSeconds: 3
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5 // 5 minutes
              },
              networkTimeoutSeconds: 3,
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ],
        navigateFallback: '/expensetracker/',
        cleanupOutdatedCaches: true,
        sourceMap: false
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  base: '/expensetracker/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
