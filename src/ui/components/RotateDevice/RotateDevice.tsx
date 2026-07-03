import './RotateDevice.scss'

/** 手机横屏时显示旋转提示 */
export function RotateDevice() {
    return (
        <div className="rotate-overlay">
            <div className="rotate-msg">请旋转至竖屏</div>
        </div>
    )
}
