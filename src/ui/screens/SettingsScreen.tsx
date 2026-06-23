import { useNavigate } from 'react-router-dom'

export function SettingsScreen() {
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
            <div style={{ fontSize: 24, color: '#4ecdc4' }}>设置</div>
            <div style={{ fontSize: 13, color: '#555' }}>（开发中）</div>
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
