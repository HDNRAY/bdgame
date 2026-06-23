import { useNavigate } from 'react-router-dom'
import { CharacterPanel } from '../components/CharacterPanel/CharacterPanel'

export function BuildScreen() {
    const navigate = useNavigate()

    return (
        <div style={{ background: '#000', minHeight: '100vh' }}>
            <CharacterPanel mode="build" onBack={() => navigate('/select')} />
        </div>
    )
}
