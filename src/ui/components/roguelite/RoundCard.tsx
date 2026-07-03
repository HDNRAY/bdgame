import type { Round } from '../../../engine/entities/round'
import { getEntity, isEntityType } from '../../../bridge/entity-tooltip'
import { EntityItem } from '../ui/EntityItem/EntityItem'
import './RoundCard.scss'

function ChoiceButton({
    choice,
    index,
    onChoice,
}: {
    choice: Round['choices'][0]
    index: number
    onChoice: (i: number) => void
}) {
    const entity = isEntityType(choice.type) ? (getEntity(choice.id, choice.type) ?? null) : null

    return (
        <button className="rc-choice" onClick={() => onChoice(index)}>
            {entity ? (
                <EntityItem entity={entity} type={choice.type} />
            ) : (
                <span className="rc-label">{choice.label}</span>
            )}
            {choice.description && <span className="rc-desc-text">{choice.description}</span>}
        </button>
    )
}

interface RoundCardProps {
    round: Round
    past?: boolean
    onChoice?: (index: number) => void
}

export function RoundCard({ round, past, onChoice }: RoundCardProps) {
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
                        <ChoiceButton key={c.id} choice={c} index={i} onChoice={onChoice!} />
                    ))}
                </div>
            )}
        </div>
    )
}
