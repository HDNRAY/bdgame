import { useEffect, useRef, useState } from 'react'
import type { Round } from '../../../game/entities/round'
import { getEntity, isEntityType, type EntityDef, type EntityType } from '../../../bridge/entity-tooltip'
import { getWeaponOverlay } from '../../pixel-sprites'
import { PixelCanvas } from '../ui/PixelCanvas/PixelCanvas'
import { useTypewriter } from '../../hooks/useTypewriter'
import { useAppStore } from '../../stores/app-store'
import { WeaponTooltip } from '../tooltip-contents/WeaponTooltip'
import { ActionTooltip } from '../tooltip-contents/ActionTooltip'
import { PassiveTooltip } from '../tooltip-contents/PassiveTooltip'
import { ArtifactTooltip } from '../tooltip-contents/ArtifactTooltip'
import type { WeaponDef } from '../../../data/weapons/weapons'
import type { ActionDefinition, Artifact, Passive } from '../../../engine'
import './RoundCard.scss'

/** 实体详情内联块：把 tooltip 内容直接铺在选项卡里（移动端无 hover，内容必须可见） */
function EntityDetails({ entity, type }: { entity: EntityDef; type: EntityType }) {
    switch (type) {
        case 'weapon':
            return <WeaponTooltip weapon={entity as WeaponDef} />
        case 'action':
            return <ActionTooltip action={entity as ActionDefinition} />
        case 'passive':
            return <PassiveTooltip passive={entity as Passive} />
        case 'artifact':
            return <ArtifactTooltip artifact={entity as Artifact} />
        default:
            return null
    }
}

function ChoiceButton({
    choice,
    index,
    selected,
    onSelect,
}: {
    choice: Round['choices'][0]
    index: number
    selected: boolean
    onSelect: (i: number) => void
}) {
    const entity = isEntityType(choice.type) ? (getEntity(choice.id, choice.type) ?? null) : null
    const eType = isEntityType(choice.type) ? choice.type : null
    // 武器选项画武器本体那张（通用图 overlay）——逐姿势图是握在手上的形态，单看会很怪
    const weaponOverlay = eType === 'weapon' ? getWeaponOverlay(choice.id) : null
    // 实体选项：内联详情已含实体描述，外部 choice.description 若与之相同则去重（保留叙事类附加描述）
    const descDup = !!entity && !!choice.description && choice.description === entity.description

    return (
        <div className={`rc-choice${selected ? ' rc-choice-selected' : ''}`} onClick={() => onSelect(index)}>
            {entity && eType ? (
                <div className="rc-entity">
                    <div className="rc-entity-head">
                        {weaponOverlay && weaponOverlay.pixels.length > 0 && (
                            <PixelCanvas overlay={weaponOverlay} className="rc-weapon-art" />
                        )}
                        <span className="rc-label">{entity.name}</span>
                    </div>
                    <div className="rc-entity-details">
                        <EntityDetails entity={entity} type={eType} />
                    </div>
                </div>
            ) : (
                <span className="rc-label">{choice.label}</span>
            )}
            {!descDup && choice.description && <span className="rc-desc-text">{choice.description}</span>}
        </div>
    )
}

/**
 * 需要时把元素送进可见区域，返回是否真的滚了。
 *
 * 抽成纯函数是为了可测：本项目没有 jsdom，`useEffect` 在测试里跑不起来，
 * 只有把「要不要滚、怎么滚」的判定独立出来才测得到（见 `ui/__tests__/round-card-reveal.test.ts`）。
 * 参数按结构取最小形状（不是整个 HTMLElement），测试里用假元素就能调。
 *
 * 已经完整落在可见区域（含 1px 容差）就什么都不做 —— 既保证不会每次渲染都滚，
 * 也保证玩家自己滚动看历史时不会被拉回来。
 */
// 这是本文件唯一的非组件导出（只为回归测试存在），故关掉 fast-refresh 的这条告警
// eslint-disable-next-line react-refresh/only-export-components
export function revealIfNeeded(
    el: {
        getBoundingClientRect: () => { top: number; bottom: number }
        scrollIntoView: (arg: ScrollIntoViewOptions) => void
    },
    view: { top: number; bottom: number },
    reduceMotion: boolean,
): boolean {
    const rect = el.getBoundingClientRect()
    if (rect.top >= view.top - 1 && rect.bottom <= view.bottom + 1) return false
    el.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' })
    return true
}

/**
 * 新出现的交互内容自动进入视野。
 *
 * 竖屏 H5 上 `.rs-rounds` 是固定高度的滚动容器（下方还要给角色面板让出 35vh），
 * 打字结束后出现的选项、选中选项后出现的「确认」，都可能落在折线以下，玩家看不到。
 *
 * 只在该内容「从无到有」的那一次触发（effect 依赖 appeared 这个布尔量，不是每次渲染）。
 */
function useRevealOnAppear<T extends HTMLElement>(appeared: boolean) {
    const ref = useRef<T>(null)
    useEffect(() => {
        const el = ref.current
        if (!appeared || !el) return
        // 最近的滚动容器（本页是 .rs-rounds）；没有滚动容器时退回视口
        const scroller = el.closest('.rs-rounds')
        const view = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight }
        // 尊重 prefers-reduced-motion：该偏好下即时跳转，不做平滑动画
        revealIfNeeded(el, view, window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    }, [appeared])
    return ref
}

interface RoundCardProps {
    round: Round
    past?: boolean
    onChoice?: (index: number) => void
}

export function RoundCard({ round, past, onChoice }: RoundCardProps) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
    const typewriterEnabled = useAppStore((s) => s.uiConfig.typewriter)
    const desc = useTypewriter(round.description ?? '', {
        enabled: !past && typewriterEnabled,
    })
    // 两处新内容：打字结束（或被点掉）后出现的选项、选中某个选项后出现的「确认」
    const showChoices = !past && desc.done && round.choices.length > 0
    const choicesRef = useRevealOnAppear<HTMLDivElement>(showChoices)
    const confirmRef = useRevealOnAppear<HTMLButtonElement>(!past && selectedIndex !== null)

    // 单选项：无需确认按钮，选择即执行
    if (round.choices.length === 1 && !past && onChoice) {
        return (
            <div className={`rc ${past ? 'rc-past' : 'rc-current'}`} onClick={!desc.done ? desc.skip : undefined}>
                <div className="rc-title">{round.title}</div>
                {round.description && (
                    <div className={`rc-desc${!desc.done ? ' rc-desc-typing' : ''}`}>
                        {desc.displayText}
                        {!desc.done && <span className="rc-cursor">▌</span>}
                    </div>
                )}
                {round.result && (
                    <div className={`rc-result ${round.result.won ? 'rc-win' : 'rc-lose'}`}>
                        {round.result.won ? '胜利' : '败北'}
                        {round.result.injuryGained > 0 && <> 伤势 +{round.result.injuryGained}</>}
                    </div>
                )}
                {desc.done && (
                    <div className="rc-choices" ref={choicesRef}>
                        <ChoiceButton choice={round.choices[0]} index={0} selected={false} onSelect={onChoice} />
                    </div>
                )}
            </div>
        )
    }

    const handleSelect = (index: number) => {
        setSelectedIndex(index === selectedIndex ? null : index)
    }

    const handleConfirm = () => {
        if (selectedIndex !== null && onChoice) {
            onChoice(selectedIndex)
            setSelectedIndex(null)
        }
    }

    return (
        <div className={`rc ${past ? 'rc-past' : 'rc-current'}`} onClick={!desc.done ? desc.skip : undefined}>
            <div className="rc-title">{round.title}</div>
            {round.description && (
                <div className={`rc-desc${!desc.done ? ' rc-desc-typing' : ''}`}>
                    {desc.displayText}
                    {!desc.done && <span className="rc-cursor">▌</span>}
                </div>
            )}
            {round.result && (
                <div className={`rc-result ${round.result.won ? 'rc-win' : 'rc-lose'}`}>
                    {round.result.won ? '胜利' : '败北'}
                    {round.result.injuryGained > 0 && <> 伤势 +{round.result.injuryGained}</>}
                </div>
            )}
            {past && round.chosen && round.choices.length > 1 && (
                <div className="rc-choices">
                    <div className="rc-choice rc-choice-selected rc-chosen">
                        <span className="rc-chosen-mark">已选</span>
                        <span className="rc-label">{round.chosen.label}</span>
                    </div>
                </div>
            )}
            {showChoices && (
                <div className="rc-choices" ref={choicesRef}>
                    {round.choices.map((c, i) => (
                        <ChoiceButton
                            key={c.id}
                            choice={c}
                            index={i}
                            selected={i === selectedIndex}
                            onSelect={handleSelect}
                        />
                    ))}
                    {selectedIndex !== null && (
                        <button className="rc-confirm" ref={confirmRef} onClick={handleConfirm}>
                            确认
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
