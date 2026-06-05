import type { CharacterBuild } from '../entities/character-build'
import type { AttrName } from '../entities/attributes'
import { STAT_NAMES } from '../data/rewards'

const MIN_ATTR = 2

/** 根据 n 生成对手 */
export function generateOpponent(n: number): CharacterBuild {
    // 总属性 = 18 + n * 2.5
    const totalBase = 18 + Math.round(n * 2.5)

    // 加权随机分配（枪手偏 strength/dexterity）
    const weights = { strength: 3, vitality: 2, agility: 1, dexterity: 2, insight: 1, wisdom: 1 }
    const weighted: AttrName[] = []
    for (const [attr, w] of Object.entries(weights)) {
        for (let i = 0; i < w; i++) weighted.push(attr as AttrName)
    }

    const attrs: Partial<Record<AttrName, number>> = {}
    for (const a of STAT_NAMES) attrs[a] = MIN_ATTR
    let remaining = totalBase - MIN_ATTR * 6
    while (remaining > 0) {
        const a = weighted[Math.floor(Math.random() * weighted.length)]
        if ((attrs[a] ?? 0) < 25) {
            attrs[a] = (attrs[a] ?? 0) + 1
            remaining--
        }
    }

    const weapon = 'iron_spear'

    // 被动/义体渐进式增加
    const passives: string[] = []
    const artifacts: string[] = []
    if (n >= 3) passives.push('iron_bone')
    if (n >= 6) artifacts.push('titanium_arm')
    if (n >= 9) {
        passives.push('forge')
        artifacts.push('heart_pump')
    }
    if (n >= 12) artifacts.push('hydraulic_leg')
    if (n >= 15) artifacts.push('neural_net')

    const baseActions: string[] = ['thrust', 'break_formation', 'pursuit_thrust']
    if (n >= 8) baseActions.push('fissure')
    if (n >= 14) baseActions.push('tempest')

    return {
        id: 'enemy',
        name: '枪手',
        weapon,
        baseAttrs: attrs,
        actions: baseActions,
        triggers: [],
        passives,
        artifacts,
    }
}
