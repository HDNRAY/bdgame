import type { ReactNode } from 'react'
import './GameplayModal.scss'

interface GameplayModalProps {
    onClose: () => void
}

/** 对战玩法说明弹窗 — 面向玩家的精简版机制导览（完整版见 docs/gameplay-guide.md） */
export function GameplayModal({ onClose }: GameplayModalProps) {
    return (
        <div className="gameplay-overlay" onClick={onClose}>
            <div className="gameplay-modal" onClick={(e) => e.stopPropagation()}>
                <div className="gameplay-header">
                    <div className="gameplay-title">对战玩法</div>
                    <button className="gameplay-close" onClick={onClose} aria-label="关闭">
                        ×
                    </button>
                </div>
                <div className="gameplay-body">
                    <Section title="基础">
                        <p>1v1 单挑。战斗不是回合制：每个招式都有起手、出招、收招的耗时，按时间先后推进，动作利落的人能多抢到出手机会。</p>
                        <p>双方站在一条线上，距离以「米」计。招式有射程区间，只有距离落进区间才打得中；移动、突进、击退都会改变距离。</p>
                        <p>贴身(0-2m)的拳脚匕首贴到 0m，能让刀剑(1-3m)挥空——刀剑最近也要 1m；突刺类招式可以贴身反制。</p>
                    </Section>

                    <Section title="六大属性">
                        <table className="gameplay-table">
                            <thead>
                                <tr>
                                    <th>属性</th>
                                    <th>作用</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>力道</td>
                                    <td>招式伤害 · 招架后减免伤害(20%~60%)</td>
                                </tr>
                                <tr>
                                    <td>体质</td>
                                    <td>气血(80+体质×16) · 缩短负面状态时长</td>
                                </tr>
                                <tr>
                                    <td>身法</td>
                                    <td>闪避 · 移动速度 · 出手更快(起手/收招更利落)</td>
                                </tr>
                                <tr>
                                    <td>灵巧</td>
                                    <td>命中(主) · 暴击率 · 暴击伤害</td>
                                </tr>
                                <tr>
                                    <td>洞察</td>
                                    <td>命中共用 · 暴击率 · 招架率</td>
                                </tr>
                                <tr>
                                    <td>推演</td>
                                    <td>内息回复 · 触发槽数 · 炁/御物/召唤效果</td>
                                </tr>
                            </tbody>
                        </table>
                    </Section>

                    <Section title="内息(AP)">
                        <p>每秒回复 ≈ 推演×0.04 + 0.75。招式消耗 AP（身法可减免），招式耗时约等于消耗×0.4 秒。</p>
                        <p>消耗 AP 会积攒缠劲：每花 1 点 AP → 攒 1 点缠劲。</p>
                    </Section>

                    <Section title="缠劲(上限50)">
                        <p>来源：① 消耗 AP（主来源）② 挨打回气（被打掉血×0.5）③ 功法/奇物按秒回复。</p>
                        <p>用途：放终结技/大招。攒够缠才打得出的高消耗招式。</p>
                        <p>自己卖血换伤的招式不会因此回缠——血不是白流的。</p>
                    </Section>

                    <Section title="命中与暴击">
                        <p>命中率：双方灵巧/身法/洞察对抗决定，约 75% 基准浮动。</p>
                        <p>暴击率：基础 5% + (灵巧+洞察)/200，暴击伤害 1.5 倍起。</p>
                        <p>招架：防守方按灵巧/洞察招架，招架后力道决定减免多少。</p>
                        <p>穿透：无视招架/减伤/护盾。</p>
                    </Section>

                    <Section title="三种持续伤害">
                        <p><b>流血</b>：越动越掉血——你出招、移动、被击中后都会自己流血（层数×1.5）。触发 5 次掉 1 层。</p>
                        <p><b>中毒</b>：定时发作（层数×单跳伤害），每层毒有自己的剩余跳数，推演越高毒缠越久。</p>
                        <p><b>灼烧</b>：每 1 秒跳一次（2×层数），每跳掉 1 层。</p>
                        <p>三种伤害都吃「持续伤害修正」（泼油翻倍、铸火减半等），施加时会触发对方的连招反应（如流血后追击）。</p>
                    </Section>

                    <Section title="出招条件与触发槽">
                        <p>每招可以设一道闸：条件不满足，这招不会被选中。可选气血（自身/目标）、距离或距离区间、内息、缠劲、状态层数、交手时间。</p>
                        <p>条件只决定「准不准用」，不决定「一定用」——满足后仍按伤害与内息效率择优。招式排列顺序不影响出招选择。</p>
                        <p>常见用法：大招设「缠劲≥30」；保命招设「气血&lt;50%」；风筝招设「距离&gt;3m」；收尾招设「目标气血&lt;30%」。</p>
                        <p>触发槽放反应招式（被招架反打、闪避后追击）。槽数由推演决定，一个触发条件只给一招。</p>
                        <p>触发招式不耗内息、只耗缠劲；位移类招式，以及内息消耗 3 点及以上的招式，不能设成触发招式。</p>
                    </Section>

                    <Section title="资源小贴士">
                        <p>血量越低越强的功法/招式带「残血」标签——血祭流可与相关奖励互相搭配。</p>
                        <p>缠回复是独立资源线，是否需要由你的构建决定。</p>
                    </Section>
                </div>
                <div className="gameplay-footer">
                    <button className="gameplay-btn" onClick={onClose}>
                        知道了
                    </button>
                </div>
            </div>
        </div>
    )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="gameplay-section">
            <div className="gameplay-section-title">{title}</div>
            <div className="gameplay-section-body">{children}</div>
        </div>
    )
}
