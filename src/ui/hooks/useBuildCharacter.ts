import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CharacterBuild } from '../../engine/entities/character-build'
import type { ActionConfig } from '../../engine/entities/action-config'
import type { AttrName } from '../../engine/entities/attributes'
import { Character } from '../../engine/entities/character'
import { ALL_ATTRS } from '../../engine/entities/attributes'
import { checkTalents } from '../../engine/systems/talent-check'

/** 每级属性消耗的修炼点 */
export function cultCost(value: number): number {
    if (value >= 20) return 3
    if (value >= 14) return 2
    return 1
}

/**
 * 角色编辑 hook（只在 build 模式下使用）
 * 管理属性分配、招式配置、触发条件、保存逻辑
 */
export function useBuildCharacter(build: CharacterBuild, onSave?: (build: CharacterBuild) => void) {
    const navigate = useNavigate()

    const [attrs, setAttrs] = useState<Record<string, number>>(() => ({ ...(build.baseAttrs ?? {}) }))
    const [actionConfigs, setActionConfigs] = useState<ActionConfig[]>(() => {
        const existing = build.actionConfigs ?? []
        if (existing.length > 0) return existing.map((c) => ({ ...c }))
        return build.rewards.filter((r) => r.type === 'action').map((r) => ({ actionId: r.id }))
    })
    const [saveError, setSaveError] = useState<string | null>(null)

    // 根据当前编辑中的 attrs/actionConfigs 构造 Character 实例
    const buildChar = new Character({
        ...build,
        baseAttrs: attrs as Partial<Record<AttrName, number>>,
        actionConfigs,
    })

    const totalPoints = build.totalCultPoints ?? 0
    const spent = ALL_ATTRS.reduce((s, a) => {
        const v = attrs[a] ?? 3
        let cost = 0
        for (let i = 3; i < v; i++) cost += cultCost(i)
        return s + cost
    }, 0)
    const remaining = totalPoints - spent

    const maxTriggerSlots = buildChar.maxTriggerSlots
    const triggerCount = actionConfigs.filter((ac) => ac.triggerId).length
    const activeTalents = checkTalents(attrs)

    function handleAttrAdjust(attr: string, delta: number) {
        const cur = attrs[attr] ?? 3
        const next = cur + delta
        if (next < 3 || next > 30) return
        const cost = delta > 0 ? cultCost(cur) : -cultCost(cur - 1)
        if (remaining - cost < 0) return
        setAttrs((prev) => ({ ...prev, [attr]: next }))
    }

    function handleReset() {
        setAttrs({ ...build.baseAttrs })
        setActionConfigs(
            build.actionConfigs
                ? build.actionConfigs.map((c) => ({ ...c }))
                : build.rewards.filter((r) => r.type === 'action').map((r) => ({ actionId: r.id })),
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

    function handleSave() {
        if (triggerCount > maxTriggerSlots) {
            setSaveError(
                `触发条件超出上限（${triggerCount}/${maxTriggerSlots}），当前配置最多 ${maxTriggerSlots} 个触发条件`,
            )
            return
        }
        setSaveError(null)
        const newBuild: CharacterBuild = {
            ...build,
            baseAttrs: attrs as Partial<Record<AttrName, number>>,
            actionConfigs,
        }
        if (onSave) {
            onSave(newBuild)
        } else {
            navigate('/select')
        }
    }

    return {
        attrs,
        actionConfigs,
        buildChar,
        totalPoints,
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
    }
}
