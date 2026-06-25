import type { EventDef } from '../../entities/event'

/**
 * 军旅线事件定义
 * 涵盖一阶段训练 (n=7-10) 和二阶段故事 (n=12-21)
 */
export const VETERAN_EVENTS: EventDef[] = [
    // ── 一阶段训练事件 (n=7-10) ──
    {
        id: 'veteran_training_1',
        name: '体能训练',
        type: 'story',
        description: '老班长带你参加严苛的体能训练。在挥洒的汗水中，你感受到身体变得更加强健。',
        effects: [{ type: 'grant_reward', rewardType: 'action' }],
        minNode: 7,
        maxNode: 10,
        maxCount: 2,
    },
    {
        id: 'veteran_training_2',
        name: '剑法指导',
        type: 'story',
        description: '经验丰富的剑师为你讲解剑法的精妙之处。在他的指导下，你的招式变得更加精准有力。',
        effects: [{ type: 'grant_reward', rewardType: 'passive' }],
        minNode: 7,
        maxNode: 10,
        maxCount: 2,
    },
    {
        id: 'veteran_meditation',
        name: '营地冥想',
        type: 'story',
        description: '夜色中，你在营地外盘坐冥想。星辰照耀着你，一切烦忧都消散了。',
        effects: [{ type: 'cult_points', value: 4 }],
        minNode: 7,
        maxNode: 10,
        maxCount: 1,
    },
    {
        id: 'veteran_letter_home',
        name: '家书往来',
        type: 'story',
        description: '你收到了家里的信。读着熟悉的笔迹，你的心中涌起对亲人的思念。',
        effects: [{ type: 'heal', value: 10 }],
        minNode: 7,
        maxNode: 10,
        maxCount: 1,
    },

    // ── 二阶段故事事件 (n=12-21) ──
    {
        id: 'veteran_retire',
        name: '退伍令下达',
        type: 'story',
        description:
            '十年军旅生涯在这一刻画上句号。你领到了退伍证，走出了营门。站在旧日的夜色中，你对整个人生有了新的理解。',
        effects: [{ type: 'cult_points', value: 4 }],
        minNode: 12,
        maxNode: 12,
    },
    {
        id: 'veteran_meet_brother',
        name: '重逢故友',
        type: 'story',
        description:
            '在城市的角落，你遇见了一起退伍的好兄弟。多年未见，他帅气地展示了这两年学到的新招式，你也感受到了他技艺的进步。',
        effects: [{ type: 'grant_reward', rewardType: 'action' }],
        minNode: 13,
        maxNode: 13,
    },
    {
        id: 'veteran_brother_letter',
        name: '兄弟的信',
        type: 'story',
        description:
            '兄弟突然失踪了。你找到了他留下的一封信和一个储物柜的钥匙。打开箱子后，你素了他沿瞳挥了多年的珍贵物件。',
        effects: [{ type: 'grant_reward', rewardType: 'artifact' }],
        minNode: 17,
        maxNode: 17,
    },
    {
        id: 'veteran_brother_death',
        name: '噩耗传来',
        type: 'story',
        description:
            '你最终还是听到了最坏的消息。你的好兄弟在执行任务时牺牲了。愤怒、悲痛牙入梅筛时，你坤然领悟——你的冒险不是为了自己，而是为了找出真相。',
        effects: [{ type: 'cult_points', value: 4 }],
        minNode: 20,
        maxNode: 20,
    },
    {
        id: 'veteran_discover_org',
        name: '真相浮出',
        type: 'story',
        description:
            '调查兄弟的死因时，你发现了一个庞大的组织的蒸面目，就是他卧底的那个地方。弹幕一角，你的目标逐渐渐了。',
        effects: [{ type: 'set_flag', key: 'discovered_org', value: true }],
        minNode: 21,
        maxNode: 21,
    },
]
