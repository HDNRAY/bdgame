import { useEffect, useState } from 'react'

/**
 * 「打字中跳过」的共用件 —— 点击任意处与 Enter / Space 两个入口走同一套判定。
 *
 * 项目惯例（IntroOverlay 起）：能复用就复用，不为此另起一套。共用部分收在这里：
 *   1. `shouldSkipOnKey(event)` / `isInteractiveTarget(target)` —— 纯判定（可单测）；
 *   2. `createSkipHolder()` / `useSkipHolder(holderRef, typing, skip)` /
 *      `useSkipOnClickCapture(holderRef)` —— 局内主视图「点滚动区任意处跳过」的接线：
 *      打字中的卡往格子里登记 `skip`，滚动容器（`.rs-rounds`）在捕获阶段消费。
 *      容器这一层才接得住留白处的点击（卡片根元素盖不住容器 padding）；
 *   3. `useSkipTypewriterOnKey(typing, skip)` —— 把键盘判定挂到 document 的监听上。
 *
 * 键盘监听挂在 document 而不是某个元素上：打字时玩家可能刚点过空白处、焦点在 body 上，
 * 也可能焦点在「展开观看」之类的既有按钮上（那类按键交给那个控件，见下），
 * 没有任何一个元素能保证拿到键盘焦点；挂在元素上还得给它加 tabIndex（反而多出个焦点停靠点）。
 *
 * 边界（都是刻意的）：
 *   - 只在打字中生效。打完字监听/接线根本不存在 —— 「打完之后的点击、按键无副作用」由此保证。
 *   - **不抢交互控件的按键与点击**：目标是 button / a / input / textarea / select / contenteditable
 *     时直接放过 —— 那时 Enter / Space / 点击是那个控件的语义（点按钮、开链接、输入空格），
 *     抢过来就等于把这些控件废掉。其余情况（body、卡片、文字、容器留白）才由我们处理。
 *   - Space 的默认行为是滚动页面：跳过时 `preventDefault()`，避免「按一下既跳过又滚屏」。
 *     Enter 的默认行为只在表单/按钮上有意义，那两处已被上一条放行。
 *   - 带修饰键的组合（Ctrl/Meta/Alt）不拦：那是浏览器/系统快捷键。
 */

/** 事件目标是不是「自己会消费 Enter / Space / 点击」的交互控件 */
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

/**
 * 一个可变的「当前可跳过对象」格子：打字中的组件把 `skip` 放进来，容器读它。
 * 名字以 Ref 结尾，因为它的用法就是 ref —— 只在事件回调与 effect 里读写，不在渲染期读。
 */
export interface SkipHolderRef {
    current: { skip: () => void } | null
}

/** 建一个格子（身份稳定，可安全当 effect 依赖传） */
export function createSkipHolder(): SkipHolderRef {
    return { current: null }
}

/**
 * 把 `skip` 登记进格子：`typing` 为真时登记，转假或卸载即清空 ——
 * 容器那边的判断永远只有一句「现在有没有正在打字的东西」。
 *
 * `holderRef` 由调用方建好传进来（`createSkipHolder()` / `useMemo(createSkipHolder, [])`）：
 * 局内主视图的格子归 `.rs-rounds` 所有、卡片只往里登记；单元件单用时卡片自己建一个。
 */
export function useSkipHolder(holderRef: SkipHolderRef, typing: boolean, skip: () => void): void {
    useEffect(() => {
        holderRef.current = typing ? { skip } : null
        return () => {
            holderRef.current = null
        }
    }, [holderRef, typing, skip])
}

/**
 * 在**滚动容器**上用捕获阶段接住点击：打字中点到容器里的任意位置（含卡片之外的留白）
 * 都跳过。用捕获是为了在容器内各按钮的 onClick 之前拿到事件。
 *
 * 刻意**不** `stopPropagation`：同一次点击若落在一个还能用的控件上（局内唯一的例子是
 * 单选项轮的选项，它不等打字结束就出现），让那个控件照常收到事件 —— 跳过与选中可以同时发生，
 * 抢掉它反而是破坏既有行为。重复触发也不怕：`skip` 只是把文本截断，多调一次无副作用。
 *
 * 为什么挂在容器而不是卡片上：卡片根元素盖不住容器的 padding 留白，
 * 那块空白也是「可滚动内容的一部分」（用户点哪儿都应该能跳过），只有容器这一层接得住。
 *
 * 触屏拖拽不会被误判：这里只用 `click` 事件。浏览器的 click 只在「按下与抬起基本在同一处」
 * 时补发，拖拽滚动（位移明显）或长按都不会产生 click，所以拖动滚屏天然不会触发跳过。
 *
 * 用 **callback ref** 而不是 `useRef`：容器可能在首屏（开场页 / 章页）时根本不存在，
 * 而 effect 的依赖不会因为「ref.current 后来才有值」而变化 —— 用 `useRef` 会在首屏
 * 挂到 null 上就再也不重挂。callback ref 在容器每次挂载/卸载时都会跑，
 * 「开场页 → 局内」这一次挂载也接得住。
 */
export function useSkipOnClickCapture(holderRef: SkipHolderRef): (el: HTMLElement | null) => void {
    const [scrollerEl, setScrollerEl] = useState<HTMLElement | null>(null)
    useEffect(() => {
        if (!scrollerEl) return
        const onClickCapture = (e: MouseEvent) => {
            const target = holderRef.current
            if (!target) return
            if (isInteractiveTarget(e.target)) return
            // 只吃掉默认行为（如文本选择）；事件继续派发，容器内的控件该响应还响应
            e.preventDefault()
            target.skip()
        }
        scrollerEl.addEventListener('click', onClickCapture, true)
        return () => scrollerEl.removeEventListener('click', onClickCapture, true)
    }, [scrollerEl, holderRef])
    return setScrollerEl
}
