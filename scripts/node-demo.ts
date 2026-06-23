/**
 * 节点系统 CLI 交互式测试
 *
 * 运行: npx tsx scripts/node-demo.ts
 *
 * 每回合引擎提供选项，玩家输入 1/2/3 选择。
 * 不参与状态管理——全由 GameRun 负责。
 */

import { createInterface } from 'readline/promises'
import { GameRun } from '../src/engine/systems/game-run'
import { spendCultPoints } from '../src/engine/systems/cultivation'
import { STAT_NAMES } from '../src/engine/entities/reward'
import type { AttrName } from '../src/engine/entities/attributes'

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = (q: string) => rl.question(q).then((a) => a.trim())

async function main() {
    console.clear()
    console.log('╔══════════════════════════════╗')
    console.log('║   节点系统 CLI 测试          ║')
    console.log('╚══════════════════════════════╝\n')

    const run = new GameRun('quick')

    while (!run.isFinished()) {
        const node = run.getCurrentNode()
        console.log(`\n──────────────────────────────`)
        console.log(`  节点 ${node.index}/33  (Phase ${node.phase})`)
        console.log(`──────────────────────────────`)

        // bg/weapon → 展示选项
        if (node.type === 'bg' || node.type === 'weapon') {
            const items = run.getSelectionItems()
            items.forEach((item, i) => console.log(`  ${i + 1}. ${item.name} — ${item.desc}`))
            const pick = Math.min(parseInt(await ask('  选 (1-3): ')) - 1, items.length - 1)
            const result = run.selectOption(pick)
            if (result.cultPoints) console.log(`  +${result.cultPoints} 修炼点`)
            continue
        }

        // boss
        if (node.type === 'boss') {
            const result = run.selectOption(0)
            console.log(`  ⚔ ${result.battleResult === 'win' ? '✅ Boss 击败' : '❌ 败于 Boss'}`)
            continue
        }

        // normal
        const opts = run.getOptions()
        console.log('  选择:')
        opts.forEach((o, i) => {
            const extra = o.content === 'combat' ? ` vs ${o.enemyId}` : ''
            console.log(`    ${i + 1}. ${o.desc}${extra}`)
        })
        const choice = Math.min(parseInt(await ask('  选 (1-3): ')) - 1, opts.length - 1)
        const result = run.selectOption(choice)

        if (result.battleResult) {
            console.log(`  ${result.battleResult === 'win' ? '✅ 胜' : '❌ 败'}`)
        }
        if (result.eventText) {
            console.log(`  ${result.eventText}`)
        }

        // 奖励
        if (result.cultPoints) {
            console.log(`  +${result.cultPoints} 修炼点`)
        } else if (result.rewardChoices && result.rewardChoices.length > 0) {
            console.log('  选奖励:')
            result.rewardChoices.forEach((r, i) => {
                const reqs = r.requireAttrsMin
                const reqStr = reqs
                    ? ` [需: ${Object.entries(reqs)
                          .map(([k, v]) => `${k}≥${v}`)
                          .join(', ')}]`
                    : ''
                console.log(`    ${i + 1}. ${r.name} — ${r.description}${reqStr}`)
            })
            const pick = Math.min(parseInt(await ask('  选 (1-3): ')) - 1, result.rewardChoices.length - 1)
            run.selectReward(result.rewardChoices[pick].id)
            console.log(`  获得: ${result.rewardChoices[pick].name}`)
        }

        // 水桶分配修炼点
        if (run.state.unspentCultPoints > 0) {
            const priority: AttrName[] = [...STAT_NAMES]
            const before = { ...run.state.build.baseAttrs }
            const result2 = spendCultPoints(
                run.state.build.baseAttrs as Record<string, number>,
                run.state.unspentCultPoints,
                priority,
            )
            Object.assign(run.state.build.baseAttrs, result2)
            const spent = run.state.unspentCultPoints
            run.state.unspentCultPoints = 0
            const diff = STAT_NAMES.map((s) => `${s}:${before[s] ?? 3}→${run.state.build.baseAttrs[s] ?? 3}`).join(' ')
            console.log(`  水桶分配 ${spent} 点: ${diff}`)
        }
    }

    console.log('\n══════════════════════════════')
    console.log('  通关!')
    const attrs = run.state.build.baseAttrs
    STAT_NAMES.forEach((s) => console.log(`    ${s}: ${attrs[s] ?? 3}`))
    console.log(`  奖励: ${run.state.build.rewards.length} 个`)
    rl.close()
}

main().catch(console.error)
