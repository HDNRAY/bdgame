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
 */
export function IntroOverlay({ kicker, title, text, enterLabel = '开始', onEnter }: IntroOverlayProps) {
    const typewriterEnabled = useAppStore((s) => s.uiConfig.typewriter)
    const tw = useTypewriter(text, { enabled: typewriterEnabled })
    // 按空行/换行切段：段间距交给 CSS 的 margin，不再靠空白行撑（原来行距会翻倍）
    const paragraphs = tw.displayText.split('\n').filter((line) => line.trim() !== '')
    const lastIndex = paragraphs.length - 1

    return (
        <div className={`intro-overlay${!tw.done ? ' intro-overlay-typing' : ''}`} onClick={!tw.done ? tw.skip : undefined}>
            {kicker && <div className="io-kicker">{kicker}</div>}
            {title && <h1 className="io-title">{title}</h1>}
            <div className="io-text">
                {paragraphs.map((line, i) => (
                    <p key={i} className="io-p">
                        {line}
                        {!tw.done && i === lastIndex && <span className="io-cursor">▌</span>}
                    </p>
                ))}
            </div>
            {tw.done && (
                <button className="io-enter" onClick={(e) => { e.stopPropagation(); onEnter() }}>
                    {enterLabel}
                </button>
            )}
        </div>
    )
}
