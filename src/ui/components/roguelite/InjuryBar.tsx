import './InjuryBar.scss'

interface InjuryBarProps {
    injury: number
}

export function InjuryBar({ injury }: InjuryBarProps) {
    const pct = Math.min(injury, 100)
    return (
        <div className="ib">
            <div className="ib-bar">
                <div className="ib-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="ib-text">伤势 {injury}/100</span>
        </div>
    )
}
