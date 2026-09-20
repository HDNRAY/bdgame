import { MELEE_ACTIONS, PLAYER_ACTIONS, SUPPORT_ACTIONS, INTERNAL_ACTIONS, QI_SKILLS } from '../src/data/actions'
import type { ActionDefinition } from '../src/engine/entities/action'
const all: ActionDefinition[] = [...MELEE_ACTIONS, ...PLAYER_ACTIONS, ...SUPPORT_ACTIONS, ...INTERNAL_ACTIONS, ...QI_SKILLS]
const num = (s: string): number | undefined => {
    const m = s.match(/-?\d+(\.\d+)?/)
    return m ? parseFloat(m[0]) : undefined
}
let bad = 0, skipped = 0, checked = 0
for (const a of all) {
    const notes = a.hookNotes
    if (!notes) continue
    for (const [key, claim] of Object.entries(notes)) {
        if (key === 'canUse') continue
        const want = num(claim)
        if (want === undefined) continue
        try {
            let got: number | undefined
            if (key === 'hitChance' && a.onActionHitChance) got = a.onActionHitChance(0, {} as never) * 100
            else if (key === 'critChance' && a.onActionCritChance) got = a.onActionCritChance(0, {} as never) * 100
            else if (key === 'critDamage' && a.onActionCritDamage) got = a.onActionCritDamage(0, {} as never) * 100
            else if (key === 'range') got = undefined
            if (got === undefined) { skipped++; continue }
            checked++
            if (Math.abs(got - want) > 0.01) {
                bad++
                console.log(`✗ ${a.id}（${a.name}）${key}: 标注 ${claim} 实际 ${got}%`)
            }
        } catch {
            skipped++ // 钩子要 ctx（条件性数值），脚本不判
            console.log(`? ${a.id}（${a.name}）${key}: 标注 ${claim}（条件性，需人工看）`)
        }
    }
}
console.log(`检查 ${checked} 条数值标注，${bad} 条不符，${skipped} 条条件性/无法判定被跳过`)
