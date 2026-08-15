import type { When } from '../../game/entities/condition'
import type { Effect } from '../../game/entities/effect'

// ════════════════════════════════════════
//  地图布局数据（全局）
// ════════════════════════════════════════

/** 通用支线池节点（未被故事/大会/固定事件占据的节点槽；这些节点上的池事件是 fallback 候选）。 */
export const POOL_NODES = [4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 25, 32]

/** 故事激活条件：when 表达式 { "==": [{var:"flags.story"}, id] }。 */
export function storyWhen(id: string): When {
    return { '==': [{ var: 'flags.story' }, id] }
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
