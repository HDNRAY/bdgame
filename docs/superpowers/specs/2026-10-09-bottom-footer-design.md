# 常驻底部栏（footer）— 设计 spec

日期：2026-10-09
状态：设计已与用户确认（brainstorming 产物）。本文只固化设计，不含实现；下一步是写实现计划。
一句话：在 `<Routes>` 外面套一个常驻底栏（图鉴 / 玩法 / 设置 / 关于）；设置 / 关于 / 玩法走共用的 `Modal` 外壳，图鉴走它的全屏变体。

## 1. 背景、目标与用户决策

### 1.1 背景

- 四个入口只在首页（`src/ui/screens/ModeSelect/ModeSelect.tsx:38-71`）：图鉴 / 玩法 / 设置 / 关于。
- 玩法是本地 state 开的弹窗；图鉴 / 设置 / 关于是整页路由 —— 一离开首页就没有入口，也没法边打边调字号。

### 1.2 目标

1. 常驻底栏收进四个入口，出现在**所有路由**上、永不隐藏。
2. 设置 / 关于 / 图鉴改成弹层（玩法本来就是）。
3. 任何界面都能一键调字号 / 主题。

### 1.3 用户决策（用户定的）

| 编号 | 决策 | 说明 |
| --- | --- | --- |
| D1 | 底栏出现在所有界面（战斗 / 结算 / DevMode / 故事开场与章页），**不隐藏** | 理由（用户原话）：**任何时候我都可以调整字号、主题颜色等**。推论：底栏 z-index 高于所有弹窗遮罩与页面内容、始终可点；开着 A 能直接切到 B。 |
| D2 | 图鉴 = 全屏遮罩层 + 底栏入口激活态（`aria-pressed` + 视觉） | |
| D3 | 保留 `/settings`、`/about`、`/encyclopedia` 路由 | 弹窗是主入口，路由作深链接仍可用；路由页照旧完整渲染。 |
| D4 | 底栏按钮**无边框**、纯文字 | 不要图标、不引图标库。 |
| D5 | DevMode 也放底栏，但不管它的 H5 | 依据 `AGENTS.md`「DevMode 与 H5」豁免。 |
| D6 | **抽共用 `Modal` 外壳**，既有「玩法」弹窗迁上去 | 用户明确要求；一个外壳、四个使用者（设置 / 玩法 / 关于 / 图鉴）。 |
| D7 | 不抽内容组件、不懒加载 | 直接复用现有三个屏幕；删掉懒加载争论，不动 `AGENTS.md` 的动态 import 例外。 |
| D8 | `RotateDevice` 保持比底栏高 | 「请旋转至竖屏」全屏层可以盖住底栏，见 §6 的 z-index 例外。 |

## 2. 现状与关键约束（读代码的事实）

- **外壳**：`App.tsx` = `BrowserRouter` > `AppShell`（返回 fragment，不产生 DOM）> `RotateDevice` + `Suspense` > `Routes`；`index.css:67-76` 的 `#root` 是 flex column。`BrowserRouter` / `AppShell` / `Suspense` / `Routes` 都不产生 DOM，所以**路由页根元素是挂载容器的直接子级** —— 把底栏套在 `<Routes>` 外面就覆盖全部路由（含 `/dev`）。
- **既有玩法弹窗**（`ModeSelect/GameplayModal.tsx`）：关闭途径只有 `×`、点背景（overlay `onClick` + panel `stopPropagation`）、底部「知道了」；**没有** Esc、焦点管理、`role="dialog"`、portal。仓库里语义完整的是 `src/ui/components/panels/TournamentPanel.tsx`（Esc + `role="dialog" aria-modal` + 独立 backdrop，`:37-49`）。→ `Modal` 的基准是「GameplayModal 的视觉 + TournamentPanel 的语义」。
- **三个屏幕**：`SettingsScreen` / `AboutScreen` / `EncyclopediaScreen` 已是完整实现，可整块塞进弹层；它们的页首与「返回」是页面外壳，嵌入时要处理（§3.4、§9-1）。`EncyclopediaScreen` 本来就是全屏内容（`.encyclopedia { height: 100vh; overflow: hidden }`）。
- **token**：`themes.css` 只有颜色；`tokens.css` 没有底栏 / 安全区 / z-index 变量；`env(safe-area-inset-bottom)` 就地写在 5 处。
- **局内滚动**：`.rs`(`height:100vh`) > `.rs-header`(`flex-shrink:0`) > `.rs-body`(`flex:1; overflow:hidden`) > `.rs-rounds`(`flex:1; overflow-y:auto`) > `.rs-battle`（`flex-shrink:0`，`RogueliteScreen.scss:315-318` 记着「被压成 0 高、选完花大师卡死」的历史 bug）。`BattlePanel.scss` 无视口高度。
- **`.rc-current { flex: 1 }`**（`RoundCard.scss:3`）是 `.rs-rounds` 里唯一会被收缩的项。
- 与假设不符 / 必须注意：
  1. `ModeSelect.test.tsx:62-65` 断言首页渲染结果含那四个入口文本 —— 入口搬走后必红，要改。
  2. `RotateDevice` 是 `z-index: 9999` 的不透明全屏（横屏手机 ≤768px）。
  3. `SettingsScreen.tsx:14-18` 的三个主题选项带 emoji 前缀，与 `AGENTS.md`「禁止 emoji」相抵。
  4. **仓库无 jsdom**（`vitest.config.ts` 未设 environment）→ Esc / 焦点 / 几何只能靠无头 Chrome，SSR 只测渲染结果。
  5. `scripts/ui-geometry.mjs` 的默认断言集只有 `home / settings / encyclopedia`，且没有点击式准备步骤；`battle` 不带参数会重定向到 DevMode。

## 3. 结构设计

### 3.1 挂载（`App.tsx`）

```tsx
<AppShell>
    <RotateDevice />
    <div className="app-content">          {/* 唯一一处给内容让位的容器 */}
        <Suspense fallback={<RouteFallback />}>
            <Routes>…</Routes>
        </Suspense>
    </div>
    <BottomBar />                          {/* 常驻；刻意在 Routes 之外 */}
</AppShell>
```

### 3.2 新增文件（分层按 `AGENTS.md`）

| 文件 | 职责 |
| --- | --- |
| `src/ui/components/ui/Modal/Modal.tsx` + `Modal.scss` | 通用弹层外壳（`ui/` 原子层）：`modal` / `fullscreen` 两变体 |
| `src/ui/components/layouts/BottomBar/BottomBar.tsx` | 底栏本体（`layouts/` 常驻 chrome）：四项 + 开合状态 + 路由变化 |
| `src/ui/components/layouts/BottomBar/BottomPopups.tsx` | 四个使用者：设置 / 玩法 / 关于（`Modal`）+ 图鉴（`fullscreen`） |
| `src/ui/components/layouts/BottomBar/BottomBar.scss` | 底栏样式 + 嵌屏覆盖 |
| `src/ui/components/layouts/BottomBar/BottomBar.test.tsx` | SSR 回归 |

### 3.3 `Modal`（一个外壳，四个使用者）

- API：`title`、`onClose`、`children`、`footer?`、`variant?: 'modal' | 'fullscreen'`、`className?`。
- 结构：overlay（点背景关闭、`-webkit-tap-highlight-color: transparent`）> panel（`role="dialog"` + `aria-labelledby={useId}` + `tabIndex={-1}`）> header（标题 + `×`）+ body（`flex:1; overflow-y:auto`）+ `footer?`。
- **不写 `aria-modal="true"`**：底栏在其上始终可点，语义上不是模态对话。
- **Esc**：`useEffect` 注册 `keydown`，用**捕获阶段 + `stopPropagation()`** —— 否则会连带关掉下层的 `TournamentPanel`（它也在 window 上听 Esc）。
- **焦点**：开时 `panel.focus()`；关时还给打开前的 `document.activeElement`（mount 存 ref，unmount 恢复）。
- 视觉：面板值照抄 `.gameplay-modal`（`max-width: min(56rem, 92vw)`、`--color-bg-panel` + `--color-border` + `--radius-lg` + `--shadow-lg`）；`max-height` 与 overlay 底边都扣 `--bottom-bar-h`（弹层内容不许被底栏盖住）。`fullscreen` = 铺满「视口 − 底栏」、圆角 0。

### 3.4 四个使用者（`BottomPopups`）

- 设置 / 关于：`<Modal title="设置"><SettingsScreen /></Modal>`、`<Modal title="关于"><AboutScreen /></Modal>` —— **整块复用现有屏幕**。
- 玩法：`GameplayModal` 内部改成 `<Modal title="对战玩法" footer={<Button …>知道了</Button>}>` + 现有 Section 内容；`.gameplay-*` 的**外壳规则**（overlay / modal / header / body / footer）删掉，内容规则（section / sub / btn）留在 `GameplayModal.scss`。
- 图鉴：`<Modal variant="fullscreen" title="图鉴"><EncyclopediaScreen /></Modal>` —— 本来就是全屏内容，改动接近零。
- 嵌屏适配**只写 scss**（`BottomBar.scss` 约 8 行：隐藏页首 / 返回、`height: auto; padding: 0`），**零 TSX 改动**；见 §9-1。
- 开合状态：`active: 'encyclopedia' | 'gameplay' | 'settings' | 'about' | null` 单值 → 天然实现「开着 A 直接切 B」「再点同一个关掉」。

## 4. 行为细则

### 4.1 底栏

- 定位：`position: fixed; left/right/bottom: 0`；`height: var(--bottom-bar-h)`；`padding-bottom: env(safe-area-inset-bottom, 0px)`；`z-index: var(--z-bottom-bar)`。
- **不透明**：`background: var(--color-bg-panel)` + 顶部 `1px solid var(--color-border)`（否则下层弹窗内容会从底栏底下透出来）。
- 四项：图鉴 / 玩法 / 设置 / 关于（沿用首页顺序），**纯文字、无图标**（D4）。
- 无边框：原生 `<button>` + `background: none; border: none`（与 `.tnp-tab` / `.dev-mode-nav-item` / `.encyclopedia-tab` 同类，不套 `Button`）。
- 触摸目标 ≥44×44：`flex: 1 1 0; min-width: 44px; height: 100%`（`--bottom-bar-content-h` 下限 44px；320px 视口下每项约 80px 宽）。
- 状态：`:hover` 只在 `@media (hover: hover)` 内（`background: var(--color-bg-hover)`）；`:active` 一律 `background: var(--color-pressed); color: var(--color-on-accent)`（仓库按下口径）。
- 激活态（D2）：图鉴层开着、或当前路由是 `/encyclopedia` 时 `aria-pressed="true"` + `color: var(--color-accent)` + `box-shadow: inset 0 2px 0 var(--color-accent)`。

### 4.2 开合与关闭

- 点入口打开对应弹层；开着 A 时点 B 直接切（A 卸载）；点当前项关闭。
- 关闭方式四者一致：`×`、点背景、Esc（Esc 由 `Modal` 统一处理，玩法弹窗因此也获得 Esc）。
- 浏览器后退导致 pathname 变化 → 关掉弹层（一个 `useLocation` effect）。
- 弹层**不暂停**游戏、**不跳路由**。这正是 D1 成立的原因：`AppShell` 写的 `--ui-scale` / `data-theme` 立即全局生效，zustand store 不丢，当前局内状态不重来。

## 5. 全局空间分配

- 单一来源（`src/ui/styles/tokens.css`）：

```css
--bottom-bar-content-h: max(44px, 2.75rem);
--bottom-bar-h: calc(var(--bottom-bar-content-h) + env(safe-area-inset-bottom, 0px));
--z-bottom-bar: 1500;
```

- **唯一一处给内容让位**（`src/index.css`，一条规则）：

```css
#root .app-content > * { padding-bottom: var(--bottom-bar-h); }
```

  为什么够：路由页根元素（含 `height: 100vh/100dvh`、`min-height: 100vh` 的那几个）都是 `.app-content` 的直接子级；全局 `* { box-sizing: border-box }` 下 `padding-bottom` 只压缩内容盒、不撑高页面；页内原有的 `env(safe-area-inset-bottom)` 底边项被这一条覆盖（`--bottom-bar-h` 已含安全区），**不逐屏改**。
- **例外**（脱离 `.app-content`、`position: fixed` 的弹层，各一行）：`.tnp`（`tournament.scss`）、`.rp-overlay` / `.rp-panel` 抽屉（`RewardPicker.scss`）、`.bs-side-fab` 与 `.bs-side-sheet`（`BattleScreen.scss`）。
- 底栏自己再留一次安全区（§4.1），因为它是 `fixed`、不在 `.app-content` 里。

## 6. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 底栏吃掉局内垂直空间，重演 `.rs-battle` 被压成 0 高 | 结构上不会：`.rs-battle` 是 `flex-shrink: 0`、`BattlePanel` 无视口高度，底栏只让 `.rs-rounds` 变矮并滚动。**回归检查：`.rs-battle` 的 clientHeight 只增不减**（与改动前基线对拍）。 |
| `.rc-current { flex: 1 }` 被压缩，当前轮选项被挤 | 320×568 / 390×844 × `--ui-scale` 1.0 / 2.0 截图与可达性目视；确实被压才动它（YAGNI）。 |
| 玩法弹窗迁到 `Modal` 后视觉漂移 | 面板值照抄；`ui-computed-style.mjs` 的 `home-gameplay` 页对拍（该脚本点文案为「玩法」的按钮，改后点到的是底栏那一项）。 |
| Esc 连带关掉下层 `TournamentPanel` | `Modal` 的 Esc 用捕获阶段 + `stopPropagation`（§3.3）。 |
| `ModeSelect.test.tsx` 断言失效 | 改成断言首页不再自带四个入口；四个入口的断言移入 `BottomBar.test.tsx`。 |
| 首屏体积变大（三个屏幕改为静态 import） | 用户已决定不懒加载；`npm run build` 看 chunk 警告，**不作通过条件**。 |
| z-index 例外被误当缺陷 | 层高：页面内容与遮罩（`.rs-overlay` 1 / `.bs-side-fab` 50 / `.bs-side-overlay` 100 / `.run-summary` 900 / 弹层与全屏层 1000 / `.rp-overlay` 1200）< **底栏 1500** < Tooltip 9999 < **`RotateDevice` 9999（唯一例外：阻塞态的旋转提示，覆盖底栏是预期行为）**。Tooltip 是瞬态浮层（指针离开即关），不构成常驻遮挡。 |

## 7. 验证计划

1. **五项闸门**：`npx tsc --noEmit -p tsconfig.app.json`、`npx eslint src/ --quiet`、`npx vitest run`、`grep -rn ' as any' src/engine/`、`node scripts/ui-geometry.mjs --theme both`。
2. **SSR 测试**（无 jsdom，`renderToStaticMarkup` 按 props 驱动状态）：
   - `BottomBar`：四项恰为 图鉴 / 玩法 / 设置 / 关于，`aria-pressed` 随 props（图鉴层开着 / 路由是 `/encyclopedia`）变化；渲染结果无 emoji。
   - `Modal`：`role="dialog"`、标题、关闭钮、`footer`、`fullscreen` 变体。
   - 四个使用者打开时渲染出对应屏幕的关键文案；路由页 SSR 文案金样（设置 / 关于 / 图鉴三页不变）；首页不再含四个入口。
   - 明说测不到：Esc、背景点击、焦点归还、实际高度、触摸目标尺寸（SSR 不跑 `useEffect`、没有布局）。
3. **几何脚本**（扩 `scripts/ui-geometry.mjs`）：`PAGES` 补全部玩家可见页（`about`、`build/ajiu`、`battle?a=ajiu&baihu`、`roguelite` 开场页，并加点击式 `prepare` 进到局内与战斗轮）；三档 390 / 320 / 1280 × 亮暗。断言：`scrollWidth == innerWidth`、无元素越出视口、底栏完整在视口内且高 == `--bottom-bar-h`、四个入口命中区 ≥44×44。**`.rs-battle` 专项**：把它的 `clientHeight` 写进 `geometry.json`，与改动前基线对拍，只增不减。DevMode 页只作参考（D5）。
4. **样式对拍**：`node scripts/scss-triples.mjs`；`node scripts/ui-computed-style.mjs --out` 存改动前基线，改后 `--diff`，差异逐条解释；截图存 `tmp/preview/` 目视（含四个弹层各开一次）。
5. **变异验证**：删掉 `#root .app-content > *` 那条留底 → 几何脚本必须报遮挡；把 `aria-pressed` 写死 `false` → `BottomBar.test.tsx` 必红。

## 8. 不做的事（YAGNI）

- 不抽内容组件（直接复用现有三个屏幕）；不懒加载；不动 `AGENTS.md` 的动态 import 例外。
- 不重写三个屏幕的正文 / 文案；只删 `SettingsScreen.tsx` 的三处 emoji 前缀（已同意）。
- 不动引擎 / 数据 / 像素美术 / 存档；不给 DevMode 做窄屏适配。
- 不做底栏自定义 / 拖拽 / 排序 / 隐藏 / 自动收起；不做图标；不加键盘快捷键；不新增设置项。
- 不改 `RotateDevice`（D8 接受它盖住底栏）。

## 9. 待确认（3 条，都有默认与回退）

1. **弹层里三个屏幕的页首 / 返回按钮**：默认**隐藏**（`BottomBar.scss` 约 8 行 scss，零 TSX 改动）；想保留就删掉那 8 行，但弹层头部与屏内标题会重复。
2. **图鉴搜索框的 `autoFocus`**（现有）：默认**保留**（不动 TSX），代价是移动端一打开就弹软键盘；要关就加 `embedded` prop 走 1 行条件。
3. **激活态范围**：默认**图鉴 + 当前打开的那一项**都给 `aria-pressed` 与同款视觉；若只想要图鉴有，删掉其余三项的绑定与一条 scss 规则。
