import type { EventDef } from '../../entities/event'
import { getAction } from '../actions'
import { STARTING_WEAPONS } from '../weapons/starting-weapons'
import { spiritTavernEvent } from './spirit-tavern'
import { VETERAN_EVENTS } from './veteran'

/**
 * 事件定义表。
 *
 * 所有 event 节点（'event' 类型）的选项都从这里筛选。
 * 节点1（选背景）/ 节点11/22/33（Boss）由 game-run.ts 单独处理。
 * 节点2（选兵器）和节点3（选起手式）是普通 event 节点，
 * 通过 MapNode.forceEventIds 强制选中指定事件，故事可通过 getNodeOverride 覆盖。
 */
export const EVENT_DB: EventDef[] = [
    // ── 节点2：选兵器（默认起始武器三选一，故事可通过 forceEventIds 替换） ──
    {
        id: 'select_weapon',
        name: '选兵器',
        type: 'story',
        description: '你打量着面前的兵器架。选一把趁手的。',
        minNode: 2,
        maxNode: 2,
        effects: [
            {
                type: 'grant_reward',
                rewardType: 'weapon',
                filter: (r) => STARTING_WEAPONS.some((w) => w.id === r.id),
            },
        ],
    },

    // ── 玄门专有：三件御物 ──
    {
        id: 'xuanmen_weapon',
        name: '选兵器',
        type: 'story',
        description: '你六岁那年，父亲将你叫到祖祠前。三件家族御物悬浮在炁阵中，他说："伸出手，感受哪一件与你共鸣。"',
        minNode: 2,
        maxNode: 2,
        effects: [
            {
                type: 'grant_reward',
                rewardType: 'weapon',
                filter: (r) => ['floating_silk', 'tri_orb', 'fei_jian'].includes(r.id),
            },
        ],
    },

    // ── 玄门起手式（默认也是招式选择，玄门改为选奇物） ──
    {
        id: 'xuanmen_start_action',
        name: '起手式',
        type: 'story',
        description: '招式已随御物附赠，父亲翻出家传库房，让你先择一件趁手的奇物傍身。',
        minNode: 3,
        maxNode: 3,
        effects: [
            {
                type: 'grant_reward',
                rewardType: 'artifact',
            },
        ],
    },

    // ── 军旅：班长教功法（节点4，故事 forceEventIds 强制选中） ──
    {
        id: 'veteran_start_training',
        name: '入门功法',
        type: 'story',
        description: '陆红提察觉到你的天赋，悉心指点。在她的教导下，你开始系统地学习正统的功法。',
        minNode: 4,
        maxNode: 4,
        effects: [
            {
                type: 'grant_reward',
                rewardType: 'passive',
            },
        ],
    },

    // ── 节点3：选起手式（普通 story 事件，默认通过 forceEventIds 强制选中） ──
    {
        id: 'start_action',
        name: '起手式',
        type: 'story',
        description: '你默默回想自己最熟练的起手式。',
        // 仅用于自我声明该事件所属节点范围（防止意外出现在随机三选一中），实际选中靠 forceEventIds 显式指定
        minNode: 3,
        maxNode: 3,
        effects: [
            {
                type: 'grant_reward',
                rewardType: 'action',
                filter: (r) => {
                    const def = getAction(r.id)
                    return (
                        !!def &&
                        def.apCost <= 2 &&
                        !def.tags.includes('pre_action') &&
                        !def.tags.includes('post_action')
                    )
                },
            },
        ],
    },

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
        weight: 0.3,
        minNode: 5,
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
