import { PASSIVES } from '../../src/data/passives/passives'
import { getBuff } from '../../src/data/buffs'

const NUM_RE = /[\d.]+%?|每[\d.]+秒|\d+点|\d+层|\d+米|\d+AP|\d+缠|\+[\d.]+/

const rows: { id: string; name: string; passiveDesc: string; buffDesc: string | null }[] = []

for (const p of PASSIVES as (typeof PASSIVES)[number][]) {
    const buffIds: string[] = []
    for (const t of p.triggers ?? []) {
        for (const e of t.effects ?? []) {
            if (e.type === 'add_buff' && 'buffId' in e && e.buffId) buffIds.push(e.buffId)
        }
    }
    for (const e of p.effects ?? []) {
        if (e.type === 'add_buff' && 'buffId' in e && e.buffId) buffIds.push(e.buffId)
    }
    if (NUM_RE.test(p.description)) {
        const buff = buffIds.map((id) => getBuff(id)).find((b) => !!b)
        rows.push({ id: p.id, name: p.name, passiveDesc: p.description, buffDesc: buff?.description ?? null })
    }
}

for (const r of rows) {
    console.log(`【${r.name}】(${r.id})`)
    console.log(`  功法: ${r.passiveDesc}`)
    console.log(`  buff: ${r.buffDesc ?? '(无buff或未找到)'}`)
    console.log('')
}
