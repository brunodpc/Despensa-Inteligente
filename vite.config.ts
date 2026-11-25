import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
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
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
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
