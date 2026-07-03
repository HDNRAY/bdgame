import type { Round } from '../../../engine/entities/round'
import './RoundCard.scss'

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
                        <button key={c.id} className="rc-choice" onClick={() => onChoice?.(i)}>
                            <span className="rc-label">{c.label}</span>
                            {c.description && <span className="rc-desc-text">{c.description}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
