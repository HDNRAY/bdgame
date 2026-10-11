import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { cpSync, existsSync } from 'node:fs'
import path from 'node:path'
import { UMAMI_BEFORE_SEND_HOOK } from './src/bridge/analytics-before-send'
import { fontSubsetPlugin } from './vite-plugins/font-subset'
import type { Plugin } from 'vite'

/**
 * Umami 埋点注入（计划 `docs/analytics-plan.md` 第 1 节）。
 *
 * - `apply: 'build'`：dev server 完全不注入，开发时连标签都没有。
 * - 不用 `index.html` 里的 `%VITE_*%`：那套语法无条件替换，没配 id 时会留下
 *   `data-website-id=""` 的坏标签，脚本照样去网络上拉。
 * - `data-domains` 是第二道闸：hostname 不匹配时 tracker 根本不初始化，
 *   所以 `npm run preview`（localhost）即使跑的是构建产物也不发数据。
 * - before-send 钩子必须排在 tracker 之前（同一段注入里内联脚本在前，顺序天然满足）。
 */
function umamiPlugin(env: Record<string, string>): Plugin {
    return {
        name: 'umami-analytics',
        apply: 'build',
        transformIndexHtml(html) {
            const id = env.VITE_UMAMI_WEBSITE_ID
            if (!id) return html
            const src = env.VITE_UMAMI_SCRIPT_SRC || 'https://cloud.umami.is/script.js'
            const domains = env.VITE_UMAMI_DOMAINS || 'hdnray.github.io'
            return {
                html,
                tags: [
                    {
                        tag: 'script',
                        children: UMAMI_BEFORE_SEND_HOOK,
                        injectTo: 'body',
                    },
                    {
                        tag: 'script',
                        attrs: {
                            async: true,
                            src,
                            'data-website-id': id,
                            'data-domains': domains,
                            'data-before-send': '__umamiBeforeSend',
                        },
                        injectTo: 'body',
                    },
                ],
            }
        },
    }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
    // .env.production 是已跟踪文件；website-id 是公开值，不是密钥
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    return {
        // dev（serve）无前缀；线上 build 带 /bdgame/ 前缀（GitHub Pages 子路径）
        base: command === 'serve' ? '/' : '/bdgame/',
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
        plugins: [
            react(),
            VitePWA({
                registerType: 'autoUpdate',
                workbox: {
                    // woff2 必须进 precache：字体是首屏启动门（src/ui/boot/font-gate.ts）的等待对象，
                    // 只靠浏览器 HTTP 缓存的话，离线冷启动 / 缓存被挤掉时会退化成系统字体。
                    // 子集化之后四个字面合计 250 kB（全集 2.03 MB），代价可以接受。
                    globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
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
            {
                // GitHub Pages 对未知路径回退到 404.html：把 index.html 复制一份，让 React Router 接管深链路由
                name: 'gh-pages-404-fallback',
                apply: 'build',
                closeBundle() {
                    const outDir = path.join(process.cwd(), 'bdgame')
                    const index = path.join(outDir, 'index.html')
                    // 构建中途失败时产物目录是空的：这里必须让真正的报错浮上来，
                    // 不然 cpSync 的 ENOENT 会把上游插件（例如字体子集校验）的失败原因盖掉
                    if (!existsSync(index)) return
                    cpSync(index, path.join(outDir, '404.html'))
                },
            },
            umamiPlugin(env),
            // 构建期字体子集化：字符集取自**产物文本**，零手动步骤（见该插件头部注释）
            fontSubsetPlugin(),
        ],
    }
})
