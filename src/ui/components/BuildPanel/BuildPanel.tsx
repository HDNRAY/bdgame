import { useRef, useEffect } from 'react'
import { type Character } from '../../../engine/entities/character'
import { getAction } from '../../../engine/data/actions'
import { getWeapon } from '../../../engine/data/weapons'
import type { AttrName } from '../../../engine/entities/attributes'
import { ATTR_CN } from '../../../engine/entities/attributes'
import { getCharacterAvatar, renderAvatarToCanvas, getWeaponOverlay } from '../../../ui/pixel-sprites'
import { Tooltip } from '../ui/Tooltip/Tooltip'
import { ActionItem } from '../ui/ActionItem/ActionItem'
import { PassiveItem } from '../ui/PassiveItem/PassiveItem'
import { ArtifactItem } from '../ui/ArtifactItem/ArtifactItem'
import { WeaponItem } from '../ui/WeaponItem/WeaponItem'
import { TriggerLabel } from '../ui/TriggerLabel/TriggerLabel'
import { ActionTooltip } from '../tooltip-contents/ActionTooltip'
import { StatTooltip } from '../tooltip-contents/StatTooltip'
import './BuildPanel.scss'

interface BuildPanelProps {
    character: Character
    accentColor?: string
}

const ATTR_ORDER: AttrName[] = ['strength', 'vitality', 'agility', 'dexterity', 'insight', 'wisdom']

export function BuildPanel({ character, accentColor = '#888' }: BuildPanelProps) {
    const avatarRef = useRef<HTMLCanvasElement>(null)
    const weaponRef = useRef<HTMLCanvasElement>(null)
    const weapon = character.weaponDef ?? getWeapon(character.build.weapon)
    const a = character.attrs
    const spriteId = character.build.spriteId ?? 'default'

    useEffect(() => {
        const canvas = avatarRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, 32, 32)
        const avatar = getCharacterAvatar(spriteId, accentColor)
        renderAvatarToCanvas(ctx, avatar, 0, 0)
    }, [spriteId, accentColor])

    useEffect(() => {
        const canvas = weaponRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, 48, 48)
        const overlay = getWeaponOverlay(character.build.weapon)
        if (overlay.pixels.length === 0) return
        // 在 48×48 画布中央渲染武器像素（每个像素 3px）
        const minX = Math.min(...overlay.pixels.map((p) => p[0]))
        const maxX = Math.max(...overlay.pixels.map((p) => p[0]))
        const minY = Math.min(...overlay.pixels.map((p) => p[1]))
        const maxY = Math.max(...overlay.pixels.map((p) => p[1]))
        const w = (maxX - minX + 1) * 3
        const h = (maxY - minY + 1) * 3
        const ox = (48 - w) / 2
        const oy = (48 - h) / 2
        for (const [px, py, color] of overlay.pixels) {
            ctx.fillStyle = color
            ctx.fillRect(ox + (px - minX) * 3, oy + (py - minY) * 3, 3, 3)
        }
    }, [character.build.weapon])

    return (
        <div className="build-panel">
            <div className="header">
                <canvas ref={avatarRef} width={32} height={32} className="avatar" />
                <div className="name">{character.name}</div>
            </div>

            <div className="weapon-row">
                <canvas ref={weaponRef} width={48} height={48} className="weapon-art" />
                <div className="weapon-name">
                    <WeaponItem weapon={weapon} />
                </div>
            </div>

            <div className="hp-ap-row">
                <span className="hp">HP</span> {character.maxHp}
                <span className="sep">·</span>
                <span className="ap">AP</span> {character.maxAp}
            </div>

            <div className="section">
                <div className="section-label">属性</div>
                {ATTR_ORDER.map((attr) => {
                    const val = Math.round(a.get(attr))
                    const pct = Math.min(100, (val / 30) * 100)
                    return (
                        <Tooltip key={attr} content={<StatTooltip attr={attr} value={val} />}>
                            <div className="stat-row">
                                <span className="stat-label">{ATTR_CN[attr]}</span>
                                <span className="stat-val">{val}</span>
                                <span className="stat-bar">
                                    <span className="stat-fill" style={{ width: `${pct}%` }} />
                                </span>
                            </div>
                        </Tooltip>
                    )
                })}
            </div>

            {character.passiveDefs.length > 0 && (
                <div className="section">
                    <div className="section-label">功法</div>
                    {character.passiveDefs.map((p, i) => (
                        <PassiveItem key={i} passive={p} />
                    ))}
                </div>
            )}

            {character.actions.length > 0 && (
                <div className="section">
                    <div className="section-label">招式</div>
                    {character.actions.map((act, i) => (
                        <ActionItem key={i} action={act} />
                    ))}
                </div>
            )}

            {character.artifactDefs.length > 0 && (
                <div className="section">
                    <div className="section-label">奇物</div>
                    {character.artifactDefs.map((art, i) => (
                        <ArtifactItem key={i} artifact={art} />
                    ))}
                </div>
            )}

            {character.build.triggers.length > 0 && (
                <div className="section">
                    <div className="section-label">触发</div>
                    {character.build.triggers.map((slot, i) => {
                        const actionDef = slot.actionId ? getAction(slot.actionId) : undefined
                        return (
                            <div key={i} className="entity-item">
                                <span className="entity-item-name">
                                    ▸ <TriggerLabel slot={slot} />
                                </span>
                                {actionDef && (
                                    <Tooltip content={<ActionTooltip action={actionDef} />}>
                                        <span className="entity-item-meta">→ {actionDef.name}</span>
                                    </Tooltip>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
