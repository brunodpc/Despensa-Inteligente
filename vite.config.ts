import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Builds nativos (Capacitor) usam '/'. O deploy da PWA em GitHub Pages usa BASE_PATH.
const base = process.env.BASE_PATH || '/'
const assetUrl = (path: string) => `${base.replace(/\/$/, '')}/${path}`

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/brand.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Despensa Inteligente',
        short_name: 'Despensa',
        description: 'Controle compartilhado da despensa e das compras da casa.',
        theme_color: '#203c32',
        background_color: '#f7f7f2',
        display: 'standalone',
        orientation: 'portrait-primary',
        lang: 'pt-BR',
        icons: [
          { src: assetUrl('icons/icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: assetUrl('icons/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//],
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}']
      },
      devOptions: { enabled: false }
    })
  ],
  server: { host: '0.0.0.0', port: 5173 }
})
