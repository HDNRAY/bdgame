import { useState } from 'react'
import { allMainActions } from '../../../data/actions'
import { PASSIVES } from '../../../data/passives'
import { ARTIFACTS } from '../../../data/artifacts'
import { WEAPON_DB } from '../../../data/weapons/weapons'
import type { Reward } from '../../../game/entities/reward'
import { EntityItem } from '../ui/EntityItem/EntityItem'
import './RewardPicker.scss'

export type PickKind = Reward['type'] // 'weapon' | 'action' | 'passive' | 'artifact'

interface RewardPickerProps {
    /** 已选集合（按类别） */
    exclude: Partial<Record<PickKind, Set<string>>>
    onPick: (kind: PickKind, id: string) => void
    onClose: () => void
}

const TABS: { kind: PickKind; label: string }[] = [
    { kind: 'action', label: '招式' },
    { kind: 'passive', label: '功法' },
    { kind: 'artifact', label: '奇物' },
    { kind: 'weapon', label: '武器(升级)' },
]

/** 与游戏奖励池口径一致：inherent（血脉限定/特性）与 imperial（御物）不可自选 */
const isPoolPassive = (p: { tags?: string[] }) => !p.tags?.includes('inherent')
const isPoolArtifact = (a: { tags?: string[] }) => !a.tags?.includes('inherent')
const isPoolWeapon = (w: { tags?: string[] }) => !w.tags?.includes('imperial')

export function RewardPicker({ exclude, onPick, onClose }: RewardPickerProps) {
    const [kind, setKind] = useState<PickKind>('action')
    const excluded = exclude[kind] ?? new Set<string>()

    const items: { id: string; entity: unknown; type: 'action' | 'passive' | 'artifact' | 'weapon' }[] = (() => {
        if (kind === 'action') {
            return allMainActions
                .filter((a) => !a.tags.includes('internal') && !excluded.has(a.id))
                .map((a) => ({ id: a.id, entity: a, type: 'action' as const }))
        }
        if (kind === 'passive') {
            return PASSIVES.filter((p) => isPoolPassive(p) && !excluded.has(p.id)).map((p) => ({
                id: p.id,
                entity: p,
                type: 'passive' as const,
            }))
        }
        if (kind === 'artifact') {
            return ARTIFACTS.filter((a) => isPoolArtifact(a) && !excluded.has(a.id)).map((a) => ({
                id: a.id,
                entity: a,
                type: 'artifact' as const,
            }))
        }
        return WEAPON_DB.filter((w) => isPoolWeapon(w) && !excluded.has(w.id)).map((w) => ({
            id: w.id,
            entity: w,
            type: 'weapon' as const,
        }))
    })()

    return (
        <div className="rp-overlay" onClick={onClose}>
            <div className="rp-panel" onClick={(e) => e.stopPropagation()}>
                <header className="rp-head">
                    <span className="rp-title">添加奖励</span>
                    <button className="rp-close" onClick={onClose}>
                        ×
                    </button>
                </header>
                <nav className="rp-tabs">
                    {TABS.map((t) => (
                        <button
                            key={t.kind}
                            className={`rp-tab${kind === t.kind ? ' rp-tab-active' : ''}`}
                            onClick={() => setKind(t.kind)}
                        >
                            {t.label}
                        </button>
                    ))}
                </nav>
                <div className="rp-list">
                    {items.length === 0 && <div className="rp-empty">没有更多可选</div>}
                    {items.map((it) => (
                        <button key={it.id} className="rp-item" onClick={() => onPick(it.type, it.id)}>
                            <EntityItem entity={it.entity as never} type={it.type} />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
