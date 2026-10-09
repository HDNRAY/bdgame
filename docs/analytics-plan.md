# Umami 埋点实施计划

> 状态：**计划，未实现**。本文只描述「要做成什么样、怎么验证」，不含任何已落地的代码改动。
> 目标：把 Umami 接进《单挑》，拿到**玩法漏斗**（开局 / 故事线 / 章节 / 战斗 / 结局 / 弃局），
> 同时保证 dev、本地预览与 `/dev` 不产生真实数据。
>
> 方法说明：本机 DNS 走 fake-IP 代理，域名解析到 `198.18.x.x` 段，`web_fetch` 会以
> "non-public IP address" 拒收（见 `docs/publishing-research.md:9`）。所以本文引用的 Umami 官方文档
> 是 **2026-10-09 用 curl 抓 HTML、去标签后读原文**得到的，不是搜索摘要推测。仓库内的事实均给出
> 「文件:行」。

---

## 0. 探测结果（先摆事实）

### 0.1 `index.html` 现状

- 全文 16 行，除入口模块脚本外**没有任何 `<script>`**：`index.html:14` 是
  `<script type="module" src="/src/main.tsx">`。
- **已有 Vite 的 `%VITE_*%` 注入先例**：`index.html:10` 的 `<title>%VITE_APP_TITLE%</title>`，
  构建产物里已被替换成 `2088 青山镇 斗炁大会`（`bdgame/index.html`，构建输出）。
- head 里另有 favicon / viewport / theme-color / apple-touch-icon 四个标签（`index.html:5-9`），
  没有 CSP、没有第三方域名 preconnect。

结论：加埋点脚本是**从零新增**，不会撞已有标签；`%VITE_*%` 这条注入通道存在，但下面第 1 节会说明
为什么**不建议**直接用它写脚本标签。

### 0.2 `vite.config.ts` 的构建与 PWA 配置

- `base`：dev 是 `/`，build 是 `/bdgame/`（`vite.config.ts:10`，GitHub Pages 子路径）。
- `build.outDir: 'bdgame'`（`vite.config.ts:12`），产物目录被 gitignore（`.gitignore:3`）。
- PWA（`vite.config.ts:31-50`）：
  - `registerType: 'autoUpdate'`（`:32`）
  - `workbox.globPatterns: ['**/*.{js,css,html,svg,png,ico}']`（`:34`）
  - `workbox.navigateFallback: '/index.html'`（`:35`）
  - **没有 `globIgnores`，没有 `runtimeCaching`，没有 `additionalManifestEntries`**。
- 自定义插件 `gh-pages-404-fallback`（`:51-59`，`apply: 'build'`）把 `bdgame/index.html` 复制成
  `404.html`，给 GitHub Pages 的深链兜底 —— 这是"在 vite.config.ts 里写 build-only 插件"的现成先例。
- Service Worker 注册在 `src/main.tsx:12-17`：监听 `controllerchange` 后整页刷新（autoUpdate 接管时触发）。

构建产物 `bdgame/sw.js`（现存的旧构建，非本次生成）里的证据：

```
s.precacheAndRoute([... {url:"index.html",...},{url:"assets/index-jOLt08o6.js",...} ...])
s.registerRoute(new s.NavigationRoute(s.createHandlerBoundToURL("/index.html")))
```

precache 清单里**全是同源相对路径**（`index.html`、`assets/*.js`、`icons.svg`、`manifest.webmanifest` 等），
没有、也不可能有 `cloud.umami.is/script.js`。

### 0.3 SPA 路由

- 用 `react-router-dom` 的 `BrowserRouter`，`basename = import.meta.env.PROD ? '/bdgame' : '/'`
  （`src/App.tsx:78,82`）。
- 路由表在 `src/App.tsx:90-99`：`/`、`/build/:charId`、`/settings`、`/about`、`/encyclopedia`、
  `/battle`、`/roguelite`、`/dev`（由 `VITE_ENABLE_DEV_MODE` 控制）、`*`。

**Umami 的 `data-auto-track` 在 SPA 里会自动记录路由变化**，官方文档写得很直白：

> Umami's tracker script monitors the browser's History API (pushState and replaceState) and the
> popstate event. When your SPA navigates to a new route, Umami automatically sends a page view with
> the updated URL and title. This means you do not need to manually call umami.track() for page views
> in most cases.
> —— <https://docs.umami.is/docs/guides/track-single-page-apps>（2026-10-09 读）

同一页还有两条反向提醒，必须遵守：

- Troubleshooting "Duplicate page views"：不要在路由变化时无参调用 `umami.track()`，会重复记页浏览。
- "Make sure the tracker script is loaded once in the root layout, not re-added on every route change."

FAQ 也重复了同一结论："Yes, Umami automatically tracks page navigations in SPAs without any
additional configuration." —— <https://docs.umami.is/docs/faq>

另外 `data-auto-track` 的语义（默认就是 true）："By default, Umami initializes pageview tracking,
click tracking, path change detection, and optional features like performance tracking."
—— <https://docs.umami.is/docs/tracker-configuration>

**所以本项目不需要为页浏览手动埋点。** 需要手写的只有玩法事件（第 3 节）。

### 0.4 环境区分

- 代码里判环境只有一处：`src/App.tsx:78` 的 `import.meta.env.PROD`。
- 功能开关走 env：`VITE_ENABLE_DEV_MODE`（`src/App.tsx:79-80`、`src/ui/screens/ModeSelect/ModeSelect.tsx:9`），
  标题走 `VITE_APP_TITLE`（`ModeSelect.tsx:21`、`index.html:10`）。
- `.gitignore`：`*.local`（`:5`）、`.env`（`:6`）、`.env.local`（`:7`）都被忽略；
  **但 `.env.production` 是已跟踪文件**（`git ls-files` 有它），里面写着 `VITE_ENABLE_DEV_MODE=true`
  —— 即线上 `/dev` 是开放的。这一点对埋点很重要：**线上会有人（或你自己）访问 `/dev`**。
- CI 只跑 `npm run build`（`.github/workflows/deploy.yml:25`），产物推到 `HDNRAY/HDNRAY.github.io`
  的 `bdgame/` 目录（`deploy.yml:31-35`），线上地址即 `https://hdnray.github.io/bdgame/`，
  hostname 是 `hdnray.github.io`。构建时没有注入任何自定义 env。

### 0.5 可挂载的位置

- `src/bridge/`（`actionDisplay.ts` / `tagDisplay.ts` / `replay-engine.ts` 等）是"引擎数据 → 展示"的
  纯函数层，**没有任何副作用**，也没有全局单例。适合放埋点薄封装（用户建议的
  `src/bridge/analytics.ts` 位置合理）。
- `src/main.tsx` 是入口，只做 render + SW 刷新（17 行），**不适合**在这里写玩法埋点（这里拿不到
  游戏状态），但适合放"初始化/降级"这类全局动作。
- 状态变化只有一个收口：`src/ui/stores/roguelite-store.ts:38-51` 的 `watch(engine)`，
  它订阅 `RogueliteRun` 的每一次 `_emit()`（引擎在 `src/game/roguelite/engine.ts:694-695` 深拷贝后推送）。
  玩法事件应当围绕这个订阅点做，**不要动 `src/engine/`**（AGENTS.md 的硬规矩：
  不要把业务逻辑硬编码进 engine）。
- 注意：`useRogueliteStore` 是模块级单例，**DevMode 也 import 它**
  （`src/ui/screens/DevMode/RunSummary/RunSummaryTab.tsx:3,18-19`），所以挂在 store 上的埋点逻辑
  在 `/dev` 也会被加载；事件本身只有引擎 `_emit()` 才会触发，而 DevMode 不驱动引擎，
  但**页浏览是 auto-track 全局记录的，`/dev` 页浏览必须另外挡掉**（见 1.3）。

---

## 1. 脚本放哪、怎么注入

### 1.1 结论（推荐）

**不使用 `index.html` 里写死的静态标签，也不使用 `%VITE_*%` 直接替换；用
`vite.config.ts` 里一个 `apply: 'build'` 的小插件注入，注入内容由 env 决定。**

- 新 env（只加在 `.env.production`，`.env` 不动）：
  - `VITE_UMAMI_WEBSITE_ID=ce8ced3f-1741-4d09-9376-c1378950c2a4`
  - `VITE_UMAMI_DOMAINS=hdnray.github.io`
  - `VITE_UMAMI_SCRIPT_SRC=https://cloud.umami.is/script.js`（可选，给验证时替换成桩用）
- 插件形态（计划，参考 `vite.config.ts:51-59` 的 404 插件写法）：

```ts
function umamiPlugin(): Plugin {
    return {
        name: 'umami-analytics',
        apply: 'build',                 // dev server 完全不注入
        transformIndexHtml(html) {
            const id = process.env.VITE_UMAMI_WEBSITE_ID
            if (!id) return html        // 没配就不注入（本地构建默认无 id）
            return {
                html,
                tags: [
                    { tag: 'script', children: UMAMI_BEFORE_SEND_HOOK, injectTo: 'body' },
                    { tag: 'script', attrs: {
                        defer: true,
                        src: process.env.VITE_UMAMI_SCRIPT_SRC ?? 'https://cloud.umami.is/script.js',
                        'data-website-id': id,
                        'data-domains': process.env.VITE_UMAMI_DOMAINS ?? 'hdnray.github.io',
                        'data-before-send': '__umamiBeforeSend',
                    }, injectTo: 'body' },
                ],
            }
        },
    }
}
```

### 1.2 为什么是这套，而不是直接写 `index.html`

| 要求 | 直接写 `index.html` | 写 `%VITE_UMAMI_WEBSITE_ID%` | build-only 插件 + env（推荐） |
| --- | --- | --- | --- |
| 只在构建产物里加载 | 做不到（dev 也加载） | 做不到（dev 也会替换并加载） | 做得到（`apply: 'build'`） |
| dev 与本地预览不打点 | 做不到 | 看 env 是否定义，不可靠 | dev 不注入；本地 preview 由 `data-domains` 挡 |
| website-id 只出现一处 | 是，但硬编码在 HTML | 是（env 里一处） | 是（`.env.production` 一处） |
| 没配 id 时不误加载 | 做不到 | 无可用的条件语法，容易留下 `data-website-id=""` 的坏标签 | 做得到（`if (!id) return html`） |

补充说明：

- Vite 的 HTML env 替换**没有条件能力**：变量没定义时无法"整段标签不输出"。若把
  `data-website-id="%VITE_UMAMI_WEBSITE_ID%"` 留在 HTML 里，dev（加载 `.env` + `.env.local`，
  不加载 `.env.production`）就会出现空 id 的标签，脚本仍会去网络上拉一份 —— 与"dev 不打点"直接冲突。
  插件里显式判空可以从根上避免。
- 注入点选 **body 末尾**而不是 head：Vite build 会把入口 `<script type="module">` 放进 head
  （见 `bdgame/index.html`）。浏览器对 defer 脚本按文档顺序执行，把第三方脚本排在入口**之后**，
  第三方域名被墙或挂起时不会把游戏入口卡在它后面。
- `data-domains` 是官方文档明确点名的 dev/staging 防护手段："This helps if you are working in a
  staging/development environment."（<https://docs.umami.is/docs/tracker-configuration>）。
  hostname 不匹配时 tracker 根本不初始化，所以 `npm run build` + `npm run preview`（localhost）
  即使产物里带了脚本也不会发数据。
- 同时建议 `data-exclude-search="true"` / `data-exclude-hash="true"`（可选）：本项目的路由没有
  query/hash，加上只是防御将来加参数时把参数带进页浏览。

### 1.3 `/dev` 页浏览的挡法

线上 `VITE_ENABLE_DEV_MODE=true`（`.env.production`），`/dev` 可达。auto-track 会对 `#/dev`
（准确说是 `/bdgame/dev`）也发页浏览，污染"主页/故事页"的流量口径。

处理：在 tracker 之前注入一小段内联脚本，定义 `data-before-send` 指向的钩子（官方支持）：
"The function will take two parameters, type and payload. To continue with sending, you return a
payload object. To cancel the send, return a falsy value."
—— <https://docs.umami.is/docs/tracker-configuration>

```js
window.__umamiBeforeSend = function (type, payload) {
    var path = (payload && payload.url) || location.pathname;
    if (String(path).indexOf('/dev') !== -1) return false;   // /dev 一律不发
    return payload;
};
```

注意：钩子必须是 `window` 上的函数、且**在脚本加载前就定义好**，所以内联脚本必须排在 tracker 标签
之前（同一段注入里先 inline 后 external，顺序天然满足）。自定义玩法事件不经过 `/dev`（只有
`/roguelite` 会驱动引擎），不需要在钩子里另加判断。

### 1.4 不推荐的两条路

- **不要在 `src/main.tsx` 里 `import` 或 `createElement('script')` 动态插**：那会把第三方脚本带进
  所有模式（含 dev 与 vitest），也把"要不要埋点"的判断散到运行时。
- **不要用 `%VITE_*%`**：理由见 1.2。

---

## 2. 与 PWA / Service Worker 的关系

### 2.1 结论

**跨域加载 `https://cloud.umami.is/script.js` 时，不会被 precache，也不会被离线回退吞掉，
不需要改 PWA 配置。**

依据：

1. `globPatterns: ['**/*.{js,css,html,svg,png,ico}']`（`vite.config.ts:34`）匹配的是
   `globDirectory: bdgame/`（`vite.config.ts:12`）下的**构建产物文件**；`bdgame/sw.js` 里的
   precache 清单实际列出的也全是同源相对路径（`assets/*`、`index.html`、`icons.svg` 等）。
   `cloud.umami.is/script.js` 不在产物目录里，进不了清单。
2. `navigateFallback` 只生成
   `new NavigationRoute(createHandlerBoundToURL("/index.html"))`（`bdgame/sw.js` 末尾）。
   Workbox 的 `NavigationRoute` 只匹配 `request.mode === 'navigate'` 的导航请求；
   `<script src>` 请求不是导航请求，永远不走这条回退。
3. 配置里没有 `runtimeCaching`，所以 SW 不会对任何跨域请求做运行时缓存。

### 2.2 什么时候需要动配置

只有一种情况：**将来为了绕过广告拦截器，把 tracker 代理/自托管到同源**
（Umami 官方给的方案：<https://docs.umami.is/docs/bypass-ad-blockers>）。此时脚本变成
`/bdgame/<name>.js`，会命中 `globPatterns`：

- 若不想让 SW 预缓存它：加 `globIgnores: ['**/<name>.js']`；
- 若接受预缓存：不用改，但语义会变成"离线也用旧版 tracker"。
- 同时 `data-host-url` 要指向自建/代理端点；跨域的 `gateway.umami.is/api/send` 不会被 SW 拦截，
  同源的 `/api/send` 也不会被缓存（没有 runtimeCaching），发不出去就是发不出去。

**本计划按 YAGNI 不做代理/自托管**，`globIgnores` 也就先不加。

### 2.3 两个需要单独盯的点（与埋点无直接关系，但别混淆）

- `navigateFallback` 写的是**绝对路径 `/index.html`**，而 base 是 `/bdgame/`
  （`vite.config.ts:10,35`）；vite-plugin-pwa 的默认值其实是相对的 `'index.html'`
  （`node_modules/vite-plugin-pwa/dist/index.js:838`），本项目把它覆盖成了绝对路径。
  构建产物里 `createHandlerBoundToURL("/index.html")` 能不能对上 precache 清单里的相对 key
  `index.html`，我**没有在浏览器里实测**，标记为待确认（见第 9 节）。无论对错，它都只影响
  导航回退，不影响第三方脚本。
- `registerType: 'autoUpdate'` + `main.tsx:12-17` 的 `controllerchange` 整页刷新，会在 SW 接管时
  多产生一次页浏览。这是秒级重复，做漏斗时按会话去重即可，不值得为它改 SW。

---

## 3. 埋点事件设计

### 3.1 设计原则

- **页浏览交给 auto-track**，不手写（第 0.3 节）。手写的只有 6 个玩法事件。
- **节点推进不逐节点打**：33 个节点 × 每局 = 噪音，且单看"到过哪个节点"没有解释力。
  替代方案是**章节事件 + 结算/弃局时的节点号**，两级数据合起来就能还原"死在哪一段"。
- 参数一律是**游戏内 id / 枚举 / 数字**，禁止任何玩家可识别信息（第 5 节）。
- 事件名用 snake_case 英文（Umami 后台按名字聚合，中文名不利于检索）。
- 注意 Umami 事件数据的硬限制："Numbers max precision of 4. Strings max length of 500.
  Arrays converted to a string, max length of 500. Objects max of 50 properties."
  —— <https://docs.umami.is/docs/tracker-functions>。本计划全部满足。

### 3.2 事件清单（6 个）

| 事件名 | 触发点（文件:行/状态变化） | 参数 | 这个数能回答什么问题 |
| --- | --- | --- | --- |
| `run_start` | `src/ui/stores/roguelite-store.ts:76-81` `confirmWorldIntro()`（世界背景页读完、`recordRunStart()` 同一处） | `has_cleared: boolean`（取 `gameState.flags['cleared_before']`，引擎在 `engine.ts:70` 写入） | 有多少人真正开局（对比首页页浏览 = 进入故事的转化）；新玩家与老玩家的开局比例 |
| `story_pick` | store 订阅 diff：`prev.build.story === '' && next.build.story !== ''`；引擎在 `engine.ts:91-98` 写 `build.story` | `story: 'feud' \| 'sect' \| 'xuanmen' \| 'veteran' \| 'wanderer'` | 五条故事线的选择分布；配合 `run_end` 看各线的通关率（哪条线"开局多、通关少"） |
| `chapter_reach` | `src/ui/stores/roguelite-store.ts:44-47` 已有的章节页检测（nodeIndex 跨 12 / 23 时） | `chapter: 2 \| 3`，`node: 12 \| 23` | 漏斗中段留存：开局 → 第二章 → 第三章的流失；`run_start` 减 `chapter_reach` 就是"第一章劝退率" |
| `battle_end` | store 订阅 diff：`next.runBattles.total > prev.runBattles.total`；参数从 `next.rounds` 最后一轮读（引擎 `engine.ts:510-573` 结算并 push） | `node: number`、`won: boolean`、`champion_boss: boolean`（该轮有 `enemyBuild`，`engine.ts:306-321`）、`tournament: boolean`（`tournamentData` 存在 且 round.id 是 `match`/`group_r0`，`engine.ts:559-565`）、`injury: number`（`round.result.injuryGained`） | 各节点的胜率曲线、卡点；隐藏 boss 通过率；大会正式场次与热身/剧情的胜负分布；伤势来源 |
| `run_end` | store 订阅 diff：`!prev.finished && next.finished`；结局判定对齐 `src/ui/components/roguelite/ending-title.ts`（flags 优先级 true > fallen > loop > 默认） | `outcome: 'true' \| 'loop' \| 'fallen' \| 'eliminated'`、`node: number`、`battles/wins/losses: number`、`injuries: number`、`rewards: number` | 结局分布（真结局 / 循环 / 陨落 / 中道崩殂）；整体通关率；平均要打多少场；结局与故事线的交叉 |
| `run_abandon` | `src/ui/screens/RogueliteScreen/RogueliteScreen.tsx:68-71` `handleExit()`，且 `!gameState.finished`（结算页的「返回主菜单」走 `RunSummaryPanel` 的 `onExit`，不属于弃局，不记） | `node: number`、`battles: number` | 主动弃局发生在哪一段（与 `chapter_reach` 对照，区分"没留住"与"打不过"） |

参数取值口径补充：

- `run_end.node` 用**订阅里维护的"最后一个未结束时的 nodeIndex"**，不要直接用 `next.nodeIndex`：
  `_advanceToNextNode`（`engine.ts:657-666`）先自增再判结束，结局时会停在 34。
- `outcome = 'eliminated'` 覆盖两类"没走到结局"：伤势满 100 中途结束、斗炁大会被淘汰
  （`engine.ts:659`、`engine.ts:566-569`），两者都不写 `ending_*` flag，`ending-title.ts` 会显示
  「胜败乃兵家常事」。
- `run_end.rewards` 只发**数量**（`build.rewards.length`），不发奖励清单。
- `battle_end` 每个节点最多一次，教学观战轮（`round.tutorial`，`engine.ts:323-344`）不计入
  `runBattles`，天然不会触发。

### 3.3 建议加 / 建议不加，及理由

**建议加（上面 6 个已覆盖）**：

- 必须保留 `run_start` 与 `story_pick` 两个**分开**的事件：故事线是 n1 的选项，和"读完背景页"
  不是同一时刻；合成一个事件会丢掉"读完背景页但没选线就跑"的流失。
- `battle_end` 里保留 `champion_boss` 布尔位而**不单独立事件**：单独立事件会让"总战斗场次"
  需要跨事件相加，且隐藏 boss 本来就是战斗，放在同一事件里可用一个 percent 图看胜率。

**建议不加（明确写进"不做的事"）**：

- `node_enter`（每节点一条）：33 条/局，噪音远大于信息量；章节事件 + `run_end.node` +
  `run_abandon.node` 已经能画流失曲线。
- `choice_pick`（每次选项）：内容层面的选择，量极大；想研究剧情分支应该离线跑数据，不是打点。
- `reward_pick`（每次奖励，一局约 29 次）：奖励经济已经有确定性脚本（`npm run reward`、
  `npm run rt`）在算，埋点版本口径更差、量还更大；真要，也只发 `run_end.rewards` 的数量。
- `battle_replay` / 伤害数值 / 战斗日志：体积大、含完整 build 信息，属于第 5 节的禁发项。
- `settings_change` / `modal_open` / `encyclopedia_open`：与玩法漏斗无关，YAGNI。
- 心跳 / 周期性 `run_progress`：`run_abandon` + `run_end` 已经覆盖了进度分布。
- 任何形式的 `umami.identify()` / `data-distinct-id`：会把匿名会话串成"用户"，本项目没有账号体系，
  没有理由开这个口子（官方也建议 identify 只用于已登录用户的内部 id）。

---

## 4. 实现方式：类型安全的薄封装

### 4.1 模块：`src/bridge/analytics.ts`

职责只有一件：**把"发一个事件"收敛成一次带类型检查的函数调用**。调用点永远不碰 `window.umami`。

签名（计划）：

```ts
export type AnalyticsEventMap = {
    run_start: { has_cleared: boolean }
    story_pick: { story: string }
    chapter_reach: { chapter: 2 | 3; node: 12 | 23 }
    battle_end: { node: number; won: boolean; champion_boss: boolean; tournament: boolean; injury: number }
    run_end: {
        outcome: 'true' | 'loop' | 'fallen' | 'eliminated'
        node: number
        battles: number
        wins: number
        losses: number
        injuries: number
        rewards: number
    }
    run_abandon: { node: number; battles: number }
}

/** 唯一出口。事件名与参数形状都由 AnalyticsEventMap 约束，写错名字编译不过。 */
export function track<K extends keyof AnalyticsEventMap>(event: K, data: AnalyticsEventMap[K]): void
```

行为要求（逐条）：

1. **未加载时静默 no-op**：取 `window.umami`（判 `typeof window !== 'undefined'`），
   不存在或没有 `track` 函数就直接返回。不缓存"不存在"这个结果，脚本 defer 晚到也能接上。
2. **dev / 测试不发送**：编译期门控 `import.meta.env.PROD`。dev 与 vitest 下它是 false，
   整段被 tree-shake 掉（vitest 默认 node 环境，`vitest.config.ts:3-7` 没有 `environment` 设置，
   `window` 本来也不存在）。
3. **测试注入缝**：仿 `src/game/meta-save.ts:66-68` 的 `setMetaStorage` 写法，导出
   `setAnalyticsBackend(backend: AnalyticsBackend | null)`；注入非 null 时绕过 env 门控，
   这样单测能验证"发送路径"，生产代码永远不会调用它。
4. **吞掉一切失败**：`track` 调用包在 `try/catch`；若返回值是 thenable，挂一个空的 `.catch(() => {})`，
   避免网络失败变成 unhandled rejection。任何情况下都不向调用方抛错。
5. **类型安全**：`window.umami` 用局部 `interface UmamiBackend { track(event: string, data?: unknown): unknown }`
   声明 + 窄化，不用 `as any`（AGENTS.md 的引擎规矩虽只点名 `src/engine/`，但这里也照做）。

### 4.2 接线：`src/ui/stores/roguelite-analytics.ts` + store

- 抽一个**纯函数** `diffRunEvents(prev: GameState, next: GameState): AnalyticsCall[]`：
  输入两份 `GameState`，输出该次变化应发的事件（`story_pick` / `chapter_reach` / `battle_end` / `run_end`）。
  纯函数好测（用现成的 `GameState` 字面量构造 fixture），也把判定逻辑从 store 里隔开。
- `src/ui/stores/roguelite-store.ts` 的 `watch()`（`:38-51`）末尾：
  维护 `prev`，每次订阅回调 `for (const c of diffRunEvents(prev, next)) track(c.event, c.data)`，
  然后 `prev = next`；章节检测那两行（`:44-47`）就是现成的接入点。
- `run_start` **必须显式**写在 `confirmWorldIntro()`（`:76-81`）：这条路径走的是 store 的 `set`，
  **不经过引擎 `_emit()`**，订阅回调看不到它。
- `run_abandon` 显式写在 `RogueliteScreen.tsx:68-71` 的 `handleExit()` 里，先 `track` 再 `reset()`。
- 顺序：同一次 emit 里若同时触发 `battle_end` 与 `run_end`（例如大会决赛落败），
  按 `battle_end` → `run_end` 的固定顺序发。
- 不新增引擎埋点：`src/game/roguelite/engine.ts` 一行不改。

---

## 5. 隐私与合规

### 5.1 Umami 默认是否用 cookie

**不用。** 官方 FAQ 原文：

> **2. Do I need to display a cookie notice to users?**
> No, Umami does not use any cookies in the tracking code.
> —— <https://docs.umami.is/docs/faq>

同一页第 1 条：Umami 不收集个人可识别信息、数据匿名化、不跨站追踪；第 9 条补充：
"By default, Umami identifies visitors with an anonymous session identifier and no cookies."
默认收集的是页浏览、referrer、浏览器、操作系统、设备类型、来源国家（第 5 条）。

### 5.2 是否需要 consent 横幅

**不需要。** 理由：tracker 不写 cookie、不存个人可识别信息（FAQ 第 1、2 条），本项目也没有账号、
没有广告、没有用户输入的身份字段。加横幅只会劝退玩家且没有对应义务。

保留一句边界：这是对**当前接入方式**的判断。若将来开启 `umami.identify()` / `data-distinct-id`、
或在分享链接里挂 UTM 参数，就需要重新评估（那是本文明确不做的事）。这条结论也应写在
实施 PR 的描述里，留痕。

### 5.3 绝不发送的数据

- `MetaSave`（`localStorage` 键 `dantiao:meta:v1`，`src/game/meta-save.ts:11`）的任何内容 ——
  尤其 `lastWinBuild`（下一局隐藏 boss 来源，`meta-save.ts:41-42`）是一份完整 build。
- 完整 `CharacterBuild` / `build.rewards` / `actionConfigs` / `triggers` / 武器与义体清单。
- 战斗日志、回放（`engine._battleReplay`、`round.result.log`）、`BattleStats` 明细。
- 角色名（`build.name`，虽然多为游戏内固定名）、地点、任何自由文本。
- 任何形式的用户标识：`umami.identify()`、`data-distinct-id`、自造 device id。
- 本计划只发第 3.2 节表里列出的枚举与数字；`run_end.rewards` 只发数量。

---

## 6. 失败与屏蔽时的行为

| 情况 | 表现 | 对游戏的影响 |
| --- | --- | --- |
| 广告拦截器/隐私插件拦掉 `cloud.umami.is` | `window.umami` 始终 undefined | `track()` 静默返回；无报错；无 UI 变化 |
| 网络失败 / DNS 失败 | tracker 自己发不出去；我们这边的 `.catch` 吞掉 rejection | 无 |
| `track` 同步抛错 | `try/catch` 吞掉 | 无 |
| 离线（PWA 启动） | 页浏览与事件发不出去，官方文档没有离线补发队列的证据，**不依赖补发** | 无 |
| 内联钩子先于 tracker 执行 | 只要顺序对（同一段注入内 inline 在前）就成立 | 无 |
| 第三方脚本请求挂起 | 因为注入在 body、排在入口之后，不会把游戏入口卡在 defer 队列前面；极端情况下可能推迟 `DOMContentLoaded` | 已渲染的 React 树不受影响 |

额外原则：**埋点失败绝不能变成游戏失败**。所有调用点都只调 `track()`，不 await、不检查返回值。

---

## 7. 验证方法

**总原则：验证阶段禁止使用真实 website-id。** 用测试 website-id、本地桩脚本，或直接 mock
`window.umami`。

### 7.1 单元测试（不联网）

- `src/ui/stores/__tests__/roguelite-analytics.test.ts`：给 `diffRunEvents` 喂手写的
  `GameState` 前后快照，断言：
  - 普通 `selectChoice`（无战斗、无跨章）不产生任何事件；
  - 写 `build.story` 的那一次产生 `story_pick`，且只产生一次；
  - `runBattles.total` +1 产生 `battle_end`，参数里的 `champion_boss` / `tournament` / `won` 正确；
  - `finished` false → true 产生 `run_end`，`outcome` 按 flags 优先级判定（true / fallen / loop / eliminated）；
  - 同一快照里"战斗 + 结束"按 `battle_end` → `run_end` 顺序输出。
- `src/bridge/__tests__/analytics.test.ts`：`setAnalyticsBackend({ track: vi.fn() })` 后：
  - `track('run_start', { has_cleared: false })` 调到 backend 一次，参数原样；
  - 不注入 backend 时（默认路径）什么都不发生、不抛错；
  - backend 抛错 / 返回 rejected promise 时 `track()` 不抛、不产生 unhandled rejection；
  - `window` 不存在（vitest 默认 node 环境）时不报错。
- 跑法：`npx tsc --noEmit -p tsconfig.app.json`、`npx eslint src/ --quiet`、`npx vitest run`
  （注意 `tsc` 必须带 `-p tsconfig.app.json`，根 `tsconfig.json` 是 `files: []` 的空壳，
  不带 `-p` 是假绿 —— 见 AGENTS.md）。

### 7.2 浏览器验证（mock `window.umami`，不产生真实请求）

1. `npm run build`（**不设** `VITE_UMAMI_WEBSITE_ID`，产物里没有真实脚本标签）。
2. 用仓库现成的无头 Chrome + CDP 套路（照抄 `scripts/ui-geometry.mjs:116-165` 的
   spawn + `--remote-debugging-port` + `/json/list` 写法）：
   - 通过 `Page.addScriptToEvaluateOnNewDocument` 在**任何页面脚本之前**注入
     `window.umami = { track(name, data) { (window.__calls ||= []).push([name, data]) } }`；
   - 打开 `vite preview` 的 `/bdgame/`，点「进入故事」、读完背景页、选一条故事线；
   - `Runtime.evaluate` 读 `window.__calls`，断言正好出现 `run_start`、`story_pick`，
     且没有多余事件；再走一两个节点确认没有逐节点事件。
3. 断网/屏蔽模拟：用 CDP `Network.setBlockedURLs(['*umami*'])` 或干脆不注入 mock，
   重跑一遍，断言游戏流程不报错、`window.__calls` 为空、控制台无异常。

### 7.3 验证"注入只在构建产物里发生"

- `npm run dev` → 打开页面源码，**不应有** `cloud.umami.is`。
- 设一个**测试** `VITE_UMAMI_WEBSITE_ID` + `VITE_UMAMI_SCRIPT_SRC=http://127.0.0.1:<port>/umami-stub.js`
  （桩脚本只写 `window.__stubLoaded = true`，临时目录起个静态服务），跑 `npm run build`：
  - `grep umami bdgame/index.html` 能找到标签；
  - 无头浏览器加载 `<port>` 下的产物，断言 `<script>` 真的请求了桩地址；
  - 换成生产 hostname 之外的 host（localhost 不在 `data-domains` 里）时，断言 tracker 没初始化
    （桩脚本本身会加载，但要验证的是 Umami 的域名门控 —— 这一步可用真实脚本 + 测试 id 来做，
    `data-domains` 不匹配时它不会初始化、不会发数据）。

### 7.4 验证"真的在发送且只发送该发的"（用测试 website-id）

- 在 Umami 后台**新建一个测试网站**，拿它的 id 本地产物 + `data-domains` 临时去掉，
  在无头浏览器里用 CDP `Network.enable` + `Network.requestWillBeSent` 监听：
  - 页浏览/事件应当发往 Umami Cloud 的采集端点（官方文档：The Umami Cloud script sends its data to
    `gateway.umami.is` by default，见 <https://docs.umami.is/docs/bypass-ad-blockers>）；
  - 断言 `/dev` 路由下**没有**任何采集请求（第 1.3 节的钩子生效）；
  - 断言事件名只出现 6 个白名单里的。
- 上线后自检：可以短时间用测试 id 观察生产站点，确认无误后再切真实 id；
  **不要**在生产上临时加会污染统计的调试事件。

---

## 8. 落地步骤

每一步都给出：改哪些文件、怎么验证。**不改 `src/engine/`，不改 `src/game/`**。

### 第 1 步：注入与开关（约 1 个 PR 的一半）

- 改 `.env.production`：加 `VITE_UMAMI_WEBSITE_ID` / `VITE_UMAMI_DOMAINS`
  （`VITE_UMAMI_SCRIPT_SRC` 只在验证时临时设）。
- 改 `vite.config.ts`：加 `umamiPlugin()`（`transformIndexHtml`、`apply: 'build'`、body 注入、
  内联 before-send 钩子 + 外部 defer 标签），参考现成的 `gh-pages-404-fallback`（`:51-59`）。
- 验证：`npm run dev` 源码无 umami；`npm run build` 后 `bdgame/index.html` 有标签且
  `data-domains` 正确；`npm run preview` 在 localhost 下不产生请求（用 CDP 网络日志确认）。

### 第 2 步：薄封装

- 新增 `src/bridge/analytics.ts`（第 4.1 节）。
- 新增 `src/bridge/__tests__/analytics.test.ts`。
- 验证：`npx tsc --noEmit -p tsconfig.app.json`、`npx eslint src/ --quiet`、`npx vitest run`。

### 第 3 步：事件接线

- 新增 `src/ui/stores/roguelite-analytics.ts`（`diffRunEvents` 纯函数）。
- 改 `src/ui/stores/roguelite-store.ts`：`confirmWorldIntro` 发 `run_start`；`watch()` 里接
  `diffRunEvents`（章节检测 `:44-47` 是现成位置）。
- 改 `src/ui/screens/RogueliteScreen/RogueliteScreen.tsx:68-71`：`handleExit` 发 `run_abandon`。
- 新增 `src/ui/stores/__tests__/roguelite-analytics.test.ts`。
- 验证：三件套 + 第 7.2 节的 mock 浏览器走查。

### 第 4 步：PWA 复核（预期零改动）

- 不改 `vite.config.ts` 的 workbox 段。
- 验证：`npm run build` 后读 `bdgame/sw.js`，确认 precache 清单里没有第三方域名；
  顺手确认 `navigateFallback: '/index.html'` 在 `/bdgame/` 子路径下是否按预期工作（第 9 节）。

### 第 5 步：上线核对

- 合并 → `deploy.yml` 构建部署（`:25`）→ 打开 `https://hdnray.github.io/bdgame/`，
  用测试 id 的替代方案核对一次（或首次上线用测试网站，确认后换正式 id）。
- 在 Umami 建漏斗：`run_start` → `story_pick` → `chapter_reach(2)` → `chapter_reach(3)` →
  `run_end`；再按 `story` 维度拆分看各线通关率。

### 明确不做的事（YAGNI）

- **不自建 Umami**：用 Cloud，官网片段给的就是 `cloud.umami.is`。
- **不加 consent 横幅**：第 5.2 节有论证。除非将来加 `identify()` 或账号体系。
- **不引第三方前端分析库**（`@umami/node`、`umami-tracker` 之类 npm 包）：一个 `<script>` + 20 行
  薄封装就够，多一个依赖就多一份维护面。
- **不做逐节点 / 逐奖励 / 逐选项事件**：理由见 3.3。
- **不代理、不自托管 tracker**：会引出 PWA 预缓存范围问题（2.2），当前不必要。
- **不改 `src/engine/` 与 `src/game/`**：埋点是展示层的事，engine 保持纯净。

---

## 9. 拿不准 / 需要额外确认的点

1. **`navigateFallback: '/index.html'` 与 base `/bdgame/` 是否匹配。**
   `vite.config.ts:35` 用的是绝对路径，而 vite-plugin-pwa 默认是相对 `'index.html'`
   （`node_modules/vite-plugin-pwa/dist/index.js:838`）。构建产物里是
   `registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")))`（`bdgame/sw.js`）。
   Workbox 在绑定时会按绝对 URL 查 precache key，而清单里的 key 是相对的 `index.html`；
   如果对不上，SW 可能安装失败或离线深链回退失效。**我没有在浏览器里实测**。
   与埋点无关（NavigationRoute 只吃导航请求），但值得单独开一条检查。
2. **`data-auto-track` 在 SPA 里确实自动记录路由变化**，与"可能不自动"的直觉相反（官方文档
   明确写了监控 pushState/replaceState/popstate）。因此**不要**再写路由变化的页浏览埋点，
   否则会重复计数。
3. **`.env.production` 是已提交文件**（`.env` 反而被 gitignore），所以"生产配置进仓库"是本项目
   现状；`VITE_UMAMI_WEBSITE_ID` 放这里等于公开（website-id 本来就是公开值，没问题），
   但要清楚它同时会被本地 `npm run build` 用上 —— 本地预览的防护靠 `data-domains`，不是靠 env。
4. **`/dev` 在线上是开的**（`.env.production` 的 `VITE_ENABLE_DEV_MODE=true`），
   所以必须用 `data-before-send` 挡 `/dev` 的页浏览。
5. **`useRogueliteStore` 是模块级单例且 DevMode 也 import 它**，所以 store 层的订阅逻辑在 `/dev`
   也会存在；只是 DevMode 不驱动引擎、不会产生玩法事件。如果将来 DevMode 增加了"驱动引擎"的工具，
   需要重新审视事件门控。
6. **`run_start` 不经过引擎 `_emit()`**（`confirmWorldIntro` 只是 store 的 `set`），
   必须显式埋点 —— 只做订阅 diff 会漏掉开局。
7. **`run_end.node` 不能直接用 `next.nodeIndex`**：`_advanceToNextNode` 先自增后判结束，结局时是 34。
