import type { ActiveBuffSnapshot, BattleSnapshot } from '../../../engine/combat/types'
import { getBuff } from '../../../data/buffs'
import { ALL_ATTRS } from '../../../engine/entities/attributes'
import { MAX_CHAN } from '../../../engine/constants'
import { Tooltip } from '../ui/Tooltip/Tooltip'
import { AttributeLabel } from '../ui/AttributeLabel/AttributeLabel'
import './BattleStatusPanel.scss'

/** 从活跃 buff 中汇总各属性的临时修正值 */
function sumBuffAttrMods(buffs: ActiveBuffSnapshot[]): Record<string, number> {
    const mods: Record<string, number> = {}
    for (const b of buffs) {
        const def = getBuff(b.buffId)
        if (def?.attrMods) {
            for (const [attr, val] of Object.entries(def.attrMods)) {
                mods[attr] = (mods[attr] ?? 0) + val * b.stacks
            }
        }
    }
    return mods
}

interface BattleStatusPanelProps {
    snapshot: BattleSnapshot
    charAName: string
    charBName: string
}

export function BattleStatusPanel({ snapshot, charAName, charBName }: BattleStatusPanelProps) {
    const [a, b] = snapshot.characters
    const dist = snapshot.distance
    const isFinished = snapshot.phase === 'finished'
    const winner = isFinished ? (a.hp > 0 ? charAName : charBName) : null

    return (
        <div className="battle-status-panel">
            <div className="title">
                <span className="char-a">{charAName}</span>
                <span className="vs"> {dist.toFixed(1)}m </span>
                <span className="char-b">{charBName}</span>
            </div>

            {winner && <div className="winner">🏆 {winner} 获胜！</div>}

            <div className="chars">
                {[a, b].map((c) => {
                    const hpPct = c.maxHp > 0 ? (c.hp / c.maxHp) * 100 : 0
                    const apPct = c.maxAp > 0 ? (c.ap / c.maxAp) * 100 : 0
                    const buffAttrMods = sumBuffAttrMods(c.buffs)
                    return (
                        <div key={c.id} className="char-col">
                            <div className="hp-text">
                                <span className="hp-label">气血</span> {Math.round(c.hp)}/{c.maxHp}
                            </div>
                            <div className="bar-bg">
                                <div
                                    className={`bar-fill ${hpPct > 30 ? 'bar-hp' : 'bar-hp-low'}`}
                                    style={{ width: `${Math.min(100, hpPct)}%` }}
                                />
                            </div>
                            <div className="hp-text">
                                <span className="ap-label">内息</span> {c.ap}/{c.maxAp}
                            </div>
                            <div className="bar-bg">
                                <div className="bar-fill bar-ap" style={{ width: `${Math.min(100, apPct)}%` }} />
                            </div>
                            <>
                                <div className="hp-text">
                                    <span className="chan-label">缠劲</span> {c.chan}/{MAX_CHAN}
                                </div>
                                <div className="bar-bg">
                                    <div
                                        className="bar-fill bar-chan"
                                        style={{ width: `${Math.min(100, (c.chan / MAX_CHAN) * 100)}%` }}
                                    />
                                </div>
                            </>
                            <div className="attrs-grid">
                                {ALL_ATTRS.map((attr) => {
                                    const val = c.attrs[attr] ?? 0
                                    const base = c.baseAttrs?.[attr] ?? 0
                                    const brk = c.attrBreakdown
                                    return (
                                        <AttributeLabel
                                            key={attr}
                                            attr={attr}
                                            value={val}
                                            baseValue={base}
                                            compact
                                            breakdown={{
                                                base,
                                                passives: brk.passives[attr] ?? 0,
                                                artifacts: brk.artifacts[attr] ?? 0,
                                                weapons: brk.weapons[attr] ?? 0,
                                                buffs: buffAttrMods[attr] ?? 0,
                                            }}
                                        />
                                    )
                                })}
                            </div>
                            <div className="buffs-grid">
                                {c.buffs.map((b) => {
                                    const def = getBuff(b.buffId)
                                    const label = b.stacks > 1 ? `${b.name}(${b.stacks})` : b.name
                                    const isDebuff = def?.tags.includes('debuff') ?? false
                                    return (
                                        <Tooltip key={b.buffId} content={def?.description ?? b.name}>
                                            <span className={`tag-badge ${isDebuff ? 'debuff-tag' : 'buff-tag'}`}>
                                                {label}
                                            </span>
                                        </Tooltip>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
