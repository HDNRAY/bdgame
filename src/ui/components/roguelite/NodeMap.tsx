import './NodeMap.scss'

interface NodeMapProps {
    nodeIndex: number
}

export function NodeMap({ nodeIndex }: NodeMapProps) {
    const cells = Array.from({ length: 33 }, (_, i) => ({
        n: i + 1,
        boss: i + 1 === 11 || i + 1 === 22 || i + 1 === 33,
    }))

    return (
        <div className="nm">
            {[0, 11, 22].map((offset) => (
                <div key={offset} className="nm-row">
                    {cells.slice(offset, offset + 11).map((c) => (
                        <span
                            key={c.n}
                            className={[
                                'nm-dot',
                                c.n === nodeIndex ? 'nm-current' : '',
                                c.n < nodeIndex ? 'nm-done' : '',
                                c.boss ? 'nm-boss' : '',
                            ].join(' ')}
                        />
                    ))}
                </div>
            ))}
        </div>
    )
}
