import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
    build: {
        outDir: 'bdgame',
    },
    base: './',
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
                navigateFallback: '/index.html',
            },
            manifest: {
                name: '青山镇二零八八斗炁大会',
                short_name: '青山斗炁',
                description: 'Roguelite auto-battle game',
                theme_color: '#0a0a0f',
                background_color: '#0a0a0f',
                display: 'standalone',
                orientation: 'portrait',
                icons: [
                    { src: '/icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
                    { src: '/icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
                ],
            },
        }),
    ],
})
