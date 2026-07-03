/**
 * RogueliteRun CLI 交互式测试
 *
 * 运行: npx tsx scripts/node-demo.ts
 *
 * 每轮引擎推送状态，玩家输入 1/2/3 选择。
 */

import { createInterface } from 'readline/promises'
import { RogueliteRun } from '../src/engine/systems/roguelite/engine'

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = (q: string) => rl.question(q).then((a) => a.trim())

function showState(state: ReturnType<RogueliteRun['getState']>) {
    console.log(`\n──────────────────────────────`)
    console.log(`  节点 ${state.nodeIndex}/33`)
    console.log(`  伤势: ${state.injury}  修炼点: ${state.unspentPoints}`)
    console.log(`──────────────────────────────\n`)

    if (state.finished) {
        console.log('🎉 通关！')
        rl.close()
        return
    }

    const round = state.rounds[state.rounds.length - 1]
    if (!round) return

    if (round.result) console.log(`  📋 ${round.result}\n`)
    if (round.description) console.log(`  📖 ${round.description}\n`)

    console.log(`  [${round.title}]\n`)

    round.choices.forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.label}${c.description ? ` — ${c.description}` : ''}`)
    })

    ask(`\n  选 (1-${round.choices.length})> `).then((input) => {
        const pick = Math.min(parseInt(input) - 1, round.choices.length - 1)
        if (pick >= 0) run.selectChoice(pick)
    })
}

const run = new RogueliteRun()
run.subscribe(showState)
// 显示初始状态（subscribe 在 selectChoice 后才触发）
showState(run.getState())
