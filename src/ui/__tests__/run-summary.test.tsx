/**
 * 结算页（`RunSummaryPanel`）与它在终局流程里的位置。
 *
 * 渲染方式与 `DevMode.test.tsx` 一致：`renderToStaticMarkup`（本项目没有 jsdom，
 * 所以 useEffect 不会跑、useMemo 会跑），Tooltip 的 createPortal 换成只渲染子节点。
 * 数据用**真跑一局**得到的 GameState（`runBattles` / `runStats` 都是引擎产出的真数据）。
 *
 * 覆盖点：一局结束时**只有一页** —— 结局名、本局战绩、最终构筑、本局战斗统计与
 * 「再来一局 / 返回主菜单」全在同一页里；原来「对局统计 → 结算」的中间步骤与
 * `statsSeen` 中间状态已删；统计面板包在防横向溢出的 `.rsm-stats` 横滚容器里
 * （H5 390/320 上宽表曾把整页撑开，见 RunSummaryPanel.scss 的窄屏分支）。
 */
import type { ReactNode } from 'react'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { useRogueliteStore } from '../stores/roguelite-store'
import { setMetaStorage } from '../../game/meta-save'
import { RogueliteScreen } from '../screens/RogueliteScreen/RogueliteScreen'
import { getWeapon } from '../../data/weapons/weapons'
import { ATTR_CN } from '../../engine/entities/attributes'

// Tooltip 走 createPortal 挂 document.body，SSR 里没有 document：只保留子节点，
// 这样最终构筑面板（EntityItem/AttributeLabel 都包着 Tooltip）能静态渲染。
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

/** 一路点第一项，直到本局结束 */
function drive(): void {
    let turns = 0
    const store = () => useRogueliteStore.getState()
    while (!store().gameState?.finished && turns++ < 900) {
        const rounds = store().gameState?.rounds ?? []
        const round = rounds[rounds.length - 1]
        if (!round || round.choices.length === 0) break
        store().select(0)
    }
}

/** 跳过开场背景页与第一章章页，进入正文 */
function startRun(): void {
    useRogueliteStore.getState().confirmWorldIntro()
    useRogueliteStore.getState().confirmChapterIntro()
}

/**
 * 渲染 RogueliteScreen。
 * zustand 的 SSR 快照读 `getInitialState()`（静态渲染没有客户端，读不到 set 之后的新对象），
 * 所以先把当前状态同步回初始对象，渲染的才是这一局。
 */
function renderScreen(): string {
    Object.assign(useRogueliteStore.getInitialState(), useRogueliteStore.getState())
    return renderToStaticMarkup(
        <MemoryRouter>
            <RogueliteScreen />
        </MemoryRouter>,
    )
}

describe('结算页（真跑一局）', () => {
    beforeEach(() => {
        setMetaStorage(null)
        useRogueliteStore.getState().reset()
    })

    it('结束时一页看完：战绩数字 + 最终构筑 + 本局战斗统计 + 结算按钮', () => {
        startRun()
        drive()

        const state = useRogueliteStore.getState().gameState!
        expect(state.finished).toBe(true)
        // 本局至少打过一场（runBattles 与 runStats 在同一处累加，两边的场次必须一致）
        const battles = state.runBattles!
        expect(battles.total).toBeGreaterThan(0)
        expect(battles.total).toBe(state.runStats!.battles)
        expect(battles.wins + battles.losses).toBe(battles.total)

        const html = renderScreen()

        // 这一页本身（结局名当标题）
        expect(html).toContain('本局结算')
        expect(html).toContain('最终构筑')
        // 战绩数字：场次 / 胜负 / 伤势 / 奖励
        expect(html).toContain(`<b>${battles.total}</b> 场战斗`)
        expect(html).toContain(`<b>${battles.wins}</b>`)
        expect(html).toContain(`<b>${battles.losses}</b>`)
        expect(html).toContain(`<b>${state.injury}</b>`)
        // 没拿到奖励就整条不显示（不摆「奖励 0 个」）
        if (state.build.rewards.length > 0) {
            expect(html).toContain(`<b>${state.build.rewards.length}</b> 个`)
        } else {
            expect(html).not.toContain('奖励')
        }

        // 最终构筑的关键字段：角色名、武器、属性、招式
        expect(html).toContain(state.build.name)
        expect(html).toContain(getWeapon(state.build.weapon)!.name)
        expect(html).toContain(ATTR_CN.strength)
        expect(html).toContain('招式')

        // 本局战斗统计（复用 BattleStatsPanel）：多场就是「N 场合计」、单场写「单场」
        expect(html).toContain('本局战斗统计')
        expect(html).toContain('输出/场')
        expect(html).toContain(state.runStats!.battles > 1 ? `${state.runStats!.battles} 场合计` : '单场')
        // 防横向溢出结构（H5 390/320 上宽表曾把结算页撑开）：统计面板必须包在自带的
        // 横滚容器 `.rsm-stats` 里 —— 宽表只在这层内滚，页面与 .run-summary 不被撑宽；
        // 窄屏下总览表改键值竖排的样式见 RunSummaryPanel.scss（@media max-width: 30rem）。
        const statsBoxAt = html.indexOf('class="rsm-stats"')
        expect(statsBoxAt).toBeGreaterThan(-1)
        expect(html.indexOf('class="bsp"')).toBeGreaterThan(statsBoxAt)

        // 结算按钮与统计同页：不再先盖一页统计、再点「继续」才看得到
        expect(html).toContain('再来一局')
        expect(html).toContain('返回主菜单')
    })

    it('「两步」的中间状态已删：store 里没有 statsSeen / confirmStats', () => {
        startRun()
        drive()
        expect(renderScreen()).toContain('本局结算')

        // 死状态 / 死分支守卫：合并成一页后不该再有「统计页是否已读」这类中间态
        const store = useRogueliteStore.getState()
        expect('statsSeen' in store).toBe(false)
        expect('confirmStats' in store).toBe(false)
    })
})
