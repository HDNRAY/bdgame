import './RotateDevice.scss'

/** 竖屏时显示「请旋转设备」覆盖层 */
export function RotateDevice() {
    return (
        <div className="rotate-overlay">
            <div className="rotate-msg">请旋转设备</div>
        </div>
    )
}
