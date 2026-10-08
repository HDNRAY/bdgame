import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRogueliteStore } from '../../../stores/roguelite-store'
import { RunSummaryPanel } from '../../../components/roguelite/RunSummaryPanel'
import { endingTitle } from '../../../components/roguelite/ending-title'
import { createSampleRunSummary } from './sample-data'

/**
 * DevMode「结算页」tab：渲染的是真局结束时的**同一个** `RunSummaryPanel`（不另写展示）。
 *
 * 数据源：
 *  - store 里有真局（选过故事线或打过正式战斗）→ 用真数据（战绩 / 统计 / 最终构筑）；
 *  - 还没开局（空 store）→ 用确定性样例，并在页面上标一句「样例数据」。
 *
 * 按钮与真局一致：再来一局 = `reset()`；返回主菜单 = 回首页。
 */
export function RunSummaryTab() {
    const gameState = useRogueliteStore((s) => s.gameState)
    const reset = useRogueliteStore((s) => s.reset)
    const navigate = useNavigate()
    const sample = useMemo(() => createSampleRunSummary(), [])

    // 「有正在进行 / 已结束的真局」：选过故事线（开局）或打过正式战斗（runBattles）
    const live = !!gameState && (!!gameState.runBattles || !!gameState.build.story)

    if (!live || !gameState) {
        return (
            <RunSummaryPanel
                title={sample.title}
                build={sample.build}
                injury={sample.injury}
                battles={sample.battles}
                stats={sample.stats}
                onRestart={reset}
                onExit={() => navigate('/')}
                notice="样例数据"
            />
        )
    }

    return (
        <RunSummaryPanel
            title={gameState.finished ? endingTitle(gameState.flags) : '对局进行中'}
            build={gameState.build}
            injury={gameState.injury}
            battles={gameState.runBattles}
            stats={gameState.runStats}
            onRestart={reset}
            onExit={() => navigate('/')}
            notice="当前对局数据"
        />
    )
}
