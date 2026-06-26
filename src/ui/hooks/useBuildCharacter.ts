import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useImmer } from 'use-immer'
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
export function useBuildCharacter(
    build: CharacterBuild,
    onSave?: (build: CharacterBuild) => void,
    unspentCultPoints: number = 0,
) {
    const navigate = useNavigate()

    const [attrs, setAttrs] = useImmer<Record<string, number>>(() => ({ ...(build.baseAttrs ?? {}) }))
    const [actionConfigs, setActionConfigs] = useImmer<ActionConfig[]>(() => {
        // 已有的配置（来自上次保存）
        const existing = (build.actionConfigs ?? []).map((c) => ({ ...c }))
        const existingIds = new Set(existing.map((c) => c.actionId))
        // 补充 rewards 中新增但尚未配置的招式
        for (const r of build.rewards) {
            if (r.type === 'action' && !existingIds.has(r.id)) {
                existing.push({ actionId: r.id })
            }
        }
        return existing
    })
    const [saveError, setSaveError] = useState<string | null>(null)

    // 根据当前编辑中的 attrs/actionConfigs 构造 Character 实例
    const character = new Character({
        ...build,
        baseAttrs: attrs as Partial<Record<AttrName, number>>,
        actionConfigs,
    })

    // 当前编辑的属性消耗
    const spent = ALL_ATTRS.reduce((s, a) => {
        const v = attrs[a] ?? 3
        let cost = 0
        for (let i = 3; i < v; i++) cost += cultCost(i)
        return s + cost
    }, 0)
    // 已保存的属性消耗（build.baseAttrs）
    const savedSpent = ALL_ATTRS.reduce((s, a) => {
        const v = build.baseAttrs?.[a] ?? 3
        let cost = 0
        for (let i = 3; i < v; i++) cost += cultCost(i)
        return s + cost
    }, 0)
    // 还可分配 = 已保存消耗 + 未用点数 - 当前消耗
    const remaining = savedSpent + unspentCultPoints - spent

    const maxTriggerSlots = character.maxTriggerSlots
    const triggerCount = actionConfigs.filter((ac) => ac.triggerId).length
    const activeTalents = checkTalents(attrs)

    function handleAttrAdjust(attr: string, delta: number) {
        const cur = attrs[attr] ?? 3
        const next = cur + delta
        if (next < (build.baseAttrs?.[attr as AttrName] ?? 3) || next > 30) return
        const cost = delta > 0 ? cultCost(cur) : -cultCost(cur - 1)
        if (remaining - cost < 0) return
        setAttrs((draft) => {
            draft[attr] = next
        })
    }

    function handleReset() {
        setAttrs({ ...build.baseAttrs })
        setActionConfigs((draft) => {
            const existing = (build.actionConfigs ?? []).map((c) => ({ ...c }))
            const existingIds = new Set(existing.map((c) => c.actionId))
            for (const r of build.rewards) {
                if (r.type === 'action' && !existingIds.has(r.id)) {
                    existing.push({ actionId: r.id })
                }
            }
            draft.splice(0, draft.length, ...existing)
        })
        setSaveError(null)
    }

    function moveAction(fromIndex: number, toIndex: number) {
        if (toIndex < 0 || toIndex >= actionConfigs.length) return
        setActionConfigs((draft) => {
            const [moved] = draft.splice(fromIndex, 1)
            draft.splice(toIndex, 0, moved)
        })
    }

    function updateAction(index: number, patch: Partial<ActionConfig>) {
        setActionConfigs((draft) => {
            Object.assign(draft[index], patch)
        })
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
    }
}
