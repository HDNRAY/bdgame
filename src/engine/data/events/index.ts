import type { EventDef } from '../../entities/event'
import { spiritTavernEvent } from './spirit-tavern'
import { VETERAN_EVENTS } from './veteran'

/**
 * 事件定义表。
 *
 * 所有 event 节点（'event' 类型）的选项都从这里筛选。
 * bg/weapon/first_action/boss 节点由 node-gen.ts / game-run.ts 单独处理。
 */
export const EVENT_DB: EventDef[] = [
    // ── 战斗事件 ──
    {
        id: 'combat',
        name: '⚔ 战斗',
        type: 'combat',
    },

    // ── Boss 事件 ──
    {
        id: 'boss_phase1',
        name: '首领战',
        type: 'boss',
        enemyId: 'zhanglie',
        rewardType: 'action',
    },
    {
        id: 'boss_phase2',
        name: '守门人',
        type: 'boss',
        enemyId: 'xuanji',
        rewardType: 'artifact',
    },
    {
        id: 'boss_final',
        name: '决赛',
        type: 'boss',
        enemyId: 'liuxigua',
        rewardType: 'weapon',
    },

    // ── 治疗事件 ──
    {
        id: 'heal_wound',
        name: '疗伤',
        type: 'heal',
        description: '你找到一处安静的地方调息养伤。',
        effects: [{ type: 'heal', value: 15 }],
        maxCount: 3,
    },

    // ── 修炼事件 ──
    {
        id: 'forge_insight',
        name: '顿悟',
        type: 'forge',
        description: '你静坐冥思，忽然有所领悟。',
        effects: [{ type: 'cult_points', value: 4 }],
        maxCount: 2,
    },

    // ── 故事事件（示例） ──
    {
        id: 'stranger_aid',
        name: '路人相助',
        type: 'story',
        description: '路边茶棚，一个独臂人正在喝酒。他看了你一眼，将一物抛了过来。"拿着，别死在擂台上。"',
        effects: [{ type: 'grant_reward', rewardType: 'action' }],
        maxCount: 1,
        minNode: 4,
        maxNode: 8,
    },
    {
        id: 'ruins_explore',
        name: '遗迹探索',
        type: 'story',
        description: '你在废弃的遗迹中发现了一间密室。',
        steps: {
            start: {
                id: 'start',
                type: 'narrative',
                text: '你在废弃的遗迹中发现了一间密室。古旧的空气弥漫着神秘的气息。',
                next: 'choice',
            },
            choice: {
                id: 'choice',
                type: 'choice',
                prompt: '你决定如何行动？',
                choices: [
                    {
                        label: '谨慎搜索',
                        description: '你仔细搜索，找到了一件有用的遗物。',
                        success: [{ type: 'grant_reward', rewardType: 'artifact' }],
                        next: 'end_careful',
                    },
                    {
                        label: '冒险深入',
                        description: '你深入密室，可能有所发现也可能触发机关。',
                        chance: 0.6,
                        success: [{ type: 'grant_reward', rewardType: 'weapon' }],
                        failure: [{ type: 'wound', value: 15 }],
                        next: 'end_adventure',
                    },
                ],
            },
            end_careful: {
                id: 'end_careful',
                type: 'narrative',
                text: '你小心地收集了古物，离开了遗迹。这件宝物将大有用处。',
                next: undefined,
            },
            end_adventure: {
                id: 'end_adventure',
                type: 'narrative',
                text: '深入密室后，你遭遇了机关。虽然幸存下来，但受了不少伤。',
                next: undefined,
            },
        },
        firstStep: 'start',
        maxCount: 1,
        minNode: 12,
    },
    {
        id: 'wounded_stranger',
        name: '受伤的江湖人',
        type: 'story',
        description: '你遇到一个受伤的江湖人，他向你求助。',
        steps: {
            start: {
                id: 'start',
                type: 'narrative',
                text: '路旁躺着一个满身血迹的江湖人。他虚弱地抬起头看向你。"救...救我..."',
                next: 'choice',
            },
            choice: {
                id: 'choice',
                type: 'choice',
                prompt: '你的选择是？',
                choices: [
                    {
                        label: '出手相助',
                        description: '你帮他包扎伤口，他感激地送了你一样东西。',
                        success: [
                            { type: 'grant_reward', rewardType: 'passive' },
                            { type: 'set_flag', key: 'helped_stranger', value: true },
                        ],
                        next: 'end_help',
                    },
                    {
                        label: '袖手旁观',
                        description: '你冷漠地走开了。',
                        next: 'end_ignore',
                    },
                ],
            },
            end_help: {
                id: 'end_help',
                type: 'narrative',
                text: '你为他包扎了伤口。他用感激的眼神看着你，掏出一件珍贵的东西。"这是我的诚意。希望你能活得更久。"',
                next: undefined,
            },
            end_ignore: {
                id: 'end_ignore',
                type: 'narrative',
                text: '你冷漠地走开了。听到身后传来的微弱呻吟声，你选择不回头。',
                next: undefined,
            },
        },
        firstStep: 'start',
        maxCount: 1,
        minNode: 4,
        maxNode: 20,
    },

    // ── 军旅线事件 ──
    ...VETERAN_EVENTS,

    // ── 交互事件（多层选择 + 叙事） ──
    spiritTavernEvent,
]
