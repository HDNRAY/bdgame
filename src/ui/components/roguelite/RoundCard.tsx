import { useState } from 'react'
import type { Round } from '../../../game/entities/round'
import { getEntity, isEntityType, type EntityDef, type EntityType } from '../../../bridge/entity-tooltip'
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
    // 实体选项：内联详情已含实体描述，外部 choice.description 若与之相同则去重（保留叙事类附加描述）
    const descDup = !!entity && !!choice.description && choice.description === entity.description

    return (
        <div className={`rc-choice${selected ? ' rc-choice-selected' : ''}`} onClick={() => onSelect(index)}>
            {entity && eType ? (
                <div className="rc-entity">
                    <span className="rc-label">{entity.name}</span>
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
                    <div className="rc-choices">
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
            {desc.done && !past && round.choices.length > 0 && (
                <div className="rc-choices">
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
                        <button className="rc-confirm" onClick={handleConfirm}>
                            确认
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
