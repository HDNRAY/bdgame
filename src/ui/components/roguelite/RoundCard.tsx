import { useState } from 'react'
import type { Round } from '../../../engine/entities/round'
import { getEntity, isEntityType } from '../../../bridge/entity-tooltip'
import { EntityItem } from '../ui/EntityItem/EntityItem'
import './RoundCard.scss'

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

    return (
        <div className={`rc-choice${selected ? ' rc-choice-selected' : ''}`} onClick={() => onSelect(index)}>
            {entity && eType ? (
                <EntityItem entity={entity} type={eType} />
            ) : (
                <span className="rc-label">{choice.label}</span>
            )}
            {choice.description && <span className="rc-desc-text">{choice.description}</span>}
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

    // 单个选项自动触发，跳过 check+confirm
    if (round.choices.length === 1 && !past && onChoice) {
        return (
            <div className={`rc ${past ? 'rc-past' : 'rc-current'}`}>
                <div className="rc-title">{round.title}</div>
                {round.description && <div className="rc-desc">{round.description}</div>}
                {round.result && (
                    <div className={`rc-result ${round.result.won ? 'rc-win' : 'rc-lose'}`}>
                        {round.result.won ? '胜利' : '败北'}
                        {round.result.injuryGained > 0 && <> 伤势 +{round.result.injuryGained}</>}
                    </div>
                )}
                <div className="rc-choices">
                    <ChoiceButton choice={round.choices[0]} index={0} selected={false} onSelect={onChoice} />
                </div>
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
        <div className={`rc ${past ? 'rc-past' : 'rc-current'}`}>
            <div className="rc-title">{round.title}</div>
            {round.description && <div className="rc-desc">{round.description}</div>}
            {round.result && (
                <div className={`rc-result ${round.result.won ? 'rc-win' : 'rc-lose'}`}>
                    {round.result.won ? '胜利' : '败北'}
                    {round.result.injuryGained > 0 && <> 伤势 +{round.result.injuryGained}</>}
                </div>
            )}
            {!past && round.choices.length > 0 && (
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
