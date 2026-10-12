import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { cpSync, existsSync } from 'node:fs'
import path from 'node:path'
import { UMAMI_BEFORE_SEND_HOOK } from './src/bridge/analytics-before-send'
import { fontSubsetPlugin } from './vite-plugins/font-subset'
import type { Plugin, ResolvedConfig } from 'vite'

/**
 * 取 HTML 入口在产物里的相对路径（Vite 会保留入口相对 root 的位置）。
 * 没配 `build.rollupOptions.input` 时走 Vite 默认入口 `index.html`；
 * HTML 入口不是唯一一个时也退回默认名 —— 宁可不推导，也不猜错源文件名。
 */
function resolveHtmlEntry(root: string, input: unknown): string {
    const entries: string[] = []
    if (typeof input === 'string') entries.push(input)
    else if (Array.isArray(input)) {
        for (const entry of input) if (typeof entry === 'string') entries.push(entry)
    } else if (input !== null && typeof input === 'object') {
        for (const entry of Object.values(input as Record<string, unknown>)) {
            if (typeof entry === 'string') entries.push(entry)
        }
    }
    const html = entries.filter((entry) => entry.endsWith('.html'))
    if (html.length !== 1) return 'index.html'
    return path.relative(root, path.resolve(root, html[0]))
}

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
    // dev（serve）无前缀；线上 build 带 /bdgame/ 前缀（GitHub Pages 子路径）。
    // 前缀只在这里定义一次：SW 的导航回退与 manifest 图标都必须**跟着它走**
    // （见下面 workbox / manifest 两处注释），换托管路径时才不会留下半截写死的路径。
    const base = command === 'serve' ? '/' : '/bdgame/'
    // gh-pages-404-fallback 插件要用的解析后配置（configResolved 一定先于 closeBundle 跑）
    let resolved: ResolvedConfig | undefined
    return {
        base,
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
                    // 导航回退必须从 base 推导，不能写死 "/index.html"：
                    // workbox 的 createHandlerBoundToURL(url) 是拿这个字符串去和 **precache 清单的
                    // cache key**（相对条目按 sw.js 的位置归一化，即 /bdgame/index.html）对表，
                    // 对不上就抛 non-precached-url。清单里的条目全是相对的（glob 出来的
                    // "index.html"），所以 "/index.html" 指向的是域名根的那个 key —— 不在清单里。
                    // 后果不是"装不上"，而是这一行抛异常后 **registerRoute 根本没执行**：
                    // SW 照样 active、precache 里也有 index.html，但没有任何导航回退，
                    // 离线深链（/bdgame/roguelite）直接 ERR_INTERNET_DISCONNECTED。
                    // `base` 为完整 URL 或 './' 时也成立：两边都以 sw.js 的位置为解析基准。
                    navigateFallback: `${base}index.html`,
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
                        // src 也要带 base：写成 "/icon.svg" 是绝对路径，manifest 解析后指向
                        // 域名根（HDNRAY.github.io/icon.svg，404），Chrome 会报
                        // "Error while trying to use the following icon from the Manifest"。
                        // 图标文件确实在 public/icon.svg，构建后落在 <base>/icon.svg。
                        { src: `${base}icon.svg`, sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
                        { src: `${base}icon.svg`, sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
                    ],
                },
            }),
            {
                // GitHub Pages 对未知路径回退到 404.html：把 index.html 复制一份，让 React Router 接管深链路由。
                //
                // 产物目录从**解析后的配置**推导，不写死 'bdgame'：
                // - `config.root` 是解析后的项目根。它不一定是 `process.cwd()`：用 `--config` 从别的
                //   cwd 跑、或以后改 root 时，按 cwd 拼路径会把 404.html 复制到错地方。
                // - `config.build.outDir` 默认相对 root，也可能被配置或 `--outDir /tmp/x` 给成绝对路径；
                //   `path.resolve(root, outDir)` 两种都对（绝对路径时 resolve 原样返回它）。
                // 另外两处写死是**故意保留**的：`404.html` 这个文件名是 GitHub Pages 的约定（必须逐字，
                // 推导不出来）；插件也完全不碰 `base`（它只在 outDir 内部复制，与 URL 前缀无关）。
                // 源文件名则按配置里的 HTML 入口推导（见 resolveHtmlEntry），默认仍是 index.html。
                name: 'gh-pages-404-fallback',
                apply: 'build',
                configResolved(config) {
                    resolved = config
                },
                closeBundle() {
                    if (!resolved) return
                    const outDir = path.resolve(resolved.root, resolved.build.outDir)
                    const htmlEntry = resolveHtmlEntry(resolved.root, resolved.build.rollupOptions.input)
                    const index = path.join(outDir, htmlEntry)
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
