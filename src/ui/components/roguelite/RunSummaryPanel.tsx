import { useMemo } from 'react'
import { BattleStatsPanel } from '../BattleStatsPanel/BattleStatsPanel'
import { CharacterPanel } from '../CharacterPanel/CharacterPanel'
import type { CharacterBuild } from '../../../game/entities/character-build'
import type { RunBattleRecord } from '../../../game/entities/state'
import type { BattleStatsSnapshot } from '../../../engine/combat/battle-stats'
import './RunSummaryPanel.scss'

/**
 * 一局结束的结算页（战绩 + 最终构筑 + 本局战斗统计同页）。
 *
 * 以前是「对局统计页 → 结算页」两步，现在合成这一页：读完终章（非真结局则直接）
 * 就在这一页看到结局名、本局数字、最终构筑与战斗统计，主按钮常驻底部随时可点。
 *
 * 内容全部来自已有数据源，不新算口径：
 *  - 战绩数字：`state.runBattles`（引擎在每次战斗结算处累加）+ `state.injury` / `build.rewards.length`；
 *  - 战斗统计：`state.runStats`（引擎把每场 `BattleStats` 合并成的快照），展示复用 `BattleStatsPanel`；
 *  - 最终构筑：直接复用 `CharacterPanel` 的 view 模式（角色 / 属性 / 招式 / 功法 / 奇物与义体 / 武器）。
 *
 * 没数据的分区整块不渲染（不摆「0 场 / 空表」）。
 * DevMode 也用同一个组件预览（传 `notice` 标出来源），不另写展示。
 */
interface RunSummaryPanelProps {
    /** 结局名（得魁 / 带着遗憾向前 / 陨落于山腹 / 胜败乃兵家常事） */
    title: string
    /** 最终构筑 */
    build: CharacterBuild
    /** 结算时的伤势 */
    injury: number
    /** 本局战斗战绩；一场正式战斗都没打时没有 */
    battles?: RunBattleRecord
    /** 本局累计战斗统计；没有战斗统计时没有 */
    stats?: BattleStatsSnapshot
    /** 再来一局（重开本局） */
    onRestart: () => void
    /** 返回主菜单 */
    onExit: () => void
    /** 顶部小字来源标记（DevMode：「样例数据」这类）；真局不传 */
    notice?: string
}

export function RunSummaryPanel({
    title,
    build,
    injury,
    battles,
    stats,
    onRestart,
    onExit,
    notice,
}: RunSummaryPanelProps) {
    // 一局对手十几位，摊开排不下；只留我方一栏（承伤来源里已经能看到对手的招式）
    const selfStats = useMemo<BattleStatsSnapshot | undefined>(() => {
        if (!stats) return undefined
        const chars = stats.chars.filter((c) => c.id === 'player')
        return chars.length > 0 ? { ...stats, chars } : undefined
    }, [stats])

    return (
        <div className="run-summary">
            <div className="rsm-inner">
                <header className="rsm-head">
                    <div className="rsm-kicker">本局结算</div>
                    <h1 className="rsm-title">{title}</h1>
                    <div className="rsm-figures">
                        {battles && battles.total > 0 && (
                            <>
                                <span className="rsm-figure">
                                    <b>{battles.total}</b> 场战斗
                                </span>
                                <span className="rsm-figure">
                                    胜 <b>{battles.wins}</b>
                                </span>
                                <span className="rsm-figure">
                                    负 <b>{battles.losses}</b>
                                </span>
                            </>
                        )}
                        <span className="rsm-figure">
                            伤势 <b>{injury}</b>
                        </span>
                        {build.rewards.length > 0 && (
                            <span className="rsm-figure">
                                奖励 <b>{build.rewards.length}</b> 个
                            </span>
                        )}
                    </div>
                    {notice && <div className="rsm-notice">{notice}</div>}
                </header>

                <section className="rsm-section">
                    <h2 className="rsm-section-label">最终构筑</h2>
                    <div className="rsm-build">
                        <CharacterPanel mode="view" build={build} />
                    </div>
                </section>

                {selfStats && (
                    <section className="rsm-section">
                        <h2 className="rsm-section-label">本局战斗统计</h2>
                        {/* 宽表由这一层内部横滚（页面不跟着滚）；窄屏下总览表改键值竖排，见 scss */}
                        <div className="rsm-stats">
                            <BattleStatsPanel snapshot={selfStats} names={{ player: build.name }} selfId="player" />
                        </div>
                    </section>
                )}

                <div className="rsm-foot">
                    <button className="rsm-btn rsm-btn-primary" onClick={onRestart}>
                        再来一局
                    </button>
                    <button className="rsm-btn" onClick={onExit}>
                        返回主菜单
                    </button>
                </div>
            </div>
        </div>
    )
}
