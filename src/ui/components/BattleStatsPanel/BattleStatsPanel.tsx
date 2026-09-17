import { useMemo, useState, type ReactNode } from 'react'
import type { ActionStat, BattleStatsSnapshot, SnapshotChar } from '../../../engine/combat/battle-stats'
import './BattleStatsPanel.scss'

/**
 * 战斗统计面板（纯数据驱动，读 `BattleStatsSnapshot`）。
 *
 * 数据怎么算的全部在引擎层（`engine/combat/battle-stats.ts`，口径见 `docs/battle-stats-design.md`），
 * 这里只做展示：概览 / 输出 / 承伤 / 资源与距离。多场聚合用 `BattleStats.mergeSnapshots()`，
 * 面板自己只按 `snapshot.battles` 换算「每场」。
 */

type TabId = 'overview' | 'offense' | 'defense' | 'resource'

const TABS: Array<{ id: TabId; label: string }> = [
    { id: 'overview', label: '概览' },
    { id: 'offense', label: '输出' },
    { id: 'defense', label: '承伤' },
    { id: 'resource', label: '资源与距离' },
]

const r1 = (n: number): number => Math.round(n * 10) / 10
const pct = (num: number, den: number): string => (den > 0 ? `${((num / den) * 100).toFixed(1)}%` : '—')
const per = (n: number, battles: number): number => (battles > 0 ? r1(n / battles) : 0)

interface Props {
    snapshot: BattleStatsSnapshot
    /** 角色 id → 显示名（缺省用 id） */
    names?: Record<string, string>
    /** 视角角色：概览里排在最前，明细默认只展开它 */
    selfId?: string
    /** 面板标题（如「vs 唐柔」）；省略则不渲染标题栏 */
    title?: string
    defaultTab?: TabId
}

export function BattleStatsPanel({ snapshot, names, selfId, title, defaultTab = 'overview' }: Props) {
    const [tab, setTab] = useState<TabId>(defaultTab)
    const [showEnemy, setShowEnemy] = useState(false)
    const nameOf = (id: string) => names?.[id] ?? id
    /** 视角角色在前（`selfId` 缺省取第一个） */
    const chars = useMemo(() => {
        const list = snapshot.chars
        const self = selfId ? list.find((c) => c.id === selfId) : list[0]
        if (!self) return list
        return [self, ...list.filter((c) => c !== self)]
    }, [snapshot, selfId])

    if (chars.length === 0) return <div className="bsp bsp-empty">无统计数据</div>

    const self = chars[0]
    const others = chars.slice(1)
    const battles = snapshot.battles

    return (
        <div className="bsp">
            <div className="bsp-head">
                {title && <h4 className="bsp-title">{title}</h4>}
                <div className="bsp-tabs">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            className={`bsp-tab${tab === t.id ? ' on' : ''}`}
                            onClick={() => setTab(t.id)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                <span className="bsp-sample">{battles > 1 ? `${battles} 场合计` : '单场'}</span>
            </div>

            {tab === 'overview' && <Overview chars={chars} nameOf={nameOf} battles={battles} />}
            {tab === 'offense' && (
                <>
                    <Offense char={self} nameOf={nameOf} battles={battles} />
                    {others.length > 0 && (
                        <ToggleSection
                            className="bsp-enemy"
                            label={showEnemy ? '收起对手' : othersLabel(others, nameOf)}
                            open={showEnemy}
                            onToggle={() => setShowEnemy((v) => !v)}
                        >
                            {others.map((c) => (
                                <Offense key={c.id} char={c} nameOf={nameOf} battles={battles} />
                            ))}
                        </ToggleSection>
                    )}
                </>
            )}
            {tab === 'defense' && (
                <>
                    <Defense char={self} nameOf={nameOf} battles={battles} />
                    {others.map((c) => (
                        <Defense key={c.id} char={c} nameOf={nameOf} battles={battles} />
                    ))}
                </>
            )}
            {tab === 'resource' && (
                <>
                    {chars.map((c) => (
                        <Resource key={c.id} char={c} nameOf={nameOf} battles={battles} />
                    ))}
                </>
            )}
        </div>
    )
}

// ── 概览：一眼看完双方关键数字 ──

/** 对手多于两个时不再列名字（聚合了 30 多个对手时名字会糊成一片） */
function othersLabel(others: SnapshotChar[], nameOf: (id: string) => string): string {
    if (others.length > 2) return `展开对手（${others.length} 个）`
    return `展开对手（${others.map((c) => nameOf(c.id)).join(' / ')}）`
}
function Overview({
    chars,
    nameOf,
    battles,
}: {
    chars: SnapshotChar[]
    nameOf: (id: string) => string
    battles: number
}) {
    const rows: Array<{ label: string; hint?: string; cell: (c: SnapshotChar) => string }> = [
        { label: '输出/场', hint: '直接 + 持续 + 附伤', cell: (c) => `${per(c.dealt, battles)}` },
        { label: '承伤/场', hint: '括号内为减免量', cell: (c) => `${per(c.taken, battles)}（${per(c.mitigated, battles)}）` },
        { label: '治疗/场', hint: '有效（溢出）', cell: (c) => `${per(c.heal, battles)}（${per(c.overheal, battles)}）` },
        { label: '出手/场', hint: 'attack_start 次数', cell: (c) => `${per(c.casts, battles)}` },
        { label: '命中率', hint: '命中 / 判定（连发一招多判）', cell: (c) => pct(c.hits, c.hits + c.dodged) },
        { label: '暴击率', hint: '暴击 / 命中', cell: (c) => pct(c.crits, c.hits) },
        { label: '被闪避率', hint: '被闪避 / 判定', cell: (c) => pct(c.dodged, c.hits + c.dodged) },
        { label: '被招架率', hint: '被招架 / 命中', cell: (c) => pct(c.parried, c.hits) },
        { label: '失手', cell: (c) => `${c.fumbles}` },
        { label: '内息消耗/场', cell: (c) => `${per(c.res.apSpent, battles)}` },
        { label: '缠劲消耗/场', cell: (c) => `${per(c.res.chanSpent, battles)}` },
        {
            label: '平均交战距离',
            hint: '1m 内占比',
            cell: (c) => (c.distanceSamples > 0 ? `${r1(c.distanceSum / c.distanceSamples)}m（${pct(c.closeSamples, c.distanceSamples)}）` : '—'),
        },
        {
            label: '挂状态',
            hint: '成功 / 尝试',
            cell: (c) => (c.statusTried > 0 ? `${c.statusApplied}/${c.statusTried}（${pct(c.statusApplied, c.statusTried)}）` : '—'),
        },
    ]
    return (
        <table className="bsp-table bsp-overview">
            <thead>
                <tr>
                    <th>指标</th>
                    {chars.map((c) => (
                        <th key={c.id}>{nameOf(c.id)}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((row) => (
                    <tr key={row.label}>
                        <td className="bsp-metric">
                            {row.label}
                            {row.hint && <em>{row.hint}</em>}
                        </td>
                        {chars.map((c) => (
                            <td key={c.id}>{row.cell(c)}</td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

// ── 输出：按招式明细 ──

function Offense({ char, nameOf, battles }: { char: SnapshotChar; nameOf: (id: string) => string; battles: number }) {
    const actions = [...char.actions.values()]
        .map((a) => ({ a, total: a.damage + a.dot + a.bonus }))
        .filter((x) => x.a.casts > 0 || x.total > 0)
        .sort((x, y) => y.total - x.total)
    return (
        <div className="bsp-block">
            <div className="bsp-block-head">
                <b>{nameOf(char.id)}</b>
                <span>
                    合计 {per(char.dealt, battles)}/场（直接 {per(char.dealtDirect, battles)} · 持续 {per(char.dealtDot, battles)} · 附伤{' '}
                    {per(char.dealtBonus, battles)}）
                </span>
            </div>
            {actions.length === 0 ? (
                <div className="bsp-none">没有出手记录</div>
            ) : (
                <table className="bsp-table">
                    <thead>
                        <tr>
                            <th>招式</th>
                            <th>出手/场</th>
                            <th>触发</th>
                            <th>命中率</th>
                            <th>暴击</th>
                            <th>被闪避</th>
                            <th>被招架</th>
                            <th>伤害/场</th>
                            <th>占比</th>
                            <th>构成</th>
                        </tr>
                    </thead>
                    <tbody>
                        {actions.map(({ a, total }) => (
                            <tr key={a.actionId}>
                                <td>{a.actionName}</td>
                                <td>{per(a.casts, battles)}</td>
                                <td>{a.triggeredCasts > 0 ? a.triggeredCasts : ''}</td>
                                <td>{pct(a.hits, a.hits + a.dodged)}</td>
                                <td>{a.crits > 0 ? a.crits : ''}</td>
                                <td>{a.dodged > 0 ? a.dodged : ''}</td>
                                <td>{a.parried > 0 ? a.parried : ''}</td>
                                <td>{per(total, battles)}</td>
                                <td>{char.dealt > 0 ? pct(total, char.dealt) : '—'}</td>
                                <td className="bsp-parts">{partsOf(a, battles)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    )
}

function partsOf(a: ActionStat, battles: number): string {
    const out: string[] = []
    if (a.dot > 0) out.push(`持续 ${per(a.dot, battles)}`)
    if (a.bonus > 0) out.push(`附伤 ${per(a.bonus, battles)}`)
    if (a.heal > 0) out.push(`治疗 ${per(a.heal, battles)}`)
    return out.join(' · ')
}

// ── 承伤 ──

function Defense({ char, nameOf, battles }: { char: SnapshotChar; nameOf: (id: string) => string; battles: number }) {
    if (char.taken <= 0) return null
    const rows = [...char.takenByAction.values()].sort((a, b) => b.amount - a.amount)
    return (
        <div className="bsp-block">
            <div className="bsp-block-head">
                <b>{nameOf(char.id)}</b>
                <span>
                    承伤 {per(char.taken, battles)}/场（减免 {per(char.mitigated, battles)}）
                </span>
            </div>
            <table className="bsp-table">
                <thead>
                    <tr>
                        <th>来源</th>
                        <th>伤害/场</th>
                        <th>占比</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((v) => (
                        <tr key={v.actionId}>
                            <td>{v.actionName}</td>
                            <td>{per(v.amount, battles)}</td>
                            <td>{pct(v.amount, char.taken)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

// ── 资源与距离 ──

function Resource({ char, nameOf, battles }: { char: SnapshotChar; nameOf: (id: string) => string; battles: number }) {
    const r = char.res
    const line = (label: string, main: string, detail: string[]) => (
        <div className="bsp-res-row" key={label}>
            <span className="bsp-res-label">{label}</span>
            <span className="bsp-res-main">{main}/场</span>
            {detail.length > 0 && <span className="bsp-res-detail">{detail.join(' · ')}</span>}
        </div>
    )
    const apDetail: string[] = []
    if (r.apGained > 0) apDetail.push(`回复 ${r1(r.apGained / Math.max(1, battles))}`)
    if (r.apWasted > 0) apDetail.push(`浪费 ${r1(r.apWasted / Math.max(1, battles))}`)
    if (r.apDrained > 0) apDetail.push(`被扣 ${r1(r.apDrained / Math.max(1, battles))}`)
    const chanDetail: string[] = []
    if (r.chanGained > 0) chanDetail.push(`获得 ${r1(r.chanGained / Math.max(1, battles))}`)
    if (r.chanOverflow > 0) chanDetail.push(`溢出 ${r1(r.chanOverflow / Math.max(1, battles))}`)
    return (
        <div className="bsp-block">
            <div className="bsp-block-head">
                <b>{nameOf(char.id)}</b>
                <span>
                    平均交战距离{' '}
                    {char.distanceSamples > 0 ? `${r1(char.distanceSum / char.distanceSamples)}m` : '—'} · 1m 内{' '}
                    {pct(char.closeSamples, char.distanceSamples)}
                </span>
            </div>
            {line('内息消耗', `${per(r.apSpent, battles)}`, apDetail)}
            {line('缠劲消耗', `${per(r.chanSpent, battles)}`, chanDetail)}
            <p className="bsp-note">
                消耗是「花掉的」，括号里是流水：回复 / 浪费（缠满截断）/ 被扣（打断、持续消耗）。被动的武器与奇物自扣也计在内。
            </p>
        </div>
    )
}

// ── 折叠块 ──

function ToggleSection({
    className,
    label,
    open,
    onToggle,
    children,
}: {
    className?: string
    label: string
    open: boolean
    onToggle: () => void
    children: ReactNode
}) {
    return (
        <div className={className}>
            <button className="bsp-toggle" onClick={onToggle}>
                {label}
            </button>
            {open && children}
        </div>
    )
}
