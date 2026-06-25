import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CharacterPanel } from '../components/CharacterPanel/CharacterPanel'
import { getOpponentDef, gen } from '../../engine/data/opponents/index'
import type { CharacterBuild } from '../../engine/entities/character-build'

export function BuildScreen() {
    const navigate = useNavigate()
    const { charId } = useParams<{ charId: string }>()
    const def = charId ? getOpponentDef(charId) : null
    const initialBuild: CharacterBuild | null = useMemo(() => (def ? gen(def, 33) : null), [def])

    if (!initialBuild) {
        return (
            <div style={{ background: '#000', minHeight: '100vh', color: '#fff', padding: 20 }}>
                <p>角色未找到</p>
                <button onClick={() => navigate('/select')}>返回</button>
            </div>
        )
    }

    return (
        <div style={{ background: '#000', minHeight: '100vh' }}>
            <CharacterPanel mode="build" build={initialBuild} onBack={() => navigate('/select')} />
        </div>
    )
}
