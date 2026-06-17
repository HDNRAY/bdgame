// npx tsx scripts/tournament.ts [N=100] [id]
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
const __dirname = dirname(fileURLToPath(import.meta.url))
const logPath = join(__dirname, 'tournament-log.txt')
const logLines: string[] = []
const origLog = console.log
console.log = (...args) => {
    const line = args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' ')
    logLines.push(line)
    origLog(...args)
}
process.on('exit', () => writeFileSync(logPath, logLines.join('\n') + '\n', 'utf-8'))
import { Character } from '../src/engine/entities/character'
import { OPPONENTS, getOpponentDef } from '../src/engine/data/opponents/index'
import { runBattle } from '../src/engine/battle-runner'

const N = Math.max(1, parseInt(process.argv[3] ?? '100', 10))
const targetId = process.argv[2]
const filterDef = targetId ? getOpponentDef(targetId) : null
if (targetId && !filterDef) {
    console.error(`❌ 未找到角色: ${targetId}`)
    process.exit(1)
}

type Result = { name: string; wins: number; total: number; hpPct: number }

const results: Record<string, Result> = {}
for (const def of OPPONENTS) {
    results[def.id] = { name: def.name, wins: 0, total: 0, hpPct: 0 }
}

let totalBattles = 0

for (let i = 0; i < OPPONENTS.length; i++) {
    for (let j = i + 1; j < OPPONENTS.length; j++) {
        const aDef = OPPONENTS[i]
        const bDef = OPPONENTS[j]
        // 过滤：只打包含目标角色的对战
        if (filterDef && aDef.id !== targetId && bDef.id !== targetId) continue

        let aWins = 0,
            bWins = 0
        let aHp = 0,
            bHp = 0

        for (let k = 0; k < N; k++) {
            const aChar = new Character(aDef.generate(33))
            const bChar = new Character(bDef.generate(33))
            const { winner, engine } = runBattle(aChar, bChar)
            if (winner === aDef.id) aWins++
            else if (winner === bDef.id) bWins++
            const [l, r] = engine.state.characters
            aHp += l.hp / l.maxHp
            bHp += r.hp / r.maxHp
        }

        results[aDef.id].wins += aWins
        results[aDef.id].total += N
        results[aDef.id].hpPct += aHp
        results[bDef.id].wins += bWins
        results[bDef.id].total += N
        results[bDef.id].hpPct += bHp

        totalBattles += N
        const ar = ((aWins / N) * 100).toFixed(1)
        const br = ((bWins / N) * 100).toFixed(1)
        console.log(`${aDef.name} vs ${bDef.name}: ${aWins}/${N} (${ar}%) - ${bWins}/${N} (${br}%)`)
    }
}

console.log(`\n📊 ${OPPONENTS.length} 名角色 · ${totalBattles} 场`)
for (const r of Object.values(results).sort((a, b) => b.wins - a.wins)) {
    const rate = ((r.wins / r.total) * 100).toFixed(1)
    const hp = ((r.hpPct / r.total) * 100).toFixed(1)
    if (r.total > 0) {
        console.log(`  ${r.name.padEnd(12)} ${r.wins.toString().padStart(6)}/${r.total} (${rate}%)  残均HP ${hp}%`)
    }
}
