import type { EventDef } from '../../game/entities/event'
import type { Round } from '../../game/entities/round'
import { END_EVENT } from '../../game/entities/round'

/**
 * 终局 · 山腹（n33 决赛之后插入的事件，无奖励）。
 *
 * 设计见 `docs/ending-design.md`，文案见 `docs/stories/main-story.md`
 * （「山腹」「隐藏boss · 斗炁协会副会长」「击败」「"东西"面前」「陨落于山腹」）。
 *
 * - `guardian` 是隐藏boss 战：敌人来自元进度存档里「最近一次通关的玩家 build」
 *   （`enemyFromSave`）；**首次通关没有存档时，引擎会整轮跳过**，于是那具躯体不出现。
 * - 胜负分支写在战斗轮**之后**的一轮（`guardian_result`）：引擎在推轮时按
 *   `result.won` 过滤选项，而战斗轮自己的选项是在结算**之前**过滤的 —— 与 n23
 *   热身赛（`warmup_result`）同构。
 * - 「转身，离开」（真结局）只在有过通关记录（`flags.cleared_before`）时给；
 *   首次通关只有「回到过去」。
 * - 结局轮写 `ending_loop` / `ending_true` flag，引擎在收尾时落元进度存档。
 */
const ROUNDS: Round[] = [
    {
        id: 'walk',
        title: '最后一扇门',
        description:
            '门后是一条向下的石道。两侧石壁上刻着历代会长的名字——最近的几个还清晰可辨，再往前字迹开始模糊，最远处只剩凹陷的笔画轮廓。',
        choices: [{ id: 'cliff', type: 'continue', label: '往前走' }],
    },
    {
        id: 'cliff',
        title: '石室',
        description:
            '石道到头，是一间空阔的石室。「东西」悬在半空：一块半透明的、不规则的晶体，内部有极慢的光在流转。安静。不发光。不解释。',
        choices: [{ id: 'guardian', type: 'continue', label: '走近' }],
    },
    {
        // 隐藏boss：上一次通关的人。首次通关（无存档）时引擎跳过本轮
        id: 'guardian',
        title: '「东西」前面站着一个人',
        description:
            '那具躯体很高，但佝偻。手臂、脊柱、胸腔外壳都是义体，下半张脸被金属覆盖，只剩一双眼睛还有神色。它看着你，喉间的声音像金属片刮过砂纸。可能说的是「来了？」。也可能什么都没说。然后它抬手。',
        enemyFromSave: true,
        bossName: '斗炁协会副会长',
        choices: [{ id: 'guardian_result', type: 'continue', label: '收招' }],
    },
    {
        // 战斗轮之后的胜负分歧轮（引擎按上一场 result.won 过滤选项）
        id: 'guardian_result',
        title: '收招',
        bossOnly: true,
        description: '声音停了。石室里重新安静下来，安静得能听见自己的呼吸，一下，一下。',
        choices: [
            { id: 'beaten', type: 'continue', label: '去看', when: { '==': [{ var: 'result.won' }, true] } },
            { id: 'fallen', type: 'continue', label: '闭眼', when: { '!': { var: 'result.won' } } },
        ],
    },
    {
        // 只在该战打赢后才走得到（`bossOnly`：boss 缺席时一并跳过）
        id: 'beaten',
        title: '击败',
        bossOnly: true,
        description:
            '它倒下的时候，外壳裂开，露出下面一层又一层的老旧骨架。最早换上的部件已经锈蚀发黑，缠着干涸的炁痕。彻底停止之前，它的眼睛忽然亮了一瞬。那一点光里，像是有什么从极深的地方浮上来。它看着你，嘴唇动了动。没有声音。但口型大概是三个字。「别信它。」',
        choices: [{ id: 'thing', type: 'continue', label: '跨过去' }],
    },
    {
        id: 'thing',
        title: '「东西」面前',
        description:
            '你跨过那具残骸，走到「东西」面前。没有光。没有声音。但有一个声音直接在脑子里响起来——不是语言，更像是一种意识直接灌入：我可以实现你一个愿望。一个作用于你自身的愿望。变强、长高、富有……',
        choices: [
            // 「回到过去」= 历代会长都许过的那个愿（回去见那些已经不在的人）
            {
                id: 'loop',
                type: 'continue',
                label: '回到过去',
                description: '我想再见见那些已经不在的人。',
            },
            // 迷惑选项：它不给变强，只把遗憾还给你 —— 转一圈又回到这一轮
            { id: 'taunt_power', type: 'continue', label: '我要变强' },
            // 真结局：要有通关记录，而且要连选三次 —— 每次转身它都蛊惑一句（leave_step 记次数）
            {
                id: 'taunt_leave_1',
                type: 'continue',
                label: '转身，离开。',
                when: {
                    and: [
                        { '==': [{ var: 'flags.cleared_before' }, true] },
                        { '!': { var: 'flags.leave_step' } },
                    ],
                },
                effects: [{ kind: 'setMany', flags: { leave_step: 1 } }],
            },
            {
                id: 'taunt_leave_2',
                type: 'continue',
                label: '转身，离开。',
                when: { '==': [{ var: 'flags.leave_step' }, 1] },
                effects: [{ kind: 'setMany', flags: { leave_step: 2 } }],
            },
            {
                id: 'true',
                type: 'continue',
                label: '转身，离开。',
                when: { '==': [{ var: 'flags.leave_step' }, 2] },
            },
        ],
    },
    {
        // 蛊惑轮：选「我要变强」后被它绕回来（唯一出口是回到 `thing` 再选一次）
        id: 'taunt_power',
        title: '蛊惑',
        description:
            '那个声音慢下来，几乎像在商量。它把你这一路上没能留住的人一个一个念了一遍。你不想再见见那些已经不在的人？你没什么遗憾？',
        choices: [{ id: 'thing', type: 'continue', label: '沉默' }],
    },
    {
        // 第一次转身：它换一种说法留你（同样回到 `thing`，再选一次）
        id: 'taunt_leave_1',
        title: '蛊惑（一）',
        description:
            '那个声音没有拦你，只是在你转身的时候又说了一句。你不想再见见那些已经不在的人？这句话它说得很慢，像是怕你听不清。石道里很静。',
        choices: [{ id: 'thing', type: 'continue', label: '沉默' }],
    },
    {
        // 第二次转身：它开始替你算账（第三次转身才真的走得掉）
        id: 'taunt_leave_2',
        title: '蛊惑（二）',
        description:
            '它换了个说法。你走了，就是替他们把这件事咽下去；留下来，至少还有一次机会。声音越来越轻，到最后几乎分不清是它说的，还是你自己在想。',
        choices: [{ id: 'thing', type: 'continue', label: '沉默' }],
    },
    {
        id: 'loop',
        title: '回到过去',
        description:
            '「好呀~」。下一秒，你出现在 1989 年初。青山镇的样子和一百年前没什么不同。你认识的人一个都不在这里。你要等。等一百年。等斗炁大会重新开启。等你自己重新走到这里。',
        choices: [
            {
                id: END_EVENT,
                type: 'continue',
                label: '等一百年',
                effects: [{ kind: 'setMany', flags: { ending_loop: true } }],
            },
        ],
    },
    {
        id: 'true',
        title: '转身，离开',
        description:
            '你没有许愿。沿着来路，一步一步走出山腹。走出洞口的时候，天已经亮了。青山镇的炊烟正在升起。你没有停，也没有回头。',
        choices: [
            {
                id: END_EVENT,
                type: 'continue',
                label: '往前走',
                effects: [{ kind: 'setMany', flags: { ending_true: true } }],
            },
        ],
    },
    {
        id: 'fallen',
        title: '陨落于山腹',
        description:
            '石道里没有风。你听见自己的血滴在石板上，一下，一下，越来越慢。断崖上的两个人影始终没有动。「东西」还在那里。不发光。不解释。那具躯体在你旁边站了很久，它大概已经不记得自己为什么站在这里。很久以后，它转身走了。',
        choices: [{ id: END_EVENT, type: 'continue', label: '闭眼', effects: [{ kind: 'setMany', flags: { ending_fallen: true } }] }],
    },
]

export const ENDING_CAVERN: EventDef = {
    id: 'ending_cavern',
    name: '山腹',
    description: '斗炁大会的最后一扇门。',
    reward: { kind: 'none' },
    rounds: ROUNDS,
}
