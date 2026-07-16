import { useState } from 'react'
import type { Round } from '../../../game/entities/round'
import { getEntity, isEntityType } from '../../../bridge/entity-tooltip'
import { EntityItem } from '../ui/EntityItem/EntityItem'
import { useTypewriter } from '../../hooks/useTypewriter'
import { useAppStore } from '../../stores/app-store'
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
