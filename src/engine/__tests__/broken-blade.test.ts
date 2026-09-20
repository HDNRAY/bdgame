import { describe, it, expect } from 'vitest'
import { Character } from '../entities/character'
import { gen, getOpponentDef } from '../../data/opponents'
import { getWeapon } from '../../data/weapons/weapons'
import { getAction } from '../../data/actions'
import { runtimeSlotsOf } from '../entities/trigger'

describe('锁链断刀 · 甩刃', () => {
    it('武器自带的「对手远离 → 甩刃」触发槽真的挂在角色身上', () => {
        const slots = runtimeSlotsOf(getWeapon('broken_blade'))
        expect(slots.some((s) => s.condition.type === 'on_opponent_move_away' && s.actionId === '_shuai_ren')).toBe(true)
        // 阿九装备的就是断刀（唯一武器奖励）
        const ajiu = new Character(gen(getOpponentDef('ajiu')!, 33))
        expect(ajiu.weaponDef?.id).toBe('broken_blade')
        expect(ajiu.triggers.some((t) => t.actionId === '_shuai_ren')).toBe(true)
    })

    it('射程够得着后撤落点（2-6m），否则反风筝件永远打空', () => {
        const act = getAction('_shuai_ren')!
        const me = new Character(gen(getOpponentDef('ajiu')!, 33))
        expect(act.getRange?.(me.getEffectiveRange(), me)).toEqual([2, 6])
    })

    it('锁链拉近 + 残刃流血：自带垫步与流血效果', () => {
        const act = getAction('_shuai_ren')!
        expect(act.effects?.some((e) => e.type === 'short_dash')).toBe(true)
        expect(act.effects?.some((e) => e.type === 'add_debuff' && e.buffId === 'bleed')).toBe(true)
    })
})
