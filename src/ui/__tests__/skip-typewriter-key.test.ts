/**
 * 「打字中按 Enter / Space 跳过」的**判定逻辑**（`useSkipTypewriterOnKey.ts` 的 `shouldSkipOnKey`）。
 *
 * 为什么只测这个纯函数：本项目没有 jsdom（`vitest.config.ts` 没有 environment 配置），
 * `renderToStaticMarkup` 不跑 `useEffect` —— 键盘监听的安装与真实按键只能靠浏览器（同批改动的
 * CDP 无头实测：点击 / Enter / Space + scrollTop / 打完后再按 / 触屏拖拽四组）。
 * 这里把「这个按键该不该由我们处理」独立出来，覆盖三件事：
 *   1. Enter 与 Space 都跳过，其余按键不碰；
 *   2. Space 的默认行为要吃掉（调用方据此 preventDefault），所以判定必须为真 —— 见下；
 *   3. 事件目标在 button / input 等交互控件上时放行（Enter/Space 归那个控件），带修饰键的组合也不拦。
 * 变异验证：把 `shouldSkipOnKey` 改成 `return false`（或去掉交互目标的放行），下面即红。
 */
import { describe, expect, it } from 'vitest'
import { isInteractiveTarget, shouldSkipOnKey } from '../hooks/useSkipTypewriterOnKey'

/** 只给判定用的最小事件形状（KeyboardEvent 的真身只有浏览器里有） */
function key(k: string, target: unknown = null, extra: Record<string, unknown> = {}) {
    return { key: k, target: target as EventTarget | null, ...extra }
}

const div = { tagName: 'DIV' }
const body = { tagName: 'BODY' }
const button = { tagName: 'BUTTON' }
const input = { tagName: 'INPUT' }
const textarea = { tagName: 'TEXTAREA' }
const select = { tagName: 'SELECT' }
const link = { tagName: 'A' }
const editable = { tagName: 'DIV', isContentEditable: true }

describe('shouldSkipOnKey', () => {
    it('Enter 跳过（目标不是交互控件）', () => {
        expect(shouldSkipOnKey(key('Enter', div))).toBe(true)
    })

    it('Space 跳过，且调用方会据此 preventDefault（不会顺带滚屏）', () => {
        expect(shouldSkipOnKey(key(' ', body))).toBe(true)
        // 少数浏览器/旧内核报 'Spacebar'，一并认
        expect(shouldSkipOnKey(key('Spacebar', body))).toBe(true)
    })

    it('其余按键不碰', () => {
        for (const k of ['a', 'Escape', 'ArrowDown', 'Tab', 'Shift']) {
            expect(shouldSkipOnKey(key(k, div))).toBe(false)
        }
    })

    it('目标在交互控件上：放行（Enter/Space 是那个控件的语义）', () => {
        for (const t of [button, input, textarea, select, link, editable]) {
            expect(shouldSkipOnKey(key('Enter', t))).toBe(false)
            expect(shouldSkipOnKey(key(' ', t))).toBe(false)
        }
    })

    it('带修饰键的组合不拦（那是浏览器/系统快捷键）', () => {
        expect(shouldSkipOnKey(key('Enter', div, { ctrlKey: true }))).toBe(false)
        expect(shouldSkipOnKey(key(' ', div, { metaKey: true }))).toBe(false)
        expect(shouldSkipOnKey(key(' ', div, { altKey: true }))).toBe(false)
    })

    it('长按产生的重复 keydown 不再处理（第一下已跳完）', () => {
        expect(shouldSkipOnKey(key(' ', div, { repeat: true }))).toBe(false)
    })
})

describe('isInteractiveTarget', () => {
    it('标签名大小写不敏感', () => {
        expect(isInteractiveTarget({ tagName: 'button' } as unknown as EventTarget)).toBe(true)
        expect(isInteractiveTarget({ tagName: 'DIV' } as unknown as EventTarget)).toBe(false)
    })

    it('非元素目标（null / 文本节点 / 窗口）不算交互控件', () => {
        expect(isInteractiveTarget(null)).toBe(false)
        expect(isInteractiveTarget({} as EventTarget)).toBe(false)
        expect(isInteractiveTarget('text' as unknown as EventTarget)).toBe(false)
    })
})
