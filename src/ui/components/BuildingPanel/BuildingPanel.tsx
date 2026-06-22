import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CharacterBuild } from '../../../engine/entities/character-build'
import { getOpponentDef } from '../../../engine/data/opponents/index'
import { Character } from '../../../engine/entities/character'
import { getPassive } from '../../../engine/data/passives'
import { getArtifact } from '../../../engine/data/artifacts'
import type { ActionConfig } from '../../../engine/entities/action-config'
import { CONDITION_PRESETS } from '../../../engine/data/conditions'
import { TRIGGER_CONDITIONS } from '../../../engine/data/triggers'
import { getAction } from '../../../engine/data/actions'
import { ALL_ATTRS, ATTR_CN, type AttrName } from '../../../engine/entities/attributes'
import { checkTalents } from '../../../engine/systems/talent-check'
import { TAG_COLOR } from '../../../engine/data/tagDisplay'
import './BuildingPanel.scss'

interface BuildingPanelProps {
    charId?: string
    n?: number
    onSave?: (build: CharacterBuild) => void
    onBack?: () => void
}

function cultCost(value: number): number {
    if (value >= 20) return 3
    if (value >= 14) return 2
    return 1
}

export function BuildingPanel({ charId: _charId, n = 33, onSave, onBack }: BuildingPanelProps) {
    const paramsCharId = useParams<{ charId: string }>().charId
    const navigate = useNavigate()
    const charId = _charId ?? paramsCharId ?? ''
    const def = getOpponentDef(charId)
    const originalBuild = def!.generate(n)

    // 属性分配 state
    const [attrs, setAttrs] = useState<Record<string, number>>({ ...originalBuild.baseAttrs })
    const totalPoints = (n - 1) * 2
    const spent = ALL_ATTRS.reduce((s, a) => {
        const v = attrs[a] ?? 3
        let cost = 0
        for (let i = 3; i < v; i++) cost += cultCost(i)
        return s + cost
    }, 0)
    const remaining = totalPoints - spent

    // 招式配置 state
    const [actionConfigs, setActionConfigs] = useState<ActionConfig[]>(() => {
        const existing = originalBuild.actionConfigs ?? []
        if (existing.length > 0) return existing.map((c) => ({ ...c }))
        return originalBuild.rewards.filter((r) => r.type === 'action').map((r) => ({ actionId: r.id }))
    })

    // 通过 Character 获取触发槽上限
    const previewChar = new Character({
        ...originalBuild,
        baseAttrs: attrs as Partial<Record<AttrName, number>>,
        actionConfigs,
    })
    const maxTriggerSlots = previewChar.maxTriggerSlots
    const triggerCount = actionConfigs.filter((ac) => ac.triggerId).length

    // 天赋实时检测
    const activeTalents = checkTalents(attrs)

    // 提取功法/奇物/招式ID
    const passiveIds = originalBuild.rewards.filter((r) => r.type === 'passive').map((r) => r.id)
    const artifactIds = originalBuild.rewards.filter((r) => r.type === 'artifact').map((r) => r.id)

    function handleAttrAdjust(attr: string, delta: number) {
        const cur = attrs[attr] ?? 3
        const next = cur + delta
        if (next < 3 || next > 30) return
        const cost = delta > 0 ? cultCost(cur) : -cultCost(cur - 1)
        if (remaining - cost < 0) return
        setAttrs((prev) => ({ ...prev, [attr]: next }))
    }

    function handleReset() {
        setAttrs({ ...originalBuild.baseAttrs })
        setActionConfigs(
            originalBuild.actionConfigs
                ? originalBuild.actionConfigs.map((c) => ({ ...c }))
                : originalBuild.rewards.filter((r) => r.type === 'action').map((r) => ({ actionId: r.id })),
        )
        setSaveError(null)
    }

    function moveAction(fromIndex: number, toIndex: number) {
        if (toIndex < 0 || toIndex >= actionConfigs.length) return
        const updated = [...actionConfigs]
        const [moved] = updated.splice(fromIndex, 1)
        updated.splice(toIndex, 0, moved)
        setActionConfigs(updated)
    }

    function updateAction(index: number, patch: Partial<ActionConfig>) {
        setActionConfigs((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)))
    }

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const from = parseInt(active.id as string)
        const to = parseInt(over.id as string)
        moveAction(from, to)
    }

    const [saveError, setSaveError] = useState<string | null>(null)

    function handleSave() {
        if (triggerCount > maxTriggerSlots) {
            setSaveError(
                `触发条件超出上限（${triggerCount}/${maxTriggerSlots}），当前配置最多 ${maxTriggerSlots} 个触发条件`,
            )
            return
        }
        setSaveError(null)
        const newBuild: CharacterBuild = {
            ...originalBuild,
            baseAttrs: attrs as Partial<Record<AttrName, number>>,
            actionConfigs,
        }
        if (onSave) {
            onSave(newBuild)
        } else {
            navigate('/select')
        }
    }

    return (
        <div className="building-panel">
            <div className="bp-header">
                <button className="bp-back" onClick={onBack ?? (() => navigate('/select'))}>
                    ← 返回
                </button>
                <span className="bp-name">{def?.name ?? charId}</span>
                <div className="bp-actions">
                    <button className="bp-reset" onClick={handleReset}>
                        ↺ 复位
                    </button>
                    <button className="bp-save" onClick={handleSave}>
                        ✓ 保存
                    </button>
                </div>
            </div>
            {saveError && <div className="bp-error">{saveError}</div>}

            {/* 属性分配 */}
            <div className="bp-section">
                <div className="bp-section-title">
                    修炼点: 剩余 {remaining} / {totalPoints}
                </div>
                {ALL_ATTRS.map((attr) => {
                    const val = attrs[attr] ?? 3
                    const upCost = val < 30 ? cultCost(val) : null
                    return (
                        <div key={attr} className="bp-attr-row">
                            <span className="bp-attr-name">{ATTR_CN[attr]}</span>
                            <span className="bp-attr-val">{val}</span>
                            <button className="bp-btn" disabled={val <= 3} onClick={() => handleAttrAdjust(attr, -1)}>
                                −
                            </button>
                            <button
                                className="bp-btn"
                                disabled={val >= 30 || remaining < (upCost ?? 99)}
                                onClick={() => handleAttrAdjust(attr, 1)}
                            >
                                +
                            </button>
                            {upCost && <span className="bp-attr-cost">{upCost}pt</span>}
                        </div>
                    )
                })}
            </div>

            {/* 天赋 */}
            <div className="bp-section">
                <div className="bp-section-title">天赋</div>
                <div className="bp-talent-list">
                    {checkTalents(originalBuild.baseAttrs).map((t) => {
                        const stillActive = activeTalents.some((a) => a.id === t.id)
                        const def = getPassive(t.id)
                        return (
                            <div key={t.id} className={`bp-talent ${stillActive ? '' : 'bp-talent-lost'}`}>
                                <span className="bp-talent-name">{def?.name ?? t.id}</span>
                                {!stillActive && <span className="bp-talent-status">（已失效）</span>}
                            </div>
                        )
                    })}
                    {activeTalents
                        .filter((t) => !originalBuild.rewards.some((r) => r.type === 'passive' && r.id === t.id))
                        .map((t) => {
                            const def = getPassive(t.id)
                            return (
                                <div key={t.id} className="bp-talent bp-talent-new">
                                    <span className="bp-talent-name">{def?.name ?? t.id}</span>
                                    <span className="bp-talent-status">（新激活）</span>
                                </div>
                            )
                        })}
                    {activeTalents.length === 0 && <div className="bp-talent-empty">属性达标自动解锁</div>}
                </div>
            </div>

            {/* 功法 */}
            {passiveIds.length > 0 && (
                <div className="bp-section">
                    <div className="bp-section-title">功法 ({passiveIds.length})</div>
                    <div className="bp-reward-list">
                        {passiveIds.map((id) => {
                            const def = getPassive(id)
                            if (!def) return null
                            return (
                                <div key={id} className="bp-reward-item">
                                    <div className="bp-reward-name-row">
                                        <span className="bp-reward-name">{def.name}</span>
                                        <span className="bp-reward-tags">
                                            {def.tags?.map((t) => (
                                                <span
                                                    key={t}
                                                    className="bp-tag"
                                                    style={{ borderColor: TAG_COLOR[t] ?? '#555' }}
                                                >
                                                    {t}
                                                </span>
                                            ))}
                                        </span>
                                    </div>
                                    {def.description && <div className="bp-reward-desc">{def.description}</div>}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* 奇物 */}
            {artifactIds.length > 0 && (
                <div className="bp-section">
                    <div className="bp-section-title">奇物 ({artifactIds.length})</div>
                    <div className="bp-reward-list">
                        {artifactIds.map((id) => {
                            const def = getArtifact(id)
                            if (!def) return null
                            return (
                                <div key={id} className="bp-reward-item">
                                    <div className="bp-reward-name-row">
                                        <span className="bp-reward-name">{def.name}</span>
                                        <span className="bp-reward-tags">
                                            {def.tags?.map((t) => (
                                                <span
                                                    key={t}
                                                    className="bp-tag"
                                                    style={{ borderColor: TAG_COLOR[t] ?? '#555' }}
                                                >
                                                    {t}
                                                </span>
                                            ))}
                                        </span>
                                    </div>
                                    {def.description && <div className="bp-reward-desc">{def.description}</div>}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* 招式配置 */}
            <div className="bp-section">
                <div className="bp-section-title">
                    招式配置 (拖拽排序)
                    <span className="bp-trigger-count">
                        {triggerCount}/{maxTriggerSlots} 触发
                    </span>
                </div>
                <div className="bp-table-header">
                    <span className="bp-col-order">≡</span>
                    <span className="bp-col-name">招式</span>
                    <span className="bp-col-cond">条件</span>
                    <span className="bp-col-trig">触发</span>
                </div>
                <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} sensors={sensors}>
                    <SortableContext
                        items={actionConfigs.map((_, i) => String(i))}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="bp-table-body">
                            {actionConfigs.map((ac, i) => (
                                <SortableRow
                                    key={`${ac.actionId}-${i}`}
                                    id={String(i)}
                                    ac={ac}
                                    index={i}
                                    onUpdate={updateAction}
                                    disabled={triggerCount >= maxTriggerSlots && !ac.triggerId}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
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
}: {
    id: string
    ac: ActionConfig
    index: number
    onUpdate: (i: number, patch: Partial<ActionConfig>) => void
    disabled: boolean
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
    const actionDef = getAction(ac.actionId)

    return (
        <div ref={setNodeRef} style={style} className="bp-row">
            <span className="bp-col-order" {...attributes} {...listeners}>
                <span className="bp-drag-handle">⠿</span>
            </span>
            <span className="bp-col-name">{actionDef?.name ?? ac.actionId}</span>
            <span className="bp-col-cond">
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
            <span className="bp-col-trig">
                <select
                    value={ac.triggerId ?? ''}
                    disabled={disabled}
                    onChange={(e) => onUpdate(index, { triggerId: e.target.value || undefined })}
                >
                    <option value="">—</option>
                    {TRIGGER_CONDITIONS.map((tc) => (
                        <option key={tc.id} value={tc.id}>
                            {tc.name}
                        </option>
                    ))}
                </select>
            </span>
        </div>
    )
}
