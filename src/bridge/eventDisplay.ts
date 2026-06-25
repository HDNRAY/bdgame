/**
 * 事件显示逻辑 — 为不同 UI（Web、CLI 等）适配事件信息显示
 *
 * 职责：
 * - 根据事件定义生成展示用的描述文本 (desc)
 * - 中文化奖励类型名称
 * - 不涉及游戏状态变化，纯粹的展示适配
 */

import { EVENT_DB } from '../engine/data/events/index'
import {
    isInteractiveEvent,
    isCombatEvent,
    isBossEvent,
    isHealEvent,
    isForgeEvent,
    isSimpleStoryEvent,
} from '../engine/util/event-utils'
import type { NodeChoice } from '../engine/systems/node-gen'
import type { RewardType } from '../engine/entities/reward'
import type { EventDef } from '../engine/entities/event'

export const REWARD_TYPE_CN: Record<RewardType, string> = {
    cult: '修炼点',
    passive: '功法',
    artifact: '奇物',
    action: '招式',
    weapon: '武器',
}

/**
 * 为事件选项增强 UI 信息（desc、中文显示名等）
 *
 * @param eventIds - 事件 ID 列表
 * @param rewardTypeMap - eventId 到已决定 rewardType 的映射
 * @returns 包含 desc 的完整 NodeChoice[]
 */
export function enrichEventChoices(eventIds: string[], rewardTypeMap: Map<string, RewardType>): NodeChoice[] {
    return eventIds.map((eid) => {
        const ev = EVENT_DB.find((e) => e.id === eid)
        if (!ev) {
            return {
                id: eid,
                name: eid,
                desc: '',
                tags: [],
            }
        }

        const rewardType = rewardTypeMap.get(eid)
        const desc = generateEventDesc(ev, rewardType)

        const choice: NodeChoice = {
            id: eid,
            name: ev.name ?? eid,
            desc,
            tags: [],
        }
        if (rewardType) {
            choice.rewardType = rewardType
        }
        return choice
    })
}

/**
 * 根据事件定义生成显示描述文本
 *
 * @param ev - 事件定义
 * @param rewardType - 已决定的奖励类型（可选）
 * @returns 显示用的描述文本
 */
export function generateEventDesc(ev: EventDef, rewardType?: RewardType): string {
    // 对于 interactive story 类型的事件，检查是否直接有奖励
    if (isInteractiveEvent(ev)) {
        const firstStep = ev.steps[ev.firstStep]
        if (firstStep && firstStep.type === 'choice' && firstStep.choices && firstStep.choices.length > 0) {
            // 检查所有 choice 是否都直接导向有奖励的结果
            const allHaveRewards = firstStep.choices.every((choice) => {
                const nextStepId = typeof choice.next === 'string' ? choice.next : undefined
                if (!nextStepId) return false
                const nextStep = ev.steps[nextStepId]
                return nextStep && nextStep.effects?.some((e) => e.type === 'grant_reward')
            })
            if (allHaveRewards) {
                return `🎁 ${ev.rewardType || 'reward'}`
            }
        }
        return ev.description ?? ''
    }

    // 战斗/Boss 事件：显示奖励类型
    if (isCombatEvent(ev) || isBossEvent(ev)) {
        if (rewardType) {
            return `🎁 ${REWARD_TYPE_CN[rewardType]}`
        }
        if (ev.rewardType) {
            return `🎁 ${REWARD_TYPE_CN[ev.rewardType]}`
        }
        return '🎁 随机奖励' // 备选
    }

    // Heal/Forge 事件：显示效果
    if (isHealEvent(ev) || isForgeEvent(ev)) {
        const effects = ev.effects ?? []
        const effectStrs: string[] = []
        for (const e of effects) {
            if (e.type === 'heal') {
                effectStrs.push(`💚 恢复${e.value}伤势`)
            } else if (e.type === 'cult_points') {
                effectStrs.push(`✨ +${e.value}修炼点`)
            }
        }
        return effectStrs.length > 0 ? effectStrs.join(' ') : (ev.description ?? '')
    }

    // Simple story 事件或其他：显示描述
    if (isSimpleStoryEvent(ev)) {
        return ev.description ?? ''
    }

    // 保险值（不应该到这里）
    return ''
}
