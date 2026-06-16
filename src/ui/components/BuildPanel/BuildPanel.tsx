import { type Character } from '../../../engine/entities/character'
import { getWeapon } from '../../../engine/data/weapons'
import type { AttrName } from '../../../engine/entities/attributes'
import { ATTR_CN } from '../../../engine/entities/attributes'
import './BuildPanel.scss'

interface BuildPanelProps {
    character: Character
}

const ATTR_ORDER: AttrName[] = ['strength', 'vitality', 'agility', 'dexterity', 'insight', 'wisdom']

export function BuildPanel({ character }: BuildPanelProps) {
    const weapon = character.weaponDef ?? getWeapon(character.build.weapon)
    const a = character.attrs

    return (
        <div className="build-panel">
            <div className="name">{character.name}</div>

            <div className="weapon">
                {weapon.name} · 范围 [{weapon.range?.[0] ?? '?'},{weapon.range?.[1] ?? '?'}]
            </div>

            <div className="hp-row">
                <span className="hp">HP</span> {character.maxHp}
            </div>
            <div className="ap-row">
                <span className="ap">AP</span> {character.maxAp}
            </div>

            <div className="section">
                <div className="section-label">属性</div>
                {ATTR_ORDER.map((attr) => {
                    const val = a.get(attr)
                    const pct = Math.min(100, (val / 30) * 100)
                    return (
                        <div key={attr} className="stat-row">
                            <span className="stat-label">{ATTR_CN[attr]}</span>
                            {val}
                            <span className="stat-bar">
                                <span className="stat-fill" style={{ width: `${pct}%` }} />
                            </span>
                        </div>
                    )
                })}
            </div>

            {character.passiveDefs.length > 0 && (
                <div className="section">
                    <div className="section-label">功法</div>
                    {character.passiveDefs.map((p, i) => (
                        <div key={i} className="item" title={p.description}>
                            ▸ {p.name}
                        </div>
                    ))}
                </div>
            )}

            {character.actions.length > 0 && (
                <div className="section">
                    <div className="section-label">招式</div>
                    {character.actions.map((act, i) => (
                        <div key={i} className="item">
                            ▸ {act.name} <span className="action-ap">{act.apCost}AP</span>
                            {act.def.maxUses !== undefined && (
                                <span className="action-uses"> ×{act.remainingUses ?? act.def.maxUses}</span>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {character.artifactDefs.length > 0 && (
                <div className="section">
                    <div className="section-label">奇物</div>
                    {character.artifactDefs.map((art, i) => (
                        <div key={i} className="item" title={art.description}>
                            ▸ {art.name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
