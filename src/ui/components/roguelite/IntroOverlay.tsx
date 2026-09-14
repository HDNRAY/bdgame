import { useAppStore } from '../../stores/app-store'
import { useTypewriter } from '../../hooks/useTypewriter'
import './IntroOverlay.scss'

interface IntroOverlayProps {
    /** 小字（章节号或时间锚，如「第一章」）；可选 */
    kicker?: string
    /** 大字标题（章名）；可选 */
    title?: string
    /** 正文（支持 \n 分段，逐字打出） */
    text: string
    /** 读完后的进入按钮文案 */
    enterLabel?: string
    onEnter: () => void
}

/**
 * 开场/章节全屏页：小字 + 大标题先出，正文逐字打出（复用 useTypewriter），
 * 点击任意处一次性显示完，读完出现「开始」。
 *
 * 布局稳定：正文按空行/换行切段（段间距交给 CSS margin），并且**先按全文撑出高度**
 * （.io-text-ghost 占位层），打字的文字画在绝对定位的覆盖层上；「开始」按钮也一直在位
 * （未读完时 visibility: hidden）。所以打字过程中标题、正文、按钮都不会移动。
 */
export function IntroOverlay({ kicker, title, text, enterLabel = '开始', onEnter }: IntroOverlayProps) {
    const typewriterEnabled = useAppStore((s) => s.uiConfig.typewriter)
    const tw = useTypewriter(text, { enabled: typewriterEnabled })
    /** 全文分段：占位层用它把正文高度先撑出来 */
    const allParagraphs = text.split('\n').filter((line) => line.trim() !== '')
    /** 已打出的分段 */
    const typedParagraphs = tw.displayText.split('\n').filter((line) => line.trim() !== '')
    const lastIndex = Math.max(typedParagraphs.length - 1, 0)

    return (
        <div className={`intro-overlay${!tw.done ? ' intro-overlay-typing' : ''}`} onClick={!tw.done ? tw.skip : undefined}>
            {kicker && <div className="io-kicker">{kicker}</div>}
            {title && <h1 className="io-title">{title}</h1>}
            <div className="io-text">
                {/* 占位层：完整正文，撑住高度（不可见，不参与交互） */}
                <div className="io-text-ghost" aria-hidden="true">
                    {allParagraphs.map((line, i) => (
                        <p key={i} className="io-p">
                            {line}
                        </p>
                    ))}
                </div>
                {/* 打字层：绝对定位覆盖在占位层上，所以文字增多不会改变布局 */}
                <div className="io-text-live">
                    {typedParagraphs.map((line, i) => (
                        <p key={i} className="io-p">
                            {line}
                            {!tw.done && i === lastIndex && <span className="io-cursor">▌</span>}
                        </p>
                    ))}
                </div>
            </div>
            <button
                className={`io-enter${tw.done ? '' : ' io-enter-hidden'}`}
                onClick={(e) => {
                    e.stopPropagation()
                    onEnter()
                }}
            >
                {enterLabel}
            </button>
        </div>
    )
}
