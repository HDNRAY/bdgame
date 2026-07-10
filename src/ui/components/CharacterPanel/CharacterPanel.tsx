import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CharacterBuild } from '../../../engine/entities/character-build'
import type { Character } from '../../../engine/entities/character'
import { getAction } from '../../../engine/data/actions'
import { getWeapon } from '../../../engine/data/weapons/weapons'
import { getPassive } from '../../../engine/data/passives'
import type { ActionConfig } from '../../../engine/entities/action-config'
import { CONDITION_PRESETS } from '../../../engine/data/conditions'
import { TRIGGER_CONDITIONS } from '../../../engine/data/triggers'
import { getTriggerConditionName } from '../../../bridge/triggerDisplay'
import type { AttrName } from '../../../engine/entities/attributes'
import { getCharacterAvatar, renderAvatarToCanvas, getWeaponOverlay } from '../../../ui/pixel-sprites'
import { useBuildCharacter, cultCost } from '../../hooks/useBuildCharacter'
import { BattleStyleSelector } from './BattleStyleSelector'
import { Tooltip } from '../ui/Tooltip/Tooltip'
import { StatTooltip } from '../tooltip-contents/StatTooltip'
import { EntityItem } from '../ui/EntityItem/EntityItem'
import { AttributeLabel } from '../ui/AttributeLabel/AttributeLabel'
import './CharacterPanel.scss'

/** 计算某属性的来源分解 */
function getAttrBreakdown(
    attr: AttrName,
    character: Character,
): { base: number; passives: number; artifacts: number; weapons: number } {
    const base = character.build.baseAttrs?.[attr] ?? 3
    let passives = 0,
        artifacts = 0,
        weapons = 0
    for (const p of character.passiveDefs)
        for (const e of p.effects ?? []) {
            if (e.type === 'stat_buff') {
                const s = e as Extract<typeof e, { type: 'stat_buff' }>
                passives += s.attrs?.[attr] ?? 0
            }
        }
    for (const a of character.artifactDefs)
        for (const e of a.effects ?? []) {
            if (e.type === 'stat_buff') {
                const s = e as Extract<typeof e, { type: 'stat_buff' }>
                artifacts += s.attrs?.[attr] ?? 0
            }
        }
    const w = character.weaponDef
    if (w)
        for (const e of w.effects ?? []) {
            if (e.type === 'stat_buff') {
                const s = e as Extract<typeof e, { type: 'stat_buff' }>
                weapons += s.attrs?.[attr] ?? 0
            }
        }
    return { base, passives, artifacts, weapons }
}

interface CharacterPanelProps {
    mode: 'view' | 'build'
    build: CharacterBuild
    accentColor?: string
    onSave?: (build: CharacterBuild, remaining?: number) => void
    onBack?: () => void
    unspentCultPoints?: number
}

const ATTR_ORDER: AttrName[] = ['strength', 'vitality', 'agility', 'dexterity', 'insight', 'wisdom']

export function CharacterPanel({
    mode,
    build,
    accentColor = '#888',
    onSave,
    onBack,
    unspentCultPoints,
}: CharacterPanelProps) {
    const navigate = useNavigate()
    const isBuild = mode === 'build'

    // Build 模式状态管理
    const {
        actionConfigs,
        battleStyle,
        setBattleStyle,
        character,
        remaining,
        maxTriggerSlots,
        triggerCount,
        activeTalents,
        saveError,
        handleAttrAdjust,
        handleReset,
        moveAction,
        updateAction,
        handleSave,
    } = useBuildCharacter(build, onSave, unspentCultPoints)

    const avatarRef = useRef<HTMLCanvasElement>(null)
    const weaponRef = useRef<HTMLCanvasElement>(null)
    const spriteId = character?.build.spriteId ?? 'default'
    const weapon = character?.weaponDef ?? (character ? getWeapon(character.build.weapon) : undefined)

    // 已选触发 ID 集合（只检查 actionConfigs，不检查武器/功法/奇物自带触发）
    const takenTriggerIds = new Set(actionConfigs.map((ac) => ac.triggerId).filter((id): id is string => !!id))

    useEffect(() => {
        if (!character) return
        const canvas = avatarRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, 32, 32)
        const avatar = getCharacterAvatar(spriteId, accentColor)
        renderAvatarToCanvas(ctx, avatar, 0, 0)
    }, [character, spriteId, accentColor])

    useEffect(() => {
        if (!character) return
        const canvas = weaponRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, 48, 48)
        const overlay = getWeaponOverlay(character.build.weapon)
        if (overlay.pixels.length === 0) return
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
    }, [character])

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

    function handleDragEnd(event: DragEndEvent) {
        if (!isBuild) return
        const { active, over } = event
        if (!over || active.id === over.id) return
        const from = parseInt(active.id as string)
        const to = parseInt(over.id as string)
        moveAction(from, to)
    }

    if (!character) return null

    return (
        <div className="character-panel">
            {/* Header */}
            {isBuild && (
                <div className="cp-header">
                    <button className="cp-btn" onClick={onBack ?? (() => navigate('/select'))}>
                        返回
                    </button>
                    <div className="cp-actions">
                        <button className="cp-btn cp-btn-reset" onClick={handleReset}>
                            复位
                        </button>
                        <button className="cp-btn cp-btn-save" onClick={handleSave}>
                            保存
                        </button>
                    </div>
                </div>
            )}

            {isBuild && saveError && <div className="cp-error">{saveError}</div>}

            <div className="cp-body">
                {/* 左栏：区块1+4 */}
                <div
                    className="cp-col-left"
                    style={{ position: isBuild ? 'sticky' : 'static', top: isBuild ? 0 : undefined }}
                >
                    {/* 区块1: 角色信息 */}
                    <div className="cp-section cp-info-section">
                        <div className="cp-info-left">
                            <div className="cp-info-row">
                                <canvas ref={avatarRef} width={32} height={32} className="cp-avatar" />
                                <div className="cp-info-name">{character.name}</div>
                            </div>
                            <div className="cp-info-row">
                                <div className="cp-hp-ap">
                                    <span className="cp-hp">气血</span> {character.maxHp}
                                    <span className="cp-sep">·</span>
                                    <span className="cp-ap">内息</span> {character.maxAp}
                                </div>
                            </div>
                            <div className="cp-info-row">
                                <canvas ref={weaponRef} width={48} height={48} className="cp-weapon-art" />
                                {weapon && <EntityItem entity={weapon} type="weapon" />}
                            </div>
                        </div>
                        <div className="cp-info-right">
                            <div className="cp-style-label">战斗风格</div>
                            <BattleStyleSelector
                                value={battleStyle}
                                onChange={setBattleStyle}
                                weapon={weapon}
                                isBuild={isBuild}
                            />
                        </div>
                    </div>

                    {/* 区块4: 招式 */}
                    <div className="cp-section">
                        <div className="cp-section-label">
                            招式 ({character.actions.length})
                            {isBuild && (
                                <span className="cp-trigger-count">
                                    {triggerCount}/{maxTriggerSlots} 触发
                                </span>
                            )}
                        </div>
                        {isBuild ? (
                            <>
                                <div className="cp-table-header">
                                    <span className="cp-col-order">≡</span>
                                    <span className="cp-col-name">招式</span>
                                    <span className="cp-col-cond">条件</span>
                                    <span className="cp-col-trig">触发</span>
                                </div>
                                <DndContext
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleDragEnd}
                                    sensors={sensors}
                                >
                                    <SortableContext
                                        items={actionConfigs.map((_, i) => String(i))}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <div className="cp-table-body">
                                            {actionConfigs.map((ac, i) => (
                                                <SortableRow
                                                    key={`${ac.actionId}-${i}`}
                                                    id={String(i)}
                                                    ac={ac}
                                                    index={i}
                                                    onUpdate={updateAction}
                                                    disabled={triggerCount >= maxTriggerSlots && !ac.triggerId}
                                                    takenTriggerIds={takenTriggerIds}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                            </>
                        ) : (
                            <div className="cp-tag-list">
                                {character.actions
                                    .filter((a) => !a.def.tags.includes('internal'))
                                    .map((act, i) => {
                                        const cfg = character.getConfig(act.id)
                                        const condName = cfg?.conditionId
                                            ? CONDITION_PRESETS.find((p) => p.id === cfg.conditionId)?.name
                                            : null
                                        const trigName = cfg?.triggerId ? getTriggerConditionName(cfg.triggerId) : null
                                        return (
                                            <EntityItem key={i} entity={act.def} type="action">
                                                {(condName || trigName) && (
                                                    <>
                                                        {condName && <span className="cp-tag-cond">{condName}</span>}
                                                        {trigName && <span className="cp-tag-trig">{trigName}</span>}
                                                    </>
                                                )}
                                            </EntityItem>
                                        )
                                    })}
                            </div>
                        )}
                    </div>
                </div>

                {/* 右栏：区块2+3 */}
                <div className="cp-col-right">
                    {/* 区块2: 属性 */}
                    <div className="cp-section">
                        <div className="cp-section-label">属性</div>
                        {isBuild && <div className="cp-points">修炼点: 剩余 {remaining}</div>}
                        {ATTR_ORDER.map((attr) => {
                            const finalVal = Math.round(character.attrs.get(attr))
                            const brk = getAttrBreakdown(attr, character)
                            return (
                                <div key={attr} className="cp-attr-row">
                                    <Tooltip content={<StatTooltip attr={attr} value={finalVal} />}>
                                        <AttributeLabel
                                            attr={attr}
                                            value={finalVal}
                                            baseValue={brk.base}
                                            breakdown={isBuild ? brk : undefined}
                                        />
                                    </Tooltip>
                                    {isBuild && (
                                        <>
                                            <button
                                                className="cp-btn-sm"
                                                disabled={brk.base <= (build.baseAttrs?.[attr] ?? 3)}
                                                onClick={() => handleAttrAdjust(attr, -1)}
                                            >
                                                −
                                            </button>
                                            <button
                                                className="cp-btn-sm"
                                                disabled={brk.base >= 30 || remaining < cultCost(brk.base)}
                                                onClick={() => handleAttrAdjust(attr, 1)}
                                            >
                                                +
                                            </button>
                                            {brk.base < 30 && <span className="cp-cost">{cultCost(brk.base)}pt</span>}
                                        </>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* 区块3: 天赋 + 功法 + 奇物 */}
                    {isBuild && activeTalents.length > 0 && (
                        <div className="cp-section">
                            <div className="cp-section-label">天赋</div>
                            <div className="cp-tag-list">
                                {activeTalents.map((t) => {
                                    const def = getPassive(t.id)
                                    return (
                                        <span key={t.id} className="cp-talent">
                                            {def?.name ?? t.id}
                                        </span>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {character.passiveDefs.length > 0 && (
                        <div className="cp-section">
                            <div className="cp-section-label">功法 ({character.passiveDefs.length})</div>
                            <div className="cp-tag-list">
                                {character.passiveDefs.map((p, i) => (
                                    <EntityItem key={i} entity={p} type="passive" />
                                ))}
                            </div>
                        </div>
                    )}

                    {character.artifactDefs.length > 0 && (
                        <div className="cp-section">
                            <div className="cp-section-label">奇物 ({character.artifactDefs.length})</div>
                            <div className="cp-tag-list">
                                {character.artifactDefs.map((art, i) => (
                                    <EntityItem key={i} entity={art} type="artifact" />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

/** 可拖拽排序的招式行 */
function SortableRow({
    id,
    ac,
    index,
    onUpdate,
    disabled,
    takenTriggerIds,
}: {
    id: string
    ac: ActionConfig
    index: number
    onUpdate: (i: number, patch: Partial<ActionConfig>) => void
    disabled: boolean
    takenTriggerIds: Set<string>
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
    const actionDef = getAction(ac.actionId)

    return (
        <div ref={setNodeRef} style={style} className="cp-row">
            <span className="cp-col-order" {...attributes} {...listeners}>
                <span className="cp-drag-handle">⠿</span>
            </span>
            <span className="cp-col-name">{actionDef?.name ?? ac.actionId}</span>
            <span className="cp-col-cond">
                <select
                    value={ac.conditionId ?? 'always'}
                    onChange={(e) =>
                        onUpdate(index, { conditionId: e.target.value === 'always' ? undefined : e.target.value })
                    }
                >
                    {CONDITION_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.name}
                        </option>
                    ))}
                </select>
            </span>
            <span className="cp-col-trig">
                <select
                    value={ac.triggerId ?? ''}
                    disabled={disabled}
                    onChange={(e) => onUpdate(index, { triggerId: e.target.value || undefined })}
                >
                    <option value="">—</option>
                    {TRIGGER_CONDITIONS.map((tc) => {
                        if (takenTriggerIds.has(tc.id) && tc.id !== ac.triggerId) return null
                        return (
                            <option key={tc.id} value={tc.id}>
                                {getTriggerConditionName(tc.id)}
                            </option>
                        )
                    })}
                </select>
            </span>
        </div>
    )
}
