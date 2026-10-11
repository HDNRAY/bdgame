import { useEffect } from 'react'

/**
 * 打字中的「Enter / Space 跳过」—— 与「点击任意处跳过」同一个心智模型。
 *
 * 项目惯例（IntroOverlay 起）：能复用就复用，不为此另起一套。这里把共用部分收成两类，
 * 两处调用方各自一行：
 *   1. `shouldSkipOnKey(event)` —— 「这个按键该不该由我们处理」的纯判定（可单测）；
 *   2. `useSkipTypewriterOnKey(typing, skip)` —— 把判定挂到 document 的键盘监听上。
 *
 * 挂在 document 而不是某个元素上：打字时玩家可能刚点过空白处、焦点在 body 上，
 * 也可能焦点在「展开观看」之类的既有按钮上（那类按键交给那个控件，见下），
 * 没有任何一个元素能保证拿到键盘焦点；挂在元素上还得给它加 tabIndex（反而多出个焦点停靠点）。
 *
 * 边界（都是刻意的）：
 *   - 只在 `typing` 为真时拦截。打完字监听根本不存在 —— 「打完之后的点击/按键无副作用」由此保证。
 *   - **不抢交互控件的按键**：事件目标本身是 button / a / input / textarea / select / contenteditable
 *     时直接放过 —— 那时 Enter / Space 是那个控件的语义（点按钮、开链接、输入空格），
 *     抢过来就等于把这些键废掉。其余情况（body、卡片、文字）才由我们处理。
 *   - Space 的默认行为是滚动页面：跳过时 `preventDefault()`，避免「按一下既跳过又滚屏」。
 *     Enter 的默认行为只在表单/按钮上有意义，那两处已被上一条放行。
 *   - 带修饰键的组合（Ctrl/Meta/Alt）不拦：那是浏览器/系统快捷键。
 */

/** 事件目标是不是「自己会消费 Enter / Space」的交互控件 */
export function isInteractiveTarget(target: EventTarget | null): boolean {
    if (!target || typeof target !== 'object') return false
    const el = target as { tagName?: unknown; isContentEditable?: unknown }
    const tag = typeof el.tagName === 'string' ? el.tagName.toLowerCase() : ''
    if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'textarea' || tag === 'select') return true
    return el.isContentEditable === true
}

/** `true` = 这个 keydown 该由我们处理并在处理后 preventDefault */
export function shouldSkipOnKey(event: {
    key: string
    target: EventTarget | null
    ctrlKey?: boolean
    metaKey?: boolean
    altKey?: boolean
    repeat?: boolean
}): boolean {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return false
    if (event.ctrlKey || event.metaKey || event.altKey) return false
    // 长按重复的 keydown 里第一下就跳完了；之后 typing 已是 false，这里多一道保险
    if (event.repeat) return false
    return !isInteractiveTarget(event.target)
}

/**
 * 打字进行中，Enter / Space 立刻显示完（并吃掉默认行为，Space 不会顺带滚屏）。
 * `skip` 要求身份稳定（`useTypewriter` 返回的 skip 满足）。
 */
export function useSkipTypewriterOnKey(typing: boolean, skip: () => void): void {
    useEffect(() => {
        if (!typing) return
        // 非浏览器环境（本项目无 jsdom 的测试）直接跳过安装
        if (typeof document === 'undefined') return
        const onKeyDown = (e: KeyboardEvent) => {
            if (!shouldSkipOnKey(e)) return
            e.preventDefault()
            skip()
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [typing, skip])
}
