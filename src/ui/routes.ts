// ════════════════════════════════════════
//  UI 路由常量
//
//  「单挑模式」入口已从首页移到 DevMode 的 tab（`/dev?tab=duel`）：单挑流程里的
//  返回 / 重定向都跳这个地址，tab id 与 DevMode 的 NAV_ITEMS 共用同一常量，
//  避免各处写死字符串、改 tab id 时漏改。
// ════════════════════════════════════════

/** DevMode「单挑模式」tab 的 id */
export const DUEL_TAB_ID = 'duel'

/** DevMode「单挑模式」tab 的完整路径 */
export const DUEL_TAB_PATH = `/dev?tab=${DUEL_TAB_ID}`
