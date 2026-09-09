import { useMemo, useState } from 'react'
import { PixelCanvas } from '../ui/PixelCanvas/PixelCanvas'
import { useNavigate } from 'react-router-dom'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CharacterBuild } from '../../../game/entities/character-build'
import type { Character } from '../../../engine/entities/character'
import { getAction } from '../../../data/actions'
import { getWeapon } from '../../../data/weapons/weapons'
import { getPassive } from '../../../data/passives'
import type { ActionConfig } from '../../../game/entities/action-config'
import { CONDITION_PRESETS } from '../../../data/conditions'
import { TRIGGER_CONDITIONS } from '../../../data/triggers'
import { getTriggerConditionName } from '../../../bridge/triggerDisplay'
import type { AttrName } from '../../../engine/entities/attributes'
import type { Reward } from '../../../game/entities/reward'
import { ARTIFACTS } from '../../../data/artifacts'
import { RewardPicker, type PickKind } from './RewardPicker'
import { getCharacterAvatar, getSpriteOutlineColor, getWeaponOverlay } from '../../../ui/pixel-sprites'
import { useBuildCharacter, cultCost } from '../../hooks/useBuildCharacter'
import { useAppStore, getEffectiveTheme } from '../../stores/app-store'
import { BattleStyleSelector } from './BattleStyleSelector'
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

    /** 构筑模式（DevMode · 构筑试炼）：开放奖励槽自选 / 武器槽 */
    poolMode?: boolean
    /** 奖励位上限（不含初始武器） */
    poolCap?: number
    /** 已占用槽数（rewards 数 + 选件武器数） */
    poolUsed?: number
    /** 奖励里选出的武器槽（第 1 把=主手覆盖初始，第 2 把=副手）；初始默认主手不在此列 */
    poolWeaponSlots?: { slot: 'main' | 'off'; id: string }[]
    onAddReward?: (kind: PickKind, id: string) => void
    onRemoveReward?: (kind: Exclude<Reward['type'], 'weapon'>, id: string) => void
    onRemoveWeaponSlot?: (slot: 'main' | 'off') => void
}

const ATTR_ORDER: AttrName[] = ['strength', 'vitality', 'agility', 'dexterity', 'insight', 'wisdom']

export function CharacterPanel({
    mode,
    build,
    accentColor = '#888',
    onSave,
    onBack,
    unspentCultPoints,
    poolMode = false,
    poolCap = 13,
    poolUsed = 0,
    poolWeaponSlots = [],
    onAddReward,
    onRemoveReward,
    onRemoveWeaponSlot,
}: CharacterPanelProps) {
    const navigate = useNavigate()
    const isBuild = mode === 'build'
    const [pickerOpen, setPickerOpen] = useState(false)

    // 头像描边随主题（dark = 浅灰）
    const themeMode = useAppStore((s) => s.uiConfig.theme)
    const outlineColor = getSpriteOutlineColor(getEffectiveTheme(themeMode))

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

    const spriteId = character?.build.spriteId ?? 'default'
    const weapon = character?.weaponDef ?? (character ? getWeapon(character.build.weapon) : undefined)

    // 已选触发 ID 集合（只检查 actionConfigs，不检查武器/功法/奇物自带触发）
    const takenTriggerIds = new Set(actionConfigs.map((ac) => ac.triggerId).filter((id): id is string => !!id))

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

    function handleDragEnd(event: DragEndEvent) {
        if (!isBuild) return
        const { active, over } = event
        if (!over || active.id === over.id) return
        const from = parseInt(active.id as string)
        const to = parseInt(over.id as string)
        moveAction(from, to)
    }

    // 构筑模式：已选奖励集合（供挑选器去重）与奖励定义查找
    const rewardExclude = useMemo(() => {
        const map: Partial<Record<Reward['type'], Set<string>>> = {
            action: new Set(),
            passive: new Set(),
            artifact: new Set(),
            weapon: new Set(),
        }
        for (const r of build.rewards) map[r.type]?.add(r.id)
        for (const s of poolWeaponSlots) map.weapon?.add(s.id)
        return map
    }, [build.rewards, poolWeaponSlots])

    const rewardDef = (kind: Reward['type'], id: string) => {
        if (kind === 'action') return getAction(id)
        if (kind === 'passive') return getPassive(id)
        if (kind === 'artifact') return ARTIFACTS.find((a) => a.id === id)
        return getWeapon(id)
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
                                <PixelCanvas
                                    pixels={getCharacterAvatar(spriteId, accentColor, outlineColor).pixels}
                                    palette={getCharacterAvatar(spriteId, accentColor, outlineColor).palette}
                                    scale={4}
                                    className="cp-avatar"
                                />
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
                                <PixelCanvas
                                    overlay={getWeaponOverlay(character.build.weapon)}
                                    className="cp-weapon-art"
                                />
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
                                    <AttributeLabel attr={attr} value={finalVal} baseValue={brk.base} breakdown={brk} />
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

                    {/* 区块2.5（构筑模式）: 奖励槽 */}
                    {isBuild && poolMode && (
                        <div className="cp-section">
                            <div className="cp-section-label">
                                奖励 ({poolUsed}/{poolCap})
                                <button
                                    className="cp-btn-sm cp-add-btn"
                                    disabled={poolUsed >= poolCap}
                                    onClick={() => setPickerOpen(true)}
                                >
                                    + 添加
                                </button>
                            </div>
                            <div className="cp-pool-list">
                                {poolWeaponSlots.map((s) => (
                                    <div key={s.slot} className="cp-pool-row">
                                        <span className="cp-pool-slot">{s.slot === 'main' ? '主手' : '副手'}</span>
                                        <EntityItem entity={rewardDef('weapon', s.id) as never} type="weapon" />
                                        <button
                                            className="cp-btn-sm"
                                            title={s.slot === 'main' ? '移除该武器，恢复初始武器' : '移除副手武器'}
                                            onClick={() => onRemoveWeaponSlot?.(s.slot)}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                                {build.rewards.map((r) => {
                                    if (r.type === 'weapon') return null
                                    const def = rewardDef(r.type, r.id)
                                    if (!def) return null
                                    return (
                                        <div key={`${r.type}-${r.id}`} className="cp-pool-row">
                                            <EntityItem
                                                entity={def as never}
                                                type={r.type as 'action' | 'passive' | 'artifact'}
                                            />
                                            <button
                                                className="cp-btn-sm"
                                                onClick={() =>
                                                    onRemoveReward?.(r.type as Exclude<Reward['type'], 'weapon'>, r.id)
                                                }
                                            >
                                                ×
                                            </button>
                                        </div>
                                    )
                                })}
                                {poolUsed === 0 && (
                                    <div className="cp-pool-empty">
                                        从招式 / 功法 / 奇物中挑选奖励；武器可在「武器」页选（第 1 把为主手、第 2 把为副手），
                                        至多 {poolCap} 个奖励位
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {pickerOpen && (
                        <RewardPicker
                            exclude={rewardExclude}
                            onPick={(kind, id) => {
                                onAddReward?.(kind, id)
                                setPickerOpen(false)
                            }}
                            onClose={() => setPickerOpen(false)}
                        />
                    )}

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

                    {!poolMode && character.passiveDefs.length > 0 && (
                        <div className="cp-section">
                            <div className="cp-section-label">功法 ({character.passiveDefs.length})</div>
                            <div className="cp-tag-list">
                                {character.passiveDefs.map((p, i) => (
                                    <EntityItem key={i} entity={p} type="passive" />
                                ))}
                            </div>
                        </div>
                    )}

                    {!poolMode && character.artifactDefs.length > 0 && (
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
    // 位移招式只能设条件、不能作为触发招式（与引擎护栏一致）
    const isMove = actionDef?.tags.includes('move') ?? false

    return (
        <div ref={setNodeRef} style={style} className="cp-row">
            <span className="cp-col-order" {...attributes} {...listeners}>
                <span className="cp-drag-handle">⠿</span>
            </span>
            <span className="cp-col-name">
                {actionDef ? <EntityItem entity={actionDef} type="action" /> : ac.actionId}
            </span>
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
                    value={isMove ? '' : (ac.triggerId ?? '')}
                    disabled={disabled || isMove}
                    title={isMove ? '位移招式不能设为触发招式' : undefined}
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
