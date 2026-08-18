// ════════════════════════════════════════
//  流程地图生成器 → docs/stories/flow-map.md
//  表 1：故事线 × 节点（33 节点槽 × 5 故事线）
//  表 2：全部事件清单（事件 ID / 名称 / 类型 / 编年史 / 可能节点）
//  运行：npx tsx scripts/gen-flow-map.ts
// ════════════════════════════════════════

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ALL_EVENTS, getEvent } from '../src/data/events/index'
import { buildNodeSpecs, TOTAL_NODES } from '../src/game/roguelite/map-builder'
import { evaluateWhen } from '../src/game/entities/condition'
import type { EventDef } from '../src/game/entities/event'

// ── 表 1 列定义：表头 ← 故事线 ID ──
const HEADERS: { name: string; storyId: string }[] = [
    { name: '天生道种', storyId: 'sect' },
    { name: '军旅退伍', storyId: 'veteran' },
    { name: '奇遇流', storyId: 'wanderer' },
    { name: '血海深仇', storyId: 'feud' },
    { name: '玄门子弟', storyId: 'xuanmen' },
]

// ── 池事件分类 ──
/** 四支线链（按解锁顺序展示：偶遇→结拜→青山论剑→酒吧杀人→归海楼） */
const CHAIN_ORDER = [
    'chronicle_tavern_encounter', // 酒馆偶遇
    'chronicle_sworn_brothers', // 酒逢知己（结拜）
    'chronicle_six_duel', // 青山之巅·六绝（排在酒吧杀人之前：重逢笔墨在先）
    'chronicle_bar_killing', // 九朵桃花之夜（酒吧杀人）
    'chronicle_guihailou', // 归海楼比武大会
]

/** 具名池事件（特·）——不再用白名单：非链/非通用池/非 Boss 的 fallback 候选都算具名池事件 */
// （原 SPECIAL_IDS 白名单会导致新增事件漏显示，改为兜底分类）

/** 通用支线池（branch_*） */
const BRANCH_IDS = new Set(['branch_passive', 'branch_action', 'branch_artifact', 'branch_points', 'branch_heal'])

/** 大会节点（非故事线，单独成行） */
const TOURNAMENT_NODES: Record<number, string> = {
    23: '斗炁大会开幕（含各线热身赛：赢→前辈授艺，输→无奖励）',
    26: '小组赛·第一轮',
    27: '小组赛·第二轮',
    28: '小组赛收官',
    29: '十六强赛',
    30: '八强赛',
    31: '半决赛',
    33: '决赛',
}

/** 表 1 备注列（节点 → 备注；其余节点按阶段给默认备注） */
const REMARKS: Record<number, string> = {
    1: '出身选择（随机 3 选 1）',
    2: '选兵器/御物（各线专属，固定；赤手空拳 = +4 修炼点）',
    3: '选招式/奇物（各线专属，固定；2AP 招式）',
    4: '成长池（军旅 = 正式训练）',
    5: '成长池（军旅 = 正规训练）',
    6: '成长池（军旅 = 入伍；玄门 = 结识小树）',
    7: '成长池（道种 = 走火入魔·师兄相救；军旅 = 同袍）',
    8: '成长池（军旅 = 军旅分岔路）',
    9: '成长池（道种 = 约定下山；玄门 = 家传密辛）',
    11: '一阶段Boss（道种 = 师兄弟对决 / 玄门 = 玄九生死斗，其余随机对手）',
    12: '支线链/回忆池（血海 = 加入调查科；玄门 = 取名玄久）',
    13: '支线链/回忆池（血海 = 阿九到来；玄门 = 家族内斗）',
    14: '支线链/回忆池（奇遇 = 青山之巅·六绝·与陶朵重逢；道种/玄门 = 归海楼；血海 = 现场勘查）',
    15: '支线链/回忆池（道种 = 归海楼·表演赛；玄门 = 小树；奇遇 = 与陶朵相处；血海 = 与阿九相处）',
    16: '支线链/回忆池（奇遇 = 九朵桃花之夜·后门；道种 = 重逢 / 玄门 = 质问；军旅 = 兄弟之死）',
    17: '支线链/回忆池（军旅 = 追查；玄门 = 河边修炼）',
    18: '支线链/回忆池（奇遇 = 恩师问话；血海 = 发现真相）',
    19: '支线链/回忆池（道种 = 追踪；军旅 = 李雪影）',
    20: '支线链/回忆池（奇遇 = 来风报信）',
    21: '支线链/回忆池（血海 = 内心挣扎；玄门 = 决定参赛）',
    22: '守门人（血海 = 阿九）',
    24: '战前池（单手且未独臂且未获副手 → 天工坊·副手候选）',
    25: '战前池（单手且未独臂且未获副手 → 天工坊·副手候选）',
    32: '战前池（血海 = 白山月）',
}

function nameOf(id: string): string {
    return getEvent(id)?.name ?? id
}

/** 故事线专属 fallback 事件 → 所属故事线（事件 ID 前缀；渲染池、切磋等） */
const STORY_PREFIXES: [string, string][] = [
    ['feud_', 'feud'],
    ['sect_', 'sect'],
    ['xuanmen_', 'xuanmen'],
    ['wanderer_', 'wanderer'],
    ['veteran_', 'veteran'],
]

function storyOf(id: string): string | undefined {
    for (const [prefix, story] of STORY_PREFIXES) if (id.startsWith(prefix)) return story
    return undefined
}

/** 奇遇流主线链的 flag 进度：按节点推算（结拜 n12 → 青山论剑 n14 → 酒吧 n16 → 恩师 n18 → 来风 n20） */
function chainFlagsAt(storyId: string, n: number): Record<string, boolean> {
    if (storyId !== 'wanderer') return {}
    const f: Record<string, boolean> = {}
    if (n > 12) f.sworn_done = true
    if (n > 14) f.six_done = true
    if (n > 16) f.bar_done = true
    if (n > 18) f.yanglong_done = true
    return f
}

/** 池节点单元格：链· → 特· → Boss/守门人 → 通用池。
 *  各线渲染池事件只在本故事列展示；
 *  共享链的青山论剑/酒吧杀人已为奇遇流让位、归海楼已为天生道种/玄门让位（各自走主线版）；
 *  其余按放置展示（不按临时 flag 过滤）。 */
function poolCell(index: number, storyId: string): string {
    const cands = specs[index].candidates.filter((c) => {
        if (!c.fallback) return false
        if (storyId === 'wanderer' && (c.eventId === 'chronicle_bar_killing' || c.eventId === 'chronicle_six_duel')) {
            return false
        }
        if ((storyId === 'sect' || storyId === 'xuanmen') && c.eventId === 'chronicle_guihailou') {
            return false
        }
        // 玄门御物不涉天工坊
        if (storyId === 'xuanmen' && (c.eventId === 'tiangong_weapon' || c.eventId === 'tiangong_offhand')) {
            return false
        }
        const story = storyOf(c.eventId)
        if (story) return story === storyId
        return true
    })
    const chain = CHAIN_ORDER.filter((id) => cands.some((c) => c.eventId === id)).map((id) => `链·${nameOf(id)}`)
    const special = cands
        .filter(
            (c) =>
                !CHAIN_ORDER.includes(c.eventId) &&
                !BRANCH_IDS.has(c.eventId) &&
                c.eventId !== 'boss_phase1' &&
                c.eventId !== 'boss_phase2',
        )
        .map((c) => `特·${nameOf(c.eventId)}`)
    const bosses = cands
        .filter((c) => c.eventId === 'boss_phase1' || c.eventId === 'boss_phase2')
        .map((c) => (c.eventId === 'boss_phase1' ? 'Boss' : '守门人'))
    const generic = cands.some((c) => BRANCH_IDS.has(c.eventId)) ? ['通用池'] : []
    const parts = [...chain, ...special, ...bosses, ...generic]
    return parts.join(' / ') || '—'
}

/** 故事线单元格：该故事在节点上的非 fallback 主线事件；没有则回落池候选 */
function storyCell(index: number, storyId: string): string {
    const n = index + 1
    const flags = { story: storyId, ...chainFlagsAt(storyId, n) }
    const main = specs[index].candidates.filter((c) => !c.fallback && evaluateWhen(c.when, { flags }))
    if (main.length > 0) return main.map((c) => `主线·${nameOf(c.eventId)}`).join(' / ')
    return poolCell(index, storyId)
}

function remarkFor(n: number): string {
    if (TOURNAMENT_NODES[n]) return TOURNAMENT_NODES[n]
    if (REMARKS[n]) return REMARKS[n]
    if (n >= 4 && n <= 10) return '成长池'
    if (n >= 12 && n <= 21) return '支线链/回忆池'
    return ''
}

// ── 表 2：事件清单 ──
function possibleNodes(ev: EventDef): number[] {
    const set = new Set<number>()
    for (const p of ev.placement ?? []) {
        for (const n of p.nodes ?? []) if (n >= 1 && n <= TOTAL_NODES) set.add(n)
        if (p.range) for (let i = p.range[0]; i <= p.range[1]; i++) set.add(i)
    }
    return [...set].sort((a, b) => a - b)
}

function typeOf(id: string): string {
    if (id.startsWith('chronicle_')) return '编年史支线'
    if (id.startsWith('boss_')) return '通用Boss'
    if (id.startsWith('tournament_')) return '大会'
    if (id.startsWith('origin_')) return '出身事件'
    if (id === 'pick_story') return '出身选择'
    return '支线'
}

const specs = buildNodeSpecs(ALL_EVENTS)

const lines: string[] = []
lines.push('# 流程地图 · 故事线 × 节点 & 事件清单', '')
lines.push('> 依据当前游戏数据自动生成。阶段分界：第一阶段 n1-11 / 第二阶段 n12-22 / 第三阶段 n23-33。')
lines.push('> 图例：`主线·`=故事线专属（固定节点）；`链·`=四支线链事件（flag 门控，按序解锁）；`特·`=具名池事件（受 flag 门控：每局一次/单手武器等）；`通用池`=通用支线池（branch_*）；`Boss`/`守门人`=通用 Boss（未指定敌人时随机）。')
lines.push('> 池事件均为 3 选 1 候选：可空缺、无兜底。四支线链顺序：酒馆偶遇 → 酒逢知己（结拜）→ 青山之巅·六绝 → 九朵桃花之夜（酒吧杀人）→ 归海楼比武大会（归海楼对天生道种/玄门是主线，不在池中）。', '')

// ── 表 1 ──
lines.push('## 表 1 · 故事线 × 节点', '')
lines.push(`| 节点 | ${HEADERS.map((h) => h.name).join(' | ')} | 备注 |`)
lines.push(`| :--- | ${HEADERS.map(() => ':---').join(' | ')} | :--- |`)
for (let i = 0; i < TOTAL_NODES; i++) {
    const n = i + 1
    const cells = HEADERS.map((h) => {
        if (n === 1 || TOURNAMENT_NODES[n]) return '—'
        return storyCell(i, h.storyId)
    })
    lines.push(`| ${n} | ${cells.join(' | ')} | ${remarkFor(n)} |`)
}
lines.push('')

// ── 表 2 ──
lines.push('## 表 2 · 全部事件清单', '')
lines.push('| 事件 ID | 名称 | 类型 | 编年史 | 可能出现的节点 |')
lines.push('| :--- | :--- | :--- | :--- | :--- |')
const sorted = [...ALL_EVENTS].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
for (const ev of sorted) {
    const nodes = possibleNodes(ev)
    const nodesText = nodes.length > 0 ? nodes.join(', ') : '—（仅被引用）'
    const chronicle = ev.id.startsWith('chronicle_') ? '是' : '—'
    lines.push(`| \`${ev.id}\` | ${ev.name} | ${typeOf(ev.id)} | ${chronicle} | ${nodesText} |`)
}
lines.push('')

const out = lines.join('\n')
const scriptDir = fileURLToPath(new URL('.', import.meta.url))
writeFileSync(resolve(scriptDir, '../docs/stories/flow-map.md'), out)
console.log(`written, chars: ${out.length}`)
