// ════════════════════════════════════════
//  斗炁大会 CLI 测试
//  运行: npm run tour-cli
//  或: npx tsx scripts/tournament-cli.ts [--knockout] [--players=16|32]
// ════════════════════════════════════════
/// <reference types="node" />
import { createInterface } from 'readline/promises'
import {
    selectParticipants,
    buildEmptyTournament,
    simulateGroupRound,
    simulateKnockoutRound,
    calculateGroupStandings,
    buildKnockoutBracket,
    KNOCKOUT_ROUNDS,
    GROUP_MAX_ROUNDS,
    ROUND_LABELS,
} from '../src/game/tournament/index'
import type { TournamentData, GroupInfo } from '../src/game/entities/tournament'

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = (q: string) => rl.question(q).then((a) => a.trim())

// ── 参数解析 ──

const args = process.argv.slice(2)
const skipGroupStage = args.includes('--knockout')
const showHelp = args.includes('--help')

if (showHelp) {
    console.log(`
用法: npx tsx scripts/tournament-cli.ts [选项]

选项:
  --knockout       跳过小组赛，直接 16 人淘汰赛
  --help           显示此帮助
  --players=N      指定参赛人数（默认自动取满 31-32）
`)
    process.exit(0)
}

// ── 主流程 ──

async function main() {
    console.log('\n═══════════════════════════════════')
    console.log('      斗炁大会 · 模拟器')
    console.log('═══════════════════════════════════\n')

    // 1. 选参赛者
    const participants = selectParticipants({ includePlayer: false })
    console.log(`👥 参赛者: ${participants.length} 人\n`)
    for (const p of participants) {
        console.log(`   ${p.name.padEnd(12)} (seed: ${p.seed})`)
    }

    // 2. 建赛程
    const { groupStage, knockoutStage } = buildEmptyTournament(participants, null)
    const tournament: TournamentData = {
        name: '斗炁大会',
        phase: skipGroupStage ? 'knockout' : 'group_stage',
        participants,
        playerId: null,
        groupStage,
        knockoutStage,
    }

    if (skipGroupStage) {
        // 直接淘汰赛 —— 先随机选 16 人
        console.log('\n── 跳过小组赛，直接 16 人淘汰赛 ──\n')
        const shuffled = [...participants].sort(() => Math.random() - 0.5).slice(0, KNOCKOUT_ROUNDS * 4)

        // 构造虚拟小组：16 人随机分成 8 个假组，每组 2 人，1st 和 2nd 就是这 2 人
        const fakeGroups: GroupInfo[] = []
        const groupNames = 'ABCDEFGH'.split('')
        const qualifiers: string[] = []
        for (let i = 0; i < groupNames.length; i++) {
            const first = shuffled[i * 2]
            const second = shuffled[i * 2 + 1]
            if (!first || !second) continue
            qualifiers.push(first.id, second.id)
            fakeGroups.push({
                name: groupNames[i],
                participantIds: [first.id, second.id],
                matches: [
                    {
                        participantIds: [first.id, second.id],
                        winnerId: first.id,
                        loserId: second.id,
                        scores: [1, 0],
                        bestOf: 1,
                        isPlayerMatch: false,
                    },
                ],
            })
        }

        const rounds = buildKnockoutBracket(qualifiers, fakeGroups)
        tournament.knockoutStage = {
            rounds,
            currentRound: 0,
            finished: false,
            championId: null,
        }
        tournament.phase = 'knockout'
        tournament.groupStage.finished = true
        tournament.groupStage.qualifiers = qualifiers

        console.log('🏆 淘汰赛对阵:\n')
        for (const m of rounds[0].matches) {
            const aName =
                tournament.participants.find((p) => p.id === m.participantIds[0])?.name ?? m.participantIds[0] ?? '?'
            const bName =
                tournament.participants.find((p) => p.id === m.participantIds[1])?.name ?? m.participantIds[1] ?? '?'
            console.log(`   ${aName.padEnd(12)} vs ${bName}`)
        }
    } else {
        await showGroupStage(tournament)
    }

    // 3. 淘汰赛
    if (tournament.phase === 'knockout' || tournament.phase === 'finished') {
        await showKnockoutStage(tournament)
    }

    console.log('═══════════════════════════════════\n')
    rl.close()
}

// ── 小组赛 ──

async function showGroupStage(tournament: TournamentData) {
    console.log('\n── 小组赛 ──\n')

    // 显示分组
    for (const group of tournament.groupStage.groups) {
        const size = group.participantIds.length
        if (size < 3) continue
        const names = group.participantIds.map((id) => tournament.participants.find((p) => p.id === id)?.name ?? id)
        console.log(`  📋 ${group.name}组 (${size}人): ${names.join(', ')}`)
    }

    // 逐轮模拟
    for (let r = 0; r < GROUP_MAX_ROUNDS; r++) {
        console.log(`\n  ── 小组赛第 ${r + 1} 轮 ──\n`)
        tournament = simulateGroupRound(tournament)

        for (const group of tournament.groupStage.groups) {
            const matchIndices = getRoundMatchIndices(group.participantIds.length, r)
            for (const mi of matchIndices) {
                if (mi >= group.matches.length) continue
                const match = group.matches[mi]
                const aName =
                    tournament.participants.find((p) => p.id === match.participantIds[0])?.name ??
                    match.participantIds[0]
                const bName =
                    tournament.participants.find((p) => p.id === match.participantIds[1])?.name ??
                    match.participantIds[1]
                const scoreStr = `${match.scores[0]}-${match.scores[1]}`
                const winnerName = match.winnerId
                    ? (tournament.participants.find((p) => p.id === match.winnerId)?.name ?? match.winnerId)
                    : '未定'
                console.log(`  ${group.name}组: ${aName} vs ${bName}  ${scoreStr} → ${winnerName}`)
            }
        }

        // 显示当前积分榜
        console.log('')
        tournament.groupStage.standings = calculateGroupStandings(tournament.groupStage.groups)
        for (let g = 0; g < tournament.groupStage.groups.length; g++) {
            const group = tournament.groupStage.groups[g]
            if (group.participantIds.length < 3) continue
            const standings = tournament.groupStage.standings[g]
            console.log(`  ${group.name}组 积分:`)
            for (const entry of standings) {
                const name =
                    tournament.participants.find((p) => p.id === entry.participantId)?.name ?? entry.participantId
                console.log(`    ${name.padEnd(12)} ${entry.wins}胜 ${entry.losses}负`)
            }
        }

        if (r < GROUP_MAX_ROUNDS - 1) {
            console.log('')
            await ask('  按 Enter 继续下一轮...')
        }
    }

    // 显示出线名单
    console.log('\n  ── 📊 小组赛结束 · 出线名单 ──\n')
    for (let g = 0; g < tournament.groupStage.groups.length; g++) {
        const group = tournament.groupStage.groups[g]
        if (group.participantIds.length < 3) continue
        const s = tournament.groupStage.standings[g]
        const q1 = tournament.participants.find((p) => p.id === s[0]?.participantId)?.name ?? '?'
        const q2 = tournament.participants.find((p) => p.id === s[1]?.participantId)?.name ?? '?'
        console.log(`  ${group.name}组: ① ${q1}  ② ${q2}`)
    }

    console.log('')
    await ask('  按 Enter 进入淘汰赛...')
}

function getRoundMatchIndices(groupSize: number, round: number): number[] {
    if (groupSize === 4) return [round * 2, round * 2 + 1]
    if (groupSize === 3) return round < 3 ? [round] : []
    return []
}

// ── 淘汰赛 ──

async function showKnockoutStage(tournament: TournamentData) {
    console.log('\n═══════════════════════════════════')
    console.log('           淘汰赛')
    console.log('═══════════════════════════════════\n')

    for (let r = 0; r < KNOCKOUT_ROUNDS; r++) {
        if (r > 0 && tournament.knockoutStage.currentRound < r) break

        const label = ROUND_LABELS[r]
        console.log(`  ── ${label} ──\n`)

        // 显示当前轮对阵
        const roundData = tournament.knockoutStage.rounds[r]
        for (const match of roundData.matches) {
            const [aId, bId] = match.participantIds
            const aName = aId ? (tournament.participants.find((p) => p.id === aId)?.name ?? aId) : 'TBD'
            const bName = bId ? (tournament.participants.find((p) => p.id === bId)?.name ?? bId) : 'TBD'
            console.log(`    ${aName.padEnd(12)} vs ${bName}`)
        }

        if (tournament.knockoutStage.currentRound >= r) {
            console.log('')
            await ask('  按 Enter 模拟本轮...')

            // 模拟
            tournament = simulateKnockoutRound(tournament)

            // 显示结果
            console.log('')
            for (const match of roundData.matches) {
                if (!match.match) continue
                const aName =
                    tournament.participants.find((p) => p.id === match.match?.participantIds[0])?.name ??
                    match.match.participantIds[0]
                const bName =
                    tournament.participants.find((p) => p.id === match.match?.participantIds[1])?.name ??
                    match.match.participantIds[1]
                const scoreStr = `${match.match.scores[0]}-${match.match.scores[1]}`
                const winnerName = match.match.winnerId
                    ? (tournament.participants.find((p) => p.id === match.match?.winnerId)?.name ??
                      match.match.winnerId)
                    : '平局'
                console.log(`    ${aName} vs ${bName}  ${scoreStr} → 🏆 ${winnerName}`)
            }
        }

        if (r < KNOCKOUT_ROUNDS - 1) {
            console.log('')
            await ask('  按 Enter 进入下一轮...')
        } else {
            console.log('')
            const champ = tournament.knockoutStage.championId
            const champName = champ ? (tournament.participants.find((p) => p.id === champ)?.name ?? champ) : '未知'
            console.log(`  🏆🏆🏆 冠军: ${champName} 🏆🏆🏆`)
        }
    }
}

main().catch(console.error)
