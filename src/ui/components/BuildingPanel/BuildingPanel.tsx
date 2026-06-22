import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CharacterBuild } from '../../../engine/entities/character-build'
import { getOpponentDef } from '../../../engine/data/opponents/index'
import type { ActionConfig } from '../../../engine/entities/action-config'
import { CONDITION_PRESETS } from '../../../engine/entities/action-config'
import { TRIGGER_CONDITIONS } from '../../../engine/data/triggers'
import { getAction } from '../../../engine/data/actions'
import { ALL_ATTRS, ATTR_CN, type AttrName } from '../../../engine/entities/attributes'
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
        // 从 rewards 推导默认顺序
        return originalBuild.rewards.filter((r) => r.type === 'action').map((r) => ({ actionId: r.id }))
    })

    function handleAttrAdjust(attr: string, delta: number) {
        const cur = attrs[attr] ?? 3
        const next = cur + delta
        if (next < 3 || next > 30) return
        const cost = delta > 0 ? cultCost(cur) : -cultCost(cur - 1)
        if (remaining - cost < 0) return
        setAttrs((prev) => ({ ...prev, [attr]: next }))
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

    function handleSave() {
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
                <button className="bp-save" onClick={handleSave}>
                    ✓ 保存
                </button>
            </div>

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

            <div className="bp-section">
                <div className="bp-section-title">招式配置 (拖拽排序)</div>
                <div className="bp-table-header">
                    <span className="bp-col-order">≡</span>
                    <span className="bp-col-name">招式</span>
                    <span className="bp-col-cond">必要条件</span>
                    <span className="bp-col-trig">触发条件</span>
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
}: {
    id: string
    ac: ActionConfig
    index: number
    onUpdate: (i: number, patch: Partial<ActionConfig>) => void
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
