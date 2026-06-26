import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.scss'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
)

// 注册 service worker 更新事件：新 SW 接管时刷新页面
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload()
    })
}
