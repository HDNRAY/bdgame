// ════════════════════════════════════════
//  MetaPanel — 元进度存档（终局系统）的查看 / 清档 / 导出（DevMode）
//  设计见 docs/ending-design.md 第四节。
//  导出 JSON 可直接存成 scripts/champion-build.json，再用
//  `npm run tour -- champion_boss --champion=scripts/champion-build.json` 测隐藏boss 胜率。
// ════════════════════════════════════════

import { useState } from 'react'
import { ATTR_CN, type AttrName } from '../../../../engine/entities/attributes'
import { CHAMPION_BOSS_NAME, championImplantIds } from '../../../../game/champion-boss'
import { META_SAVE_KEY, loadMeta, resetMeta, type MetaSave } from '../../../../game/meta-save'
import { ENDING_NAMES } from '../../../../data/story-intros'
import './MetaPanel.scss'

const ATTRS: AttrName[] = ['strength', 'vitality', 'agility', 'dexterity', 'insight', 'wisdom']

function fmtTime(at?: number): string {
    if (!at) return '—'
    const d = new Date(at)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function MetaPanel() {
    const [meta, setMeta] = useState<MetaSave>(() => loadMeta())
    const [copied, setCopied] = useState(false)

    const refresh = () => setMeta(loadMeta())

    const onClear = () => {
        if (!window.confirm('清空元进度存档？得魁记录与「最近一次得魁 build」都会丢。')) return
        resetMeta()
        refresh()
    }

    const json = JSON.stringify(meta, null, 2)
    const onCopy = async () => {
        try {
            await navigator.clipboard.writeText(json)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        } catch {
            setCopied(false)
        }
    }

    const build = meta.lastWinBuild

    return (
        <div className="meta-panel">
            <div className="meta-panel-head">
                <h2>元进度</h2>
                <div className="meta-panel-actions">
                    <button onClick={refresh}>刷新</button>
                    <button onClick={onCopy}>{copied ? '已复制' : '复制 JSON'}</button>
                    <button className="danger" onClick={onClear}>
                        清档
                    </button>
                </div>
            </div>
            <p className="meta-panel-key">
                localStorage: <code>{META_SAVE_KEY}</code>
            </p>

            <table className="meta-panel-table">
                <tbody>
                    <tr>
                        <th>总轮数</th>
                        <td>{meta.runs}</td>
                        <th>得魁数</th>
                        <td>{meta.clears}</td>
                    </tr>
                    <tr>
                        <th>得魁（回到过去）</th>
                        <td>{meta.loopClears}</td>
                        <th>带着遗憾向前</th>
                        <td>{meta.trueEndingDone ? '已达成' : '未达成'}</td>
                    </tr>
                    <tr>
                        <th>击败隐藏boss</th>
                        <td>{meta.bossWins}</td>
                        <th>败给隐藏boss</th>
                        <td>{meta.bossLosses}</td>
                    </tr>
                    <tr>
                        <th>最近得魁</th>
                        <td>{fmtTime(meta.lastWinAt)}</td>
                        <th>最近结局</th>
                        <td>{meta.lastWinEnding ? ENDING_NAMES[meta.lastWinEnding] : '—'}</td>
                    </tr>
                    <tr>
                        <th>最漂亮的一次</th>
                        <td colSpan={3}>
                            {meta.bestClear
                                ? `伤势 ${meta.bestClear.injuries} · 奖励 ${meta.bestClear.rewards} · ${fmtTime(meta.bestClear.at)}`
                                : '—'}
                        </td>
                    </tr>
                </tbody>
            </table>

            <h3>下一局的隐藏boss（{CHAMPION_BOSS_NAME}）</h3>
            {build ? (
                <>
                    <table className="meta-panel-table">
                        <tbody>
                            <tr>
                                <th>名字</th>
                                <td>{build.name}</td>
                                <th>故事线</th>
                                <td>{build.story || '—'}</td>
                            </tr>
                            <tr>
                                <th>主手 / 副手</th>
                                <td>
                                    {build.weapon} / {build.offhand ?? '—'}
                                </td>
                                <th>奖励 / 义体</th>
                                <td>
                                    {build.rewards.length} / {championImplantIds().length + 1}
                                </td>
                            </tr>
                            <tr>
                                <th>存档基础属性</th>
                                <td colSpan={3}>
                                    {ATTRS.map((a) => `${ATTR_CN[a]} ${build.baseAttrs[a] ?? 0}`).join(' · ')}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <p className="meta-panel-hint">
                        上面是存档里的值，仅供对照：boss 上场时不用它 —— 六项一律从 7 点起算，再叠上这份奖励与 14
                        件义体（共 48 点属性，平均每项 8 点）。
                    </p>
                </>
            ) : (
                <p className="meta-panel-hint">没有得魁记录 —— 下一局走到山腹时不会出现那具躯体。</p>
            )}

            <h3>存档 JSON</h3>
            <textarea className="meta-panel-json" readOnly value={json} spellCheck={false} />
            <p className="meta-panel-hint">
                存成 <code>scripts/champion-build.json</code>，然后跑{' '}
                <code>npm run tour -- champion_boss --champion=scripts/champion-build.json</code> 测隐藏boss 胜率。
            </p>
        </div>
    )
}
