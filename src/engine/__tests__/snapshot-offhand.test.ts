import { describe, expect, it } from 'vitest'
import { Character } from '../entities/character'
import { BattleEngine } from '../combat/engine'
import { ALL_ATTRS } from '../entities/attributes'
import type { CharacterBuild } from '../../game/entities/character-build'

/**
 * 双持：副手武器 id 必须进快照（渲染器靠 `snapshot.characters[i].offhand` 画第二把武器）。
 * 副手在战斗中固定（来自 build.offhand），不随主手切换变化。
 */
function build(id: string, weapon: string, offhand?: string): CharacterBuild {
    return {
        id,
        name: id,
        story: '',
        battleStyle: 'clinch',
        weapon,
        offhand,
        baseAttrs: Object.fromEntries(ALL_ATTRS.map((a) => [a, 10])) as CharacterBuild['baseAttrs'],
        rewards: [],
    }
}

describe('快照 · 副手武器', () => {
    it('build.offhand 会出现在快照里；没装副手的角色不带这个字段', () => {
        const a = new Character(build('a', 'peach_sword', 'chun_lei'))
        const b = new Character(build('b', 'xiu_dong'))
        const engine = new BattleEngine(a, b, 4, true)
        const snap = engine.getSnapshot()
        expect(snap.characters[0].weapon).toBe('peach_sword')
        expect(snap.characters[0].offhand).toBe('chun_lei')
        expect(snap.characters[1].offhand).toBeUndefined()
    })
})
