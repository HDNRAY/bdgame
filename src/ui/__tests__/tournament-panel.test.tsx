/**
 * 第三章「斗炁大会」赛程面板（`TournamentPanel`）与它在 `RogueliteScreen` 里的入口。
 *
 * 无 jsdom，渲染口径与 `run-summary.test.tsx` / `DevMode.test.tsx` 一致：`renderToStaticMarkup`
 * （useEffect 不跑、useMemo 会跑；Tooltip 的 createPortal 换成只渲染子节点）。
 * 赛程数据用**真函数**产出：selectParticipants + buildEmptyTournament + simulateGroupRound +
 * finalizeGroupStage + simulateKnockoutRound，不是手搓的对象。
 *
 * 覆盖点：
 *   1. 入口可见性 —— nodeIndex >= 23 且 gameState.tournamentData 存在时 rs-header 里才有「赛程」；
 *   2. 小组赛面板渲染出各小组积分榜与比赛比分；
 *   3. 出线结算后（phase='knockout'）默认看到出线名单 + 十六强→决赛的对阵内容。
 * 变异验证：把 TournamentBracket 的渲染整块掐掉（return null），第 3 条必须变红。
 */
import type { ReactNode } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { useRogueliteStore } from '../stores/roguelite-store'
import { RogueliteScreen } from '../screens/RogueliteScreen/RogueliteScreen'
import { TournamentPanel } from '../components/panels/TournamentPanel'
import type { TournamentData } from '../../game/entities/tournament'
import {
    buildEmptyTournament,
    selectParticipants,
    simulateGroupRound,
    simulateKnockoutRound,
} from '../../game/tournament'

vi.mock('../components/ui/Tooltip/Tooltip', () => ({
    Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

beforeAll(() => {
    // node 环境没有 window；RogueliteScreen 的横竖屏判定会读 window.matchMedia
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
})
afterAll(() => {
    vi.unstubAllGlobals()
})

/** 真数据：32 人 → 打 1 轮小组赛（进行中）→ 打满 3 轮自动出线结算 → 打完十六强（八强起留「待定」） */
function playTournament(): { group: TournamentData; knockout: TournamentData } {
    const participants = selectParticipants({ includePlayer: true, playerId: 'player', playerName: '你' })
    const { groupStage, knockoutStage } = buildEmptyTournament(participants, 'player')
    const base: TournamentData = {
        name: '斗炁大会',
        phase: 'group_stage',
        playerId: 'player',
        participants,
        groupStage,
        knockoutStage,
    }
    // 小组赛进行中（面板默认页签 = 小组赛）
    const group = simulateGroupRound(base)
    // 打满三轮：simulateGroupRound 在第三轮结束时自己做出线结算（phase → knockout）
    const full = simulateGroupRound(simulateGroupRound(group))
    expect(full.phase).toBe('knockout')
    const knockout = simulateKnockoutRound(full)
    return { group, knockout }
}

/** 静态渲染面板（onClose 不会触发，给个空实现） */
function renderPanel(tournament: TournamentData): string {
    return renderToStaticMarkup(<TournamentPanel tournament={tournament} onClose={() => {}} />)
}

/** 把 gameState 顶到指定节点后静态渲染 RogueliteScreen */
function renderScreenAt(nodeIndex: number, tournamentData?: TournamentData): string {
    const store = useRogueliteStore.getState()
    store.reset()
    useRogueliteStore.setState({
        worldIntroShown: true,
        chapterIntro: null,
        gameState: { ...useRogueliteStore.getState().gameState!, nodeIndex, tournamentData },
    })
    // zustand 的 SSR 快照读 getInitialState()，先把当前状态同步回去
    Object.assign(useRogueliteStore.getInitialState(), useRogueliteStore.getState())
    const html = renderToStaticMarkup(
        <MemoryRouter>
            <RogueliteScreen />
        </MemoryRouter>,
    )
    useRogueliteStore.getState().reset()
    return html
}

describe('赛程入口（rs-header）', () => {
    const { group } = playTournament()

    it('n23 之前没有「赛程」，n23 起且赛程数据存在才出现', () => {
        expect(renderScreenAt(22, group)).not.toContain('赛程')
        expect(renderScreenAt(23)).not.toContain('赛程')
        expect(renderScreenAt(23, group)).toContain('赛程')
        // 大会阶段之后一直可见
        expect(renderScreenAt(29, group)).toContain('赛程')
    })
})

describe('赛程面板内容', () => {
    const { group, knockout } = playTournament()

    it('小组赛阶段：渲染 8 个小组的积分榜与每场比分', () => {
        const html = renderPanel(group)
        // 8 个组卡片
        for (const name of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
            expect(html).toContain(`${name} 组`)
        }
        expect(html).toContain('class="tn-groups"')
        expect(html).toContain('class="tn-match')
        // 小组赛里已有真实比分（名 1 : 0 名）
        expect(html).toMatch(/\d+ : \d+/)
        // 参赛者名字来自真数据
        expect(html).toContain(group.participants[0].name)
        // 还没出线，默认页签是小组赛，不摆对阵表
        expect(html).not.toContain('对阵表')
    })

    it('出线结算后：默认看到出线名单 + 十六强到决赛的对阵内容', () => {
        const html = renderPanel(knockout)
        expect(html).toContain('出线名单')
        expect(html).toContain('对阵表')
        // 16 人出线名单
        expect(knockout.groupStage.qualifiers).toHaveLength(16)
        const firstName = knockout.participants.find((p) => p.id === knockout.groupStage.qualifiers[0])!.name
        expect(html).toContain(`>${firstName}</li>`)
        // 四列对阵：十六强 / 八强 / 四强 / 决赛 的标题都在
        expect(html).toContain('class="tn-bracket"')
        for (const label of ['十六强', '八强', '四强', '决赛']) {
            expect(html).toContain(label)
        }
        // 对阵行渲染的是「左名 / 比分 / 右名」，十六强已打完 → 有比分，八强起是「待定」
        expect(html).toContain('class="tn-ko-match')
        expect(html).toMatch(/\d+ : \d+/)
        expect(html).toContain('待定')
    })
})
