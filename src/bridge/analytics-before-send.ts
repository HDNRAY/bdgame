/**
 * Umami `data-before-send` 钩子的**唯一原文**（计划 `docs/analytics-plan.md` 第 1.3 节）。
 *
 * 由 `vite.config.ts` 的 build-only 插件注入到产物 `<script>` 内联标签里；单测直接 import 这段
 * 字符串执行，保证"测的就是真正注入的那段"。放在 `src/` 下的原因是测试与 tsc 的 include 都覆盖它，
 * 而 `vite.config.ts` 两边都能 import。
 *
 * 行为：`/dev`（DevMode，线上可达）的页浏览一律不发；其余类型原样放行（自定义事件不经过 /dev）。
 */
export const UMAMI_BEFORE_SEND_HOOK = [
    'window.__umamiBeforeSend = function (type, payload) {',
    "    var url = (payload && payload.url) || (typeof location !== 'undefined' ? location.pathname : '');",
    "    if (String(url).indexOf('/dev') !== -1) return false;",
    '    return payload;',
    '};',
].join('\n')
