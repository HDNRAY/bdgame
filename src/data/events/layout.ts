import type { When } from '../../game/entities/condition'
import type { Effect } from '../../game/entities/effect'

// ════════════════════════════════════════
//  地图布局数据（全局）
// ════════════════════════════════════════

// ── 三阶段固定分界（所有故事线一致） ──
//   第一阶段 n1-n11（出身/武器/招式/成长/一阶段Boss）
//   第二阶段 n12-n22（成长/支线/守门人）
//   第三阶段 n23-n33（大会/战前支线/决赛）

/** 第一阶段池节点（成长期） */
export const STAGE1_POOL = [4, 5, 6, 7, 8, 9, 10]

/** 第二阶段池节点（准备期，四支线链都在此阶段） */
export const STAGE2_POOL = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21]

/** 第三阶段池节点（战前/战后） */
export const STAGE3_POOL = [24, 25, 32]

/** 通用池节点（所有阶段的池事件候选；这些节点上的池事件是 fallback 候选）。 */
export const POOL_NODES = [...STAGE1_POOL, ...STAGE2_POOL, ...STAGE3_POOL]

/** 天工坊第一次出现：第一阶段快结束时 */
export const STAGE1_END = [8, 9, 10]

/** 天工坊第二次（副手）：第三阶段开打之前 */
export const STAGE3_PRE = [24, 25]

/** 一阶段中段渲染池节点（n4-7；从 n4 起主角已 7-8 岁。天工坊 n8-10 之前） */
export const STAGE1_MID = [4, 5, 6, 7]

/** 二阶段切磋池节点范围（n10-21：同辈切磋，3 选 1 池候选，可空缺） */
export const SPAR_RANGE: [number, number] = [10, 21]

/** 故事激活条件：when 表达式 { "==": [{var:"flags.story"}, id] }。 */
export function storyWhen(id: string): When {
    return { '==': [{ var: 'flags.story' }, id] }
}

/** 一阶段中段渲染池条件：故事线专属 + 每局至多一次（done flag 门控）。 */
export function storyRenderWhen(storyId: string, doneFlag: string): When {
    return { and: [storyWhen(storyId), { '!': { var: `flags.${doneFlag}` } }] }
}

/** n2 选武器的固定选项（空手 = 修炼点，不算武器；其余为武器）。 */
export const N2_WEAPON_CHOICES: { id: string; label: string; description: string; type: 'weapon' | 'points' }[] = [
    { id: 'bare_hands', label: '赤手空拳', description: '什么都没有，但什么都有可能。', type: 'points' },
    { id: 'peach_sword', label: '桃木剑', description: '入门级单手剑，轻灵锐利。', type: 'weapon' },
    { id: 'qimei_staff', label: '齐眉棍', description: '长棍一根，攻守兼备。', type: 'weapon' },
    { id: 'long_spear', label: '长枪', description: '长枪一杆，势大力沉。', type: 'weapon' },
    { id: 'dagger', label: '军用匕首', description: '短小而致命的匕首。', type: 'weapon' },
]

/** 开局奖励效果（选故事时执行）：激活故事 flag + 开局奖励 + 决赛 Boss 种子。 */
export function storyRewardEffects(storyId: string, finalBoss: string, reward: Effect[]): Effect[] {
    return [
        { kind: 'setMany', flags: { story: storyId, tournament_final_boss: finalBoss } },
        ...reward,
    ]
}
