// ════════════════════════════════════════
//  TournamentBracket — 淘汰赛对阵树（只读展示）
//
//  形态：NBA 转播图那种**一棵真正的对阵树**，不是四列卡片 ——
//    十六强 ─┐
//            ├─ 八强 ─┐
//    十六强 ─┘        ├─ 四强 …
//                     ┘
//  实现：按「谁跟谁能汇合」递归建树（决赛是根，它的两个孩子是两场半决赛，依此类推），
//  每一层是一个 flex 行 `[两个孩子][连接线][本轮的格子]`：
//    - `align-items: center` 让本轮格子**纵向居中于两个来源之间**（对齐关系 = 从这里来）；
//    - 连接线是纯 CSS 伪元素（来源向右的半格横线 + 各自朝中间走的半截竖线 + 到格子的横线）。
//  为什么不用 SVG：纯 CSS 边框/伪元素就够，且与项目其它组件同一套写法（不引依赖、跟随主题变色）。
//
//  尺寸契约（连接线能接上的前提）：所有格子等高 `--tn-box-h`、同层子树等高、
//  行/列间隙固定 `--tn-gap-y` / `--tn-gap-x`；半截竖线长度由 `--tn-kid-h`（孩子子树高）
//  按层推出，见 tournament.scss 的 [data-kid-round] 三档。
//
//  数据：轮次 r+1 的第 j 场由轮次 r 的第 2j / 2j+1 场汇合而来（见 simulator 的
//  fillNextRoundParticipants：targetSlot = floor(slotIndex / 2)），所以按下标两两成对递归即可。
//  渲染直接读 props.tournament（没有副本），每轮 processTournament 更新后重渲染即为最新。
//
//  H5：窄屏不横排四个宽格子，而是把格子改成「名字 / 比分 / 名字」竖排的紧凑格子（≤720px），
//  整棵树仍能塞进 320 宽（外层 .tn-tree-scroll 只是兜底，正常不滚动）；
//  绝不让整页横向溢出。默认纯只读（格子是 div）；传 onMatchClick 才渲染成按钮（DevMode 回放）。
// ════════════════════════════════════════

import type { ReactElement } from 'react'
import type { TournamentData } from '../../../game/entities/tournament'
import './tournament.scss'

interface TournamentBracketProps {
    tournament: TournamentData
    /** 正在进行的淘汰赛轮次（0-3）；只用于高亮，不传则不标 */
    activeRound?: number | null
    /** 对局行点击回调（matchKey = ko-<轮次>-<槽位>）；不传则整块只读 */
    onMatchClick?: (matchKey: string) => void
}

export function TournamentBracket({ tournament, activeRound = null, onMatchClick }: TournamentBracketProps) {
    const rounds = tournament.knockoutStage.rounds

    const nameOf = (id: string | null | undefined): string => {
        if (!id) return '待定'
        return tournament.participants.find((p) => p.id === id)?.name ?? id
    }
    /** 玩家本人加下划线 */
    const playerCls = (id: string | null | undefined): string =>
        id && id === tournament.playerId ? ' tn-is-player' : ''

    /** 一个格子（一场对局）：左名 / 比分 / 右名，胜者高亮；未定显示「待定」 */
    const renderCell = (round: number, index: number): ReactElement => {
        const km = rounds[round]?.matches[index]
        if (!km) return <div className="tn-ko-match tn-empty" />
        const m = km.match
        const finished = m !== null && m.winnerId !== null && m.winnerId !== undefined
        const [aId, bId] = km.participantIds
        const cls = [
            'tn-ko-match',
            finished ? 'tn-finished' : '',
            activeRound === km.round ? 'tn-current' : '',
            onMatchClick && finished ? 'tn-match-btn' : '',
        ]
            .filter(Boolean)
            .join(' ')
        const row =
            aId && bId ? (
                <>
                    <b className={`tn-side${playerCls(aId)} ${m?.winnerId === aId ? 'tn-win' : ''}`}>
                        {nameOf(aId)}
                    </b>
                    <span className="tn-score">{m ? `${m.scores[0]} : ${m.scores[1]}` : 'vs'}</span>
                    <b className={`tn-side tn-side-b${playerCls(bId)} ${m?.winnerId === bId ? 'tn-win' : ''}`}>
                        {nameOf(bId)}
                    </b>
                </>
            ) : (
                <span className="tn-tbd">待定</span>
            )
        const matchKey = `ko-${km.round}-${km.slotIndex}`
        return onMatchClick ? (
            <button className={cls} disabled={!finished} onClick={() => onMatchClick(matchKey)}>
                {row}
            </button>
        ) : (
            <div className={cls}>{row}</div>
        )
    }

    /** 递归建树：round=0 是叶子（十六强），往上每层由两个孩子汇合 */
    const renderNode = (round: number, index: number): ReactElement => {
        if (round === 0) {
            return <div className="tn-node tn-leaf">{renderCell(round, index)}</div>
        }
        return (
            <div className="tn-node" data-kid-round={round - 1}>
                <div className="tn-kids">
                    <div className="tn-kid">{renderNode(round - 1, index * 2)}</div>
                    <div className="tn-kid">{renderNode(round - 1, index * 2 + 1)}</div>
                </div>
                <div className="tn-link" aria-hidden="true" />
                {renderCell(round, index)}
            </div>
        )
    }

    const rootRound = Math.max(rounds.length - 1, 0)

    return (
        <div className="tn-bracket">
            {/* 读图方向的小图例（左右 = 轮次推进方向） */}
            <div className="tn-legend" aria-hidden="true">
                {rounds.map((r, i) => (
                    <span key={r.round}>
                        {i > 0 && <span className="tn-legend-arrow"> → </span>}
                        {r.label}
                    </span>
                ))}
            </div>
            <div className="tn-tree-scroll">
                <div className="tn-tree">{renderNode(rootRound, 0)}</div>
            </div>
        </div>
    )
}
