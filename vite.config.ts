import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
    build: {
        outDir: 'bdgame',
        chunkSizeWarningLimit: 600, // 拆分后按需放宽警告线
        rollupOptions: {
            output: {
                // React 核心独立成稳定 chunk，配合 PWA 长期缓存，避免每次发布全量重下
                manualChunks(id) {
                    if (
                        id.includes('node_modules/react/') ||
                        id.includes('node_modules/react-dom/') ||
                        id.includes('node_modules/scheduler/')
                    ) {
                        return 'vendor-react'
                    }
                },
            },
        },
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
