import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useImmer } from 'use-immer'
import type { CharacterBuild, BattleStyle } from '../../game/entities/character-build'
import type { ActionConfig } from '../../game/entities/action-config'
import type { AttrName } from '../../engine/entities/attributes'
import { Character } from '../../engine/entities/character'
import { ALL_ATTRS } from '../../engine/entities/attributes'
import { getAction } from '../../data/actions'
import { getWeapon } from '../../data/weapons/weapons'
import { classifyAttackStyle } from '../../engine/ai/planner'
import { checkTalents } from '../../game/talent-check'
import { migrateLegacyActionConfig, unknownLegacyConditionIds } from '../../data/conditions'

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
    onSave?: (build: CharacterBuild, remaining?: number) => void,
    unspentCultPoints: number = 0,
) {
    const navigate = useNavigate()

    const [attrs, setAttrs] = useImmer<Record<string, number>>(() => ({ ...(build.baseAttrs ?? {}) }))
    const [actionConfigs, setActionConfigs] = useImmer<ActionConfig[]>(() => {
        // 已有的配置（来自上次保存）——顺带把旧格式 conditionId 迁移成结构化条件
        const existing = (build.actionConfigs ?? []).map((c) => migrateLegacyActionConfig({ ...c }))
        const existingIds = new Set(existing.map((c) => c.actionId))
        // 补充 rewards 中新增但尚未配置的招式
        for (const r of build.rewards) {
            if (r.type === 'action' && !existingIds.has(r.id)) {
                existing.push({ actionId: r.id })
                existingIds.add(r.id)
            }
        }
        return existing
    })
    const [saveError, setSaveError] = useState<string | null>(null)
    const [battleStyle, setBattleStyle] = useState<BattleStyle | undefined>(build.battleStyle)

    // 根据当前编辑中的 attrs/actionConfigs 构造 Character 实例
    const character = useMemo(
        () =>
            new Character({
                ...build,
                baseAttrs: attrs as Partial<Record<AttrName, number>>,
                actionConfigs,
            }),
        [build, attrs, actionConfigs],
    )

    // 同步 actionConfigs：build 变化时（新奖励等），同步所有可用招式到配置列表
    useEffect(() => {
        const temp = new Character(build)
        const allActionIds = new Set(temp.actions.filter((a) => !a.def.tags.includes('internal')).map((a) => a.id))
        setActionConfigs((draft) => {
            // 移除不再可用的招式
            for (let i = draft.length - 1; i >= 0; i--) {
                if (!allActionIds.has(draft[i].actionId)) {
                    draft.splice(i, 1)
                }
            }
            // 补充新招式
            const existingIds = new Set(draft.map((c) => c.actionId))
            for (const id of allActionIds) {
                if (!existingIds.has(id)) {
                    draft.push({ actionId: id })
                }
            }
        })
    }, [build, setActionConfigs])

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
    /** 已失效的条件预设 id（预设表变动后的旧存档）——不阻断保存，但会明确提示 */
    const staleConditions = unknownLegacyConditionIds(actionConfigs)
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
            const existing = (build.actionConfigs ?? []).map((c) => migrateLegacyActionConfig({ ...c }))
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

    function updateAction(index: number, patch: Partial<ActionConfig>) {
        setActionConfigs((draft) => {
            const ac = draft[index]
            Object.assign(ac, patch)
            // 位移招式只能设条件、不能作为触发招式（与引擎护栏一致）
            if (ac.triggerId && getAction(ac.actionId)?.tags.includes('move')) {
                ac.triggerId = undefined
            }
        })
    }

    function handleSave() {
        if (triggerCount > maxTriggerSlots) {
            setSaveError(
                `触发条件超出上限（${triggerCount}/${maxTriggerSlots}），当前配置最多 ${maxTriggerSlots} 个触发条件`,
            )
            return
        }
        // 失效的条件不阻断保存，但要提示：引擎会把它当"无条件"处理（见 staleConditions）
        setSaveError(
            staleConditions.length > 0
                ? `有 ${staleConditions.length} 个条件已失效（${staleConditions.join('、')}），已按「不设条件」保存`
                : null,
        )
        // battleStyle 显式必填：未手动选风格时按当前主武器落一个建议值（引擎不再自动判定）
        const style: BattleStyle = battleStyle ?? classifyAttackStyle(getWeapon(build.weapon).range)
        const newBuild: CharacterBuild = {
            ...build,
            baseAttrs: attrs as Partial<Record<AttrName, number>>,
            battleStyle: style,
            actionConfigs,
        }
        if (onSave) {
            onSave(newBuild, remaining)
        } else {
            navigate('/select')
        }
    }

    return {
        attrs,
        actionConfigs,
        battleStyle,
        setBattleStyle,
        character,
        remaining,
        maxTriggerSlots,
        triggerCount,
        staleConditions,
        activeTalents,
        saveError,
        handleAttrAdjust,
        handleReset,
        updateAction,
        handleSave,
    }
}
