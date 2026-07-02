import type { CharacterBuild } from '../../../engine/entities/character-build'

interface PrepDialogProps {
    unspentCultPoints: number
    build: CharacterBuild
    onPrepare: () => void
    onContinue: () => void
    onClose: () => void
    onDisable: () => void
}

export function PrepDialog({ unspentCultPoints, build, onPrepare, onContinue, onClose, onDisable }: PrepDialogProps) {
    const hasUnsetTriggers = build.actionConfigs?.some((ac) => !ac.triggerId)

    return (
        <div className="qr-overlay" onClick={onClose}>
            <div className="qr-prep-dialog" onClick={(e) => e.stopPropagation()}>
                <h3>⚔ 备战提醒</h3>
                {unspentCultPoints > 0 && (
                    <p>
                        有未使用的修炼点：<span className="qr-prep-points">{unspentCultPoints}</span> 点
                    </p>
                )}
                {hasUnsetTriggers && <p>有未设置触发条件的招式</p>}
                <div className="qr-prep-buttons">
                    <button className="qr-btn qr-btn-prepare" onClick={onPrepare}>
                        ⚔ 备战
                    </button>
                    <button className="qr-btn" onClick={onContinue}>
                        继续
                    </button>
                </div>
                <label className="qr-prep-checkbox">
                    <input type="checkbox" onChange={onDisable} />
                    本局不再显示此提示
                </label>
            </div>
        </div>
    )
}
