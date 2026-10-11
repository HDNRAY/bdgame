import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { createFontGateOverlay, waitForFontGate } from './ui/boot/font-gate'
import { getEffectiveTheme, loadUiConfig } from './ui/stores/app-store'

// ── 启动顺序（改之前先读 src/ui/boot/font-gate.ts 的模块注释）─────────────
// 1) 主题先落到 <html>：字体门遮罩的底色走 --color-bg，而 AppShell 里设 data-theme 的 effect
//    要等 React 挂载才跑 —— 先设一次，暗色主题下遮罩才不会先白一下。
document.documentElement.dataset.theme = getEffectiveTheme(loadUiConfig().theme)

// 2) 先压遮罩，再**立刻**挂载 App：挂载与路由 chunk 不排队等字体（否则慢网下会串行 +1.x 秒）。
//    玩家在字体到位前只看得到遮罩，所以底下用回退字体渲染、随字体到位换字形，都看不见。
const fontGate = createFontGateOverlay(document)
document.body.appendChild(fontGate)

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
)

// 3) 字体就绪（或超时兜底）后揭开遮罩。放到两帧之后：确保 App 已经画出来，不会闪一帧空白。
void waitForFontGate().then(() => {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => fontGate.remove())
    })
})

// 注册 service worker 更新事件：新 SW 接管时刷新页面
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload()
    })
}
