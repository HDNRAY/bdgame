import { useNavigate } from 'react-router-dom'

export function AboutScreen() {
    const navigate = useNavigate()
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                gap: 24,
                background: '#000',
                color: '#ccc',
                fontFamily: 'monospace',
            }}
        >
            <div style={{ fontSize: 24, color: '#4ecdc4' }}>关于</div>
            <div style={{ fontSize: 13, color: '#555', textAlign: 'center', lineHeight: 1.8, maxWidth: 360 }}>
                炁
                <br />
                <br />
                赛博朋克 + 炼炁士 主题 1v1 肉鸽
                <br />
                TypeScript + Vite + React 构建
            </div>
            <button
                onClick={() => navigate('/')}
                style={{
                    padding: '8px 24px',
                    border: '1px solid #333',
                    borderRadius: 4,
                    background: '#111',
                    color: '#ccc',
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                    fontSize: 13,
                }}
            >
                ← 返回
            </button>
        </div>
    )
}
