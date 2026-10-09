# 常驻底部栏（footer）— 设计 spec

日期：2026-10-09
状态：设计已与用户确认（brainstorming 产物）。本文只固化设计，**不含任何实现**；下一步是写实现计划。
范围：一个常驻底部栏，收拢首页底部的四个入口；设置 / 关于改弹窗，图鉴改全屏遮罩层。

---

## 1. 背景、目标与用户决策

### 1.1 背景（现状的痛点）

首页底部有一排入口：图鉴 / 玩法 / 设置 / 关于（`src/ui/screens/ModeSelect/ModeSelect.tsx:38-71`）。
其中玩法是本地 state 开的弹窗，另外三个是整页路由：

- 只有首页能到这四个入口。进了战斗、结算、故事开场页、DevMode 就没有了。
- 设置是整页路由，进去就离开当前上下文。想边打边调字号做不到。

### 1.2 目标

1. 新增一个**常驻底部栏**，把四个入口收进去。
2. 设置、关于改成**弹窗**（与既有「玩法」弹窗同构）；图鉴改成**全屏遮罩层**。
3. 底栏**永远留在屏幕上**，任何界面都能一键调整字号 / 主题。

### 1.3 用户决策（用户定的，来源：本次 brainstorming）

下列五条是用户拍板的口径，实现与计划不得偏离；每条附用户给的理由与由此推出的约束。

| 编号 | 决策 | 用户给的理由 / 推论 |
| --- | --- | --- |
| D1 | 底栏出现在**所有界面**（含战斗、结算、**DevMode**、故事开场 / 章页），**不隐藏**。 | 理由（用户原话）：**任何时候我都可以调整字号、主题颜色等**。底栏是「随时可达的设置入口」，所以不能被全屏层或弹窗遮罩挡住。推论：底栏 **z-index 高于所有弹窗遮罩与全屏层，且始终可点**；开着某个弹窗时也能直接切到另一个。 |
| D2 | **图鉴 = 全屏遮罩层 + 底栏入口显示激活态**（`aria-pressed` + 视觉）。 | 全屏层不是弹窗：它铺满视口，底栏用它自己的激活态表达「图鉴开着」。 |
| D3 | **保留原路由**（`/settings`、`/about`、`/encyclopedia`）：弹窗是主入口，路由作为深链接仍可用。 | 已发出的链接 / 书签 / PWA 深链不能断；路由页仍渲染完整内容。 |
| D4 | 底栏按钮**无边框**。 | 底栏是常驻 chrome，不是工具条里的一排按钮，不要描边。 |
| D5 | DevMode 也放底栏，**但不管它的 H5**。 | 依据 `AGENTS.md`「开发模式（DevMode）与 H5」一节：`/dev?tab=*` 只保证桌面可用，窄视口的横向溢出 / 越界 / 触摸目标偏小不算缺陷，也不为它们牺牲桌面布局。 |

---

## 2. 现状（读代码得到的事实）

### 2.1 路由与外壳结构，底栏挂在哪一层

`src/App.tsx` 的结构（102 行）：

```
BrowserRouter (basename = PROD ? '/bdgame' : '/')
└─ AppShell                     // 把 theme / --ui-scale 写到 <html>
   ├─ RotateDevice              // 横屏手机提示（9999）
   └─ Suspense fallback=RouteFallback
      └─ Routes                 // / /build/:charId /settings /about /encyclopedia
                                // /battle /roguelite /dev(条件) *
```

事实：

- `AppShell`（`App.tsx:49-73`）是**纯注入层**，返回 `<>{children}</>`，不产生 DOM。主题与字号都在这里生效：
  `document.documentElement.dataset.theme`（`:56`）、`--ui-scale`（`:60`）。
- **没有任何持久外壳元素**。每个 screen 自己占满视口，路由切换等于整页换 DOM。
- 路由表在 `App.tsx:85-96`；`/dev` 只在 `VITE_ENABLE_DEV_MODE === 'true'` 时注册（`:79`、`:93`）。
- `src/index.css:67-76` 里 `#root` 是 `display:flex; flex-direction:column; min-height:100svh`，
  但 Routes 的输出是 `#root` 的 flex 子项，中间没有额外容器。
- `stories` 的开场 / 章页 / 结算页**不是路由**：它们在 `RogueliteScreen` 里以 `return` 直接返回
  全屏组件（`IntroOverlay`、`RunSummaryPanel`），所以它们都在 `/roguelite` 这一条路由下。

**结论：底栏必须挂在 `App()` 里、`BrowserRouter` 之内、`AppShell` 的子节点位置上、`Suspense` 之外。**
放在 `Suspense` 之外才能在路由 chunk 加载中（`RouteFallback` 期间）也显示；放在 `BrowserRouter` 之内才能读
`useLocation`（图鉴激活态需要）。目标骨架：

```tsx
<BrowserRouter basename={basename}>
    <AppShell>
        <RotateDevice />
        <BottomBar />            {/* 新增：常驻，永不隐藏 */}
        <Suspense fallback={<RouteFallback />}>
            <Routes>…</Routes>
        </Suspense>
    </AppShell>
</BrowserRouter>
```

### 2.2 既有「玩法」弹窗做了什么（与假设不符，见 2.8-1）

`src/ui/screens/ModeSelect/GameplayModal.tsx`：

- 结构：`.gameplay-overlay`（`position:fixed; inset:0; background:var(--color-overlay); z-index:1000`）
  → `.gameplay-modal`（居中面板，`max-height:82dvh`，内部 flex column）
  → `.gameplay-header`（标题 + `×` 关闭钮） + `.gameplay-body`（`flex:1; overflow-y:auto`）
  + `.gameplay-footer`（「知道了」按钮）。
- 关闭途径**只有三条**：`×`、点背景（overlay 上的 `onClick={onClose}`，面板上 `stopPropagation`）、
  底部「知道了」。
- **没有** Esc 监听、**没有** `role="dialog"` / `aria-modal`、**没有**焦点管理、**没有** `createPortal`。
- 调用点只有一个：`ModeSelect.tsx:73`。

仓库里另有一个更完整的同构实现，可作为语义基准：`src/ui/components/panels/TournamentPanel.tsx`

- `useEffect` 里 `window.addEventListener('keydown')` 处理 Esc（`:37-43`）；
- `role="dialog" aria-modal="true" aria-label`（`:46`）；
- 背景是**独立的** `.tnp-backdrop` 元素（`aria-hidden="true"`，`onClick` 关闭，关了触屏高亮），
  面板是它的兄弟节点，不靠 `stopPropagation`（`:48-49`）。

**能不能抽成共用外壳？能。** 抽一个 `Modal` 外壳（overlay + backdrop + 面板 + 头部 + 可滚动正文 +
可选底部动作），把 GameplayModal 重写成它的内容；设置 / 关于 / 图鉴（fullscreen 变体）复用它。
要改的调用点：

- 改写：`ModeSelect.tsx:73`（玩法弹窗的调用点会随首页 footer 一起移到底栏）；
- 新增：底栏的设置 / 关于（modal 变体）、图鉴（fullscreen 变体）。

### 2.3 三个屏幕能不能抽「内容组件」（路由页与弹窗共用一份）

| 屏幕 | props / 依赖 | 内部状态 | 可抽取性 |
| --- | --- | --- | --- |
| `SettingsScreen.tsx`（113 行） | `useNavigate`（只给「返回主菜单」用）、`useAppStore` 的 `theme/uiScale/typewriter` + 三个 setter | `dragScale`（滑块拖拽中的本地值，`mouseup/pointerup` 才提交，`:28-34`） | 可抽。正文 = 主题 / UI 缩放 / 叙事三节；`设 置` 标题与「返回主菜单」是页面外壳的东西。 |
| `AboutScreen.tsx`（23 行） | `useNavigate`（只给「返回」用） | 无 | 可抽。正文 = 一段文案（炁 / 赛博朋克 + 炼炁士 1v1 肉鸽 / TS+Vite+React）。 |
| `EncyclopediaScreen.tsx`（163 行） | `useNavigate`（只给「返回」用）；重数据 import：`WEAPON_DB`、`STARTING_WEAPONS`、`PASSIVES`、`TALENTS`、`ARTIFACTS`、`SUPPORT_ACTIONS`、`allMainActions`、`TAG_CN`、`getWeaponOverlay`、`entityTooltipContent` | `activeCategory`、`search` | 可抽。正文 = 搜索框 + 四个页签 + 卡片网格；`返回` 是页面外壳的东西。 |

结论：三个屏幕都能抽成「正文内容组件」，让路由页与弹层共用同一份实现，不需要写两遍。
抽取范围 = **正文 + 它自己的本地 state**；**标题、返回 / 关闭按钮、页面级容器**留在各自的外壳
（路由页给标题 + 返回；弹窗给 Modal 头部；全屏图鉴层给自己的头部）。

两个必须写进设计的副作用：

1. **首屏体积**：`EncyclopediaScreen` 现在是路由级懒加载（`App.tsx:15-17`），所以图鉴数据和它的
   scss 不进首屏。底栏若要同步 `import` 图鉴内容组件，会把全部图鉴数据拉进首屏 chunk。
   → 底栏的四个面板**必须按需加载**（`React.lazy` + `Suspense`）。但这与 `AGENTS.md` 的
   「唯一例外：UI 的路由级代码分割」有出入，见 8-6。
2. **样式归属**：`src/ui/components/layouts/CompareScreen/CompareScreen.tsx` 的先例写明
   「样式必须写在组件自带的 scss 里（不能只抽一个共用 scss 文件）」——因为路由级 chunk 各自带样式。
   内容组件同理：**由内容组件自己 import 屏幕的 scss**，路由页只 import 内容组件（传递生效）。

### 2.4 `--ui-scale`（字号缩放）与主题是怎么切换的、在哪读的

- 变量：`src/ui/styles/tokens.css:8` 定义 `--ui-scale: 1`（注释写明「controlled by JS/settings」）。
- 写入：`src/App.tsx:59-61` 的 `useEffect` 把它写到 `<html>` 的 inline style；
  主题写到 `<html data-theme>`（`:55-57`）。两者都读自 `useAppStore` 的 `uiConfig`。
- 生效：`src/index.css:53` — `:root { font-size: clamp(12px, calc(16px * var(--ui-scale) + 0.15vw), 48px) }`。
  所有 `rem` 尺寸都跟着根字号走。实测口径：scale 0.5 时根字号被 clamp 到 12px；scale 2.0 时约 32.6px（@390px 宽）。
- 持久化：`src/ui/stores/app-store.ts` 的 `localStorage['bdgame-ui-config']`，`loadUiConfig()` 在模块初始化时读。

**结论：「任何时候调整字号 / 主题」这件事，机制上已经成立。** 底栏挂在 `AppShell` 层级、设置弹窗
**不跳路由**，所以改完立刻全局生效，且当前局内状态（zustand store 是模块级单例）不丢。
这是 D1 那条理由在代码里站得住的根据。

**推论（必须写进设计）**：`--bottom-bar-h` 若用 `rem`，会随字号一起变大（scale 2.0 时底栏会明显更高）。
这不是 bug，是 D1 的直接后果（字号调大，标签也要跟着大）。但触摸目标必须有 44px 下限兜底，
且**所有空间分配都必须用变量，不许写死 px**。

### 2.5 主题 token 文件里有没有现成的底栏 / 安全区 / 层高变量

没有。逐条查证：

- `src/ui/styles/themes.css`（290 行）只有颜色 token（`--color-*`、`--tag-color-*`、`--shadow-*`、
  `--scrollbar-*`）；**没有任何布局 / 安全区 / z-index 变量**。
- `src/ui/styles/tokens.css`（66 行）有 `--ui-scale`、`--sidebar-width`、`--header-height`、`--sp-*`、
  `--font-*`、`--radius-*`、`--border-width*`；**没有 `--bottom-bar-*`，没有 z-index 变量**。
- `env(safe-area-inset-*)` 全部是**就地写死**的，共 4 处底部安全区 + 1 处 tournament 四周：
  见下一小节的清单。

### 2.6 现在哪些容器已经留了底部内边距 / 安全区（避免叠加）

| 文件:行 | 现有表达式 | 与底栏的关系 |
| --- | --- | --- |
| `ModeSelect.scss:17-18` | `padding: … calc(var(--sp-md) + env(safe-area-inset-bottom))` | 会叠加，必须改 |
| `RunSummaryPanel.scss:19-20` | `.rsm-inner` 同上（`--sp-lg`） | 会叠加，必须改 |
| `RunSummaryPanel.scss:166-174` | `.rsm-foot` `position:sticky; bottom:0; padding-bottom: calc(var(--sp-md) + env(safe-area-inset-bottom))` | 会被底栏盖住，必须改 |
| `tournament/tournament.scss:324-337` | `.tnp` 四周 env 安全区 | 会叠加，必须改 |
| `CharacterPanel/RewardPicker.scss:241` | `.rp-panel`（≤640px 抽屉）`padding-bottom: env(safe-area-inset-bottom,0px)` | 抽屉底部会被底栏盖住，必须改 |
| `roguelite/IntroOverlay.scss:16` | `padding: var(--sp-lg)`（无安全区） | 内容可能到底部，需补底栏高度 |

**高度基准（哪些不是 `100dvh`）**：

- `100dvh`：`ModeSelect`（`min-height`）、`RunSummaryPanel`、`.tnp`、`.dev-mode`、`.not-found`、`TagPreview`。
- `100vh`：`.rs`（`RogueliteScreen.scss:2`）、`.settings-screen:4`、`.about-screen:4`、
  `.battle-screen-root`（`min-height`）、`App.tsx:32` 的 `RouteFallback`。
- `100svh`：`#root`（`index.css:70`）。

结论：`100vh` 的那几处本来就是移动端地址栏隐患，这次顺手统一到 `100dvh`（见 §4 清单）。

### 2.7 战斗 / 局内界面的滚动容器结构（本次风险的核心）

`RogueliteScreen.scss`：

- `.rs`（`:1-8`）：`height: 100vh; display:flex; flex-direction:column`。
- `.rs-header`（`:10-27`）：`flex-shrink:0`。
- `.rs-body`（`:74-78`）：`flex:1; display:flex; overflow:hidden`。
- `.rs-rounds`（`:80-87`）：`flex:1; overflow-y:auto; display:flex; flex-direction:column; gap`。
  **这是局内的滚动视口。**
- `.rs-battle`（`:307-319`）：`display:flex; flex-direction:column; overflow:hidden; flex-shrink:0`。
  文件里 `:315-318` 的注释记着历史 bug：

  > 自己带 `overflow:hidden` 的 flex item 自动最小高度是 0：不加 `flex-shrink: 0`，
  > `.rs-rounds`（flex column + `overflow-y:auto`）会把它压成 0-19px，整块战斗面板连同
  > 「继续/确认」按钮一起被裁掉（选完花大师后卡死就是这个）。

- `BattlePanel.scss` 里**没有任何 `height` / `vh` / `dvh` 规则** → BattlePanel 的高度由内容决定。

**回答用户的风险问题**：把 `.rs` 的可视高度减少 `--bottom-bar-h`，`.rs-battle` **不会被压回 0** ——
它自己 `flex-shrink: 0`，且内容高度不由视口决定。底栏只会让 `.rs-rounds` 的视口变矮、可滚动区域变少。
但这次改动引出**两个新的相邻风险**（都进 §5）：

1. `.rc-current { flex: 1 }`（`RoundCard.scss:3`）是 `.rs-rounds` 里唯一会被收缩的 flex 项
   （`flex: 1` = `flex: 1 1 0%`）。底栏吃掉高度后，当前轮卡片会被压缩，选项可能被挤或触发
   flex item 压缩 / 滚动容器的老问题。`.rs-battle` 有保护，`RoundCard` 没有。
2. 竖屏侧栏用 `vh` 基准：`.rs-portrait .rs-sidebar.rs-build { flex: 0 0 80vh; max-height: 80vh }`
   （`:218-221`），`.rs-view` 是 `35vh`（`:214-217`）。这些基准不随 `.rs` 收缩而变，
   所以 `80vh + header + 底栏` 在矮屏 / 大 `--ui-scale` 下可能超出 `.rs`（`.rs` 没有 `overflow-y`）。

另外确认：`.rs-overlay`（备战遮罩，`:118-123`）是 `position:fixed; inset:0; z-index:1`，
它铺满**视口**而不是 `.rs`，底栏（z-index 更高）会盖在它上面 —— 这正是 D1 要的。

### 2.8 与用户假设不符的地方（逐条）

1. **「与既有玩法弹窗同构」的既有弹窗，没有 Esc / 焦点 / aria 语义。** 只有背景点击 + `×` + 底部按钮
   三条关闭途径（2.2）。如果照抄它的语义，会把这些缺陷复制到设置 / 关于。
   → 抽 `Modal` 外壳时以「GameplayModal 的视觉 + TournamentPanel 的语义」为基准。
2. **首页那排入口有一条会红的既有测试。** `src/ui/screens/ModeSelect/ModeSelect.test.tsx:62-65`
   断言「ModeSelect 的渲染结果里含 图鉴 / 玩法 / 设置 / 关于 四个文本」。入口搬到底栏后，
   这条断言必然失败 —— 不是实现 bug，是断言要跟着新的事实来源改（见 §6）。
   注意它用 `renderToStaticMarkup(<MemoryRouter><ModeSelect /></MemoryRouter>)` 单独渲染首页，
   拿不到 App 层的底栏，所以「渲染 App 外壳」这条路在无 jsdom 的测试环境里不成立。
3. **「永不隐藏」与 `RotateDevice` 冲突。** `RotateDevice.scss:6-15` 在
   `@media (orientation: landscape) and (max-width:768px)` 下显示 `position:fixed; inset:0; z-index:9999`
   的**不透明**全屏「请旋转至竖屏」。要真「永不隐藏」，底栏就得压过它，等于在旋转提示上放一排按钮。
   → §8-1 请用户定。
4. **底栏要压在「奖励三选一」之上。** `RewardPicker` 的 `.rp-overlay` 是 `z-index:1200` 的全屏遮罩，
   底栏按 D1 在它上面。含义是：选奖励途中也能打开设置。这符合 D1 的意图，但要明确
   「打开设置不暂停战斗、不代选奖励」。→ §8-13。
5. **`SettingsScreen` 的主题选项写死了 emoji 前缀**（`SettingsScreen.tsx:14-18`：「浅色 / 深色 / 系统」
   三项的标签各带一个 emoji，依次是太阳 / 月亮 / 手提电脑），与 `AGENTS.md`「禁止 emoji」相抵。
   本次 spec 不授权改屏幕内容（§7），
   但抽内容组件时会原样搬进弹窗 —— emoji 也跟着进弹窗。→ §8-7 请用户定。
6. **几何脚本现在覆盖不到「全部玩家可见页」。** `scripts/ui-geometry.mjs:244-249` 的 `PAGES` 只有
   `home / settings / encyclopedia / tag-preview`；默认断言集是前三项（`:14-15`）。
   `ui-computed-style.mjs:32-48` 有 `about / battle / roguelite`，但它没有参数 / 点击准备：
   `battle` 无 `?a=&b=` 时会 `navigate(DUEL_TAB_PATH)` 重定向到 `/dev?tab=duel`
   （`BattleScreen.tsx:25-27`），量到的其实是 DevMode 的单挑 tab。
   → 「全部玩家可见页 × 三档 × 亮暗」要先扩脚本（见 §6）。
7. **仓库没有 jsdom / happy-dom / testing-library**（`package.json` 无依赖，`vitest.config.ts` 未设
   `environment` → 默认 node）。所有 SSR 测试用 `renderToStaticMarkup`，`useEffect` 不跑、
   没有 `window`。**Esc / 焦点归还 / 背景点击这些运行时行为，SSR 测试测不了**，只能靠无头 Chrome（§6）。
   Esc 行为本身也不适合用「按 props 驱动状态」的 SSR 测试覆盖 —— 这条要明说，否则会留下假绿的印象。
8. **`--bottom-bar-h` 之类不存在**，也没有 z-index 变量（2.5）。「单一事实来源」需要新建。

---

## 3. 结构设计

### 3.1 新增 / 修改的单元总览

新增：

```
src/ui/components/layouts/BottomBar/BottomBar.tsx      // 底栏容器（有状态）+ 展示组件 BottomBarView
src/ui/components/layouts/BottomBar/BottomBar.scss
src/ui/components/layouts/BottomBar/BottomBar.test.tsx
src/ui/components/ui/Modal/Modal.tsx                   // 共用弹窗外壳（modal / fullscreen 两变体）
src/ui/components/ui/Modal/Modal.scss
src/ui/screens/SettingsScreen/SettingsContent.tsx      // 设置正文（路由页 + 弹窗共用）
src/ui/screens/AboutScreen/AboutContent.tsx            // 关于正文
src/ui/screens/EncyclopediaScreen/EncyclopediaContent.tsx  // 图鉴正文
```

修改：

- `src/App.tsx`：挂 `<BottomBar />`（2.1 的骨架）。
- `src/ui/screens/ModeSelect/ModeSelect.tsx`：删掉 `mode-select-footer` 四个入口与 `showGameplay` state。
- `src/ui/screens/ModeSelect/GameplayModal.tsx`：重写成 `Modal` 的内容（保留全部文案）。
- `SettingsScreen.tsx` / `AboutScreen.tsx` / `EncyclopediaScreen.tsx`：路由页改为渲染内容组件。
- `src/ui/styles/tokens.css`：新增底栏 / 层高 token（§4.1）。
- §4.2 清单里的布局 scss。
- `src/ui/screens/ModeSelect/ModeSelect.test.tsx`：改断言（2.8-2）。
- `scripts/ui-geometry.mjs`：扩页 + 加 `.rs-battle` 专项（§6.3）。

不新增 store：底栏的弹层状态是**它自己的本地 state**（`activePanel`）。理由：只有底栏会开这四个面板，
没有任何其它模块需要读 / 写它；进 app-store 属于无必要的全局状态。

### 3.2 单元职责（做什么 / 怎么用 / 依赖什么）

#### `Modal`（`src/ui/components/ui/Modal/Modal.tsx`）

- **做什么**：通用弹层外壳。overlay + 背景层（点击关闭）+ 面板 + 头部（标题 + 关闭钮）+
  可滚动正文 + 可选底部动作区。负责 Esc 关闭、`role`、焦点进出。
- **怎么用**（只在该面板激活时挂载，没有 `open` 开关）：
  ```tsx
  <Modal title="设置" onClose={close} variant="modal">{children}</Modal>
  <Modal title="图鉴" onClose={close} variant="fullscreen">{children}</Modal>
  ```
- **依赖**：`react`（`useEffect` / `useRef`）、自己的 `Modal.scss`、颜色 token。不依赖业务数据、不依赖 store。
- **行为契约**：
  - `variant: 'modal' | 'fullscreen'`，默认 `'modal'`。
    - `modal`：居中面板，`max-width: min(56rem, 92vw)`，`max-height` 扣掉底栏；视觉与现在的
      `.gameplay-modal` 逐字一致。
    - `fullscreen`：面板铺满「视口减去底栏」，内部自己滚（图鉴用）。
  - `title` 渲染为头部标题；头部右侧关闭钮（`aria-label="关闭"`，文案 `×`）。
  - 正文是滚动容器（`flex:1; overflow-y:auto`），**外壳负责滚动，内容组件不得自己再套一层页面级滚动**。
  - `footer?: ReactNode`：可选底部动作区（玩法弹窗的「知道了」用它）。
  - Esc 关闭（2.2 的实现警告：与其它全局 Esc 监听者的冲突，见 §5-4）。
  - 焦点：打开时把焦点移到面板（`tabIndex={-1}` + `ref.focus()`）；关闭时把焦点还给触发它的底栏按钮 ——
    这个 ref 由 `BottomBar` 持有并传给 `Modal`（`Modal` 只负责「开时聚焦面板」与「关时回调」）。
  - **不使用 `aria-modal="true"`**（理由与待确认见 3.4 与 §8-2）：底栏在其上仍然可用，
    语义上这不是「模态」对话框。用 `role="dialog"` + `aria-label={title}`。
- **为什么不直接复用 `Tooltip` 的 `createPortal`**：弹层挂在 App 层，本来就在最外层 DOM，
  没有 overflow / transform 的裁切祖先，portal 不必要（`TournamentPanel` / `GameplayModal` 都没用）。
  真遇到裁切再加，YAGNI。

#### `BottomBarView`（纯展示，props 驱动）

- **做什么**：渲染 `<nav class="bottom-bar">` 与四个入口按钮。**不持有状态、不 import 面板**。
- **怎么用**：`<BottomBarView active={active} onSelect={fn} currentPath={pathname} />`。
- **依赖**：`Button`（`variant="bare"`）+ 自己的 scss。四个入口是常量表：
  `[{ id:'encyclopedia', label:'图鉴' }, { id:'gameplay', label:'玩法' },
    { id:'settings', label:'设置' }, { id:'about', label:'关于' }]`（顺序沿用首页现状：
  图鉴 / 玩法 / 设置 / 关于）。
- **为什么要有这个拆分**：仓库无 jsdom，SSR 测试只能用 props 驱动状态（2.8-7）。
  把纯展示层独立出来，`aria-pressed`、四项存在性、按钮可达性都能在 SSR 里断言。

#### `BottomBar`（有状态容器）

- **做什么**：持有 `activePanel: 'encyclopedia' | 'gameplay' | 'settings' | 'about' | null`
  （单一值 → 天然实现「开着 A 也能直接切到 B」）；按需加载并渲染对应面板；close / toggle；
  路由变化时关闭；Esc / 背景点击由 `Modal` 负责。
- **怎么用**：`<BottomBar />`，只在 `App.tsx` 出现一次。
- **依赖**：`BottomBarView`、`Modal`、`SettingsContent` / `AboutContent` / `EncyclopediaContent` /
  `GameplayModal`（后四个走 `React.lazy`）、`react-router-dom` 的 `useLocation`。
- **职责边界**：**不碰游戏状态**，不暂停战斗，不改路由。

#### `SettingsContent` / `AboutContent` / `EncyclopediaContent`

- **做什么**：就是 §2.3 表里那块正文，含自己的本地 state（设置的 `dragScale`、图鉴的
  `activeCategory` / `search`）。**不含**标题、返回 / 关闭按钮、页面级容器与滚动。
- **怎么用**：
  - 路由页 `SettingsScreen.tsx` = `.settings-screen` 容器 + `设 置` 标题 + `<SettingsContent />` +
    「返回主菜单」按钮（**视觉与现在完全一致**）。
  - 弹窗 = `<Modal title="设置" onClose={…}><SettingsContent /></Modal>`。
- **依赖**：各自的 scss（由内容组件 import，见 2.3-2）、store（只有设置需要）、数据层
  （只有图鉴需要）。三个内容组件都不依赖 `useNavigate`。
- **样式归属**：`SettingsContent.tsx` 继续 import `./SettingsScreen.scss`（不拆文件；页面专用的
  `.settings-screen` / `.settings-title` / `.settings-back` 规则留在同一文件里，随 chunk 一起走，
  多出的几行是死规则，无害）。选「不拆」是为了让 `scripts/scss-triples.mjs` 的输出保持逐字一致 ——
  搬规则会让它报「一个文件少了、另一个多了」，白白增加确认成本。图鉴 / 关于同理。

### 3.3 图鉴：为什么是「全屏层」而不是 modal 变体

- `Modal variant="fullscreen"` 与 `variant="modal"` 共用 overlay / backdrop / 头部 / Esc / 关闭语义，
  只换面板的尺寸与圆角。一个外壳、两套布局，避免第二份近似重复的遮罩代码。
- 备选：单独写一个 `FullscreenLayer`。否决理由：Esc / 背景点击 / 头部结构会重复两份，
  将来修一处必忘另一处（`GameplayModal` 与 `TournamentPanel` 已经是这个局面的前车之鉴）。
- 图鉴层自己的头部**不提供「返回」按钮**，只有标题 + 关闭钮（路由页保留「返回」）。

### 3.4 底栏与弹层的关系（z-index 与可点性）

- 底栏 `position: fixed`，在弹层之上（§4.1 的层高表）。
- 因为底栏在自己这一层，开着弹窗时点底栏**不会**穿透到下层的遮罩（overlay 的
  `onClick` 不会被触发：底栏不是它的祖先，且它盖在上面）。
- 同一次只有**一个**底栏弹层（`activePanel` 是单值）：点另一个入口 → 前一个卸载、后一个挂载。
- 底栏的入口按钮**不设 `pointer-events: none`**：任何状态下都可点。
- 视觉上底栏必须**不透明**（`--color-bg-panel` + 顶部描边），否则弹窗内容会从底栏底下透出来。

---

## 4. 全局空间分配

### 4.1 单一事实来源（写进 `src/ui/styles/tokens.css`）

```css
/* ========== 常驻底部栏 ==========
   角色：全局唯一的底栏高度来源。所有「不被底栏盖住」的容器都从这里取高度，
   不许各自再写 env(safe-area-inset-bottom)（本变量已含安全区，重复叠加会多留一块空白）。
   底栏层高：高于所有弹窗遮罩 / 全屏层（最高 1200），低于瞬态浮层（Tooltip 9999）。
   层高现状：.rs-overlay 1 / .bs-side-fab 50 / .bs-side-overlay 100 /
             .run-summary 900 / 弹窗与全屏层 1000 / .rp-overlay 1200 /
             [底栏 1500] / .cp-drag-ghost 10002 / Tooltip 9999 / RotateDevice 9999 */
--bottom-bar-content-h: max(44px, 2.75rem);   /* 一行图标+文字；44px 是 H5 触摸目标下限 */
--bottom-bar-h: calc(var(--bottom-bar-content-h) + env(safe-area-inset-bottom, 0px));
--z-bottom-bar: 1500;
```

- 用 `rem` 让底栏跟着 `--ui-scale` 变大（D1 的直接后果：调大字号的用户，底栏也该跟着大）；
  用 `max(44px, …)` 保证 scale 0.5（根字号 12px）时触摸目标不缩水。
- `--z-bottom-bar` 用**一个**新变量，不去动既有的 z-index 字面量（改动最小，也让
  `ui-computed-style.mjs` 的对拍里少一批无关差异）。

### 4.2 改动点清单（明确、逐条）

规则：**凡是「内容可能落到底部被底栏盖住」的容器，一律用 `--bottom-bar-h` 留空间；
并删掉该容器原本自己加在底边上的 `env(safe-area-inset-bottom)`。**

| 文件:行 | 现状 | 改成 |
| --- | --- | --- |
| `ModeSelect.scss:17-18` | `padding: … calc(var(--sp-md) + env(safe-area-inset-bottom))` | 底边改 `calc(var(--sp-md) + var(--bottom-bar-h))` |
| `RogueliteScreen.scss:2` | `.rs { height: 100vh }` | `height: calc(100dvh - var(--bottom-bar-h))` |
| `RogueliteScreen.scss:218-221` | 竖屏 `.rs-build { flex: 0 0 80vh; max-height: 80vh }` | 基准改成相对 `.rs` 的可用高度（`calc(80dvh - var(--bottom-bar-h) - var(--header-height))` 一类），取值由 §6 的几何验证定稿；不改 `.rs-view` 的 35vh 除非验证不过 |
| `BattleScreen.scss:1-6` | `.battle-screen-root { min-height: 100vh }` | `min-height: calc(100dvh - var(--bottom-bar-h))` |
| `BattleScreen.scss:61-75` | `.bs-side-fab { bottom: var(--sp-md) }` | `bottom: calc(var(--sp-md) + var(--bottom-bar-h))`（否则浮动按钮被底栏盖住） |
| `BattleScreen.scss:117-126` | `.bs-side-sheet { height: 100% }` | 加 `padding-bottom: var(--bottom-bar-h)` |
| `BattleScreen.scss:101-115` | `.bs-side-overlay` 全屏 | 不变（遮罩继续铺满，底栏在其上） |
| `DevMode.scss:3` | `.dev-mode { height: 100dvh }` | `height: calc(100dvh - var(--bottom-bar-h))`（只此一处；H5 豁免） |
| `SettingsScreen.scss:1-6` | `.settings-screen { height: 100vh; padding: var(--sp-xl) }` | `height: 100dvh`；底边 `calc(var(--sp-xl) + var(--bottom-bar-h))` |
| `AboutScreen.scss:1-6` | `.about-screen { height: 100vh }` | `min-height: 100dvh` + 底边 `var(--bottom-bar-h)` |
| `NotFound.scss:1-5` | `.not-found { height: 100dvh }` | 加底边 `var(--bottom-bar-h)` |
| `RunSummaryPanel.scss:4-8` | `.run-summary { height: 100dvh }` | `height: calc(100dvh - var(--bottom-bar-h))` |
| `RunSummaryPanel.scss:19-20` | `.rsm-inner` 底边 `calc(var(--sp-lg) + env(…))` | 底边改回 `var(--sp-lg)`（安全区已含在底栏/高度里） |
| `RunSummaryPanel.scss:166-174` | `.rsm-foot { position:sticky; bottom:0; padding-bottom: calc(var(--sp-md) + env(…)) }` | `padding-bottom: var(--sp-md)`（`.run-summary` 已缩短，sticky 落点自然在底栏之上；若验证发现仍被盖，再给 `bottom: var(--bottom-bar-h)`） |
| `IntroOverlay.scss:16` | `padding: var(--sp-lg)` | 底边 `calc(var(--sp-lg) + var(--bottom-bar-h))`（遮罩仍铺满视口，内容上移） |
| `tournament.scss:324-337` | `.tnp { height:100dvh; padding 四周 env }` | `height: calc(100dvh - var(--bottom-bar-h))`；底边 padding 去掉 env |
| `RewardPicker.scss:230-241` | ≤640px 抽屉 `.rp-panel { height: 92vh; padding-bottom: env(…) }` | `height: calc(92dvh - var(--bottom-bar-h))`，去掉 `env(…)`（或给 `.rp-overlay` 补 `padding-bottom`，取几何验证通过的那个） |
| `Modal.scss`（新） | — | overlay 底边 `calc(var(--sp-md) + var(--bottom-bar-h))`；面板 `max-height` 同时受底栏约束 |
| `BottomBar.scss`（新） | — | `height: var(--bottom-bar-h); padding-bottom: env(safe-area-inset-bottom, 0px); z-index: var(--z-bottom-bar)` |

不动的：`AgentCompare` 一类的 DevMode 子页（D5 豁免）、`.bs-side-overlay` 的遮罩本身、
`.rs-overlay`（遮罩就该铺满视口，底栏盖在它上面）。

### 4.3 被否决的替代方案

- **给 `#root` 统一加 `padding-bottom`**：不成立。要么页面是 `position: fixed`（`RunSummaryPanel`、
  `.tnp`、底栏弹层），要么高度按 `100dvh` 算（`ModeSelect`），两种都脱离文档流 / 不受 `#root` 内边距影响；
  而已经自己留过底边的页面会被叠第二次。所以只能按 §4.2 逐条改。
- **底栏改成正常文档流里的 flex 兄弟**（`#root` 是 flex column）：这与 D1 的 `position: fixed`
  以及「压在 fixed 全屏层之上」冲突，否决。

---

## 5. 风险与缓解

### 5.1 底栏挤压战斗 / 局内垂直空间

- **必查项（用户要求）**：`.rs-battle` 的 `clientHeight` **只增不减**。
  基线在改动前的 commit 上量（同一视口 / 主题 / `--ui-scale`），改动后复量对比。
  理由：它是刚从「被 flex 压成 0 高」（`RogueliteScreen.scss:315-318`）的坑里修出来的，
  这次改动动了同一个 flex 容器的可用高度。
- **结构性判断（§2.7）**：`.rs-battle` 有 `flex-shrink: 0`，BattlePanel 无视口相关高度，
  所以理论上不会被压缩；真正会变的是 `.rs-rounds` 的视口高度。
- **相邻风险 A**：`.rc-current { flex: 1 }`（`RoundCard.scss:3`）会被收缩。验证：320×568 与 390×844、
  `--ui-scale` 取 1.0 与 2.0，进到「当前选项轮」，截图目视 + 断言选项按钮可点、文字不裁切。
  若被压：把 `.rc-current` 改成 `flex: 1 0 auto` 一类，**不预先改**（YAGNI）。
- **相邻风险 B**：竖屏侧栏 80vh 基准 + header + 底栏可能超出变矮后的 `.rs`。
  验证：同上两组视口 × 两组 `--ui-scale`，在「备战 / build 模式」截图 + 断言侧栏底部按钮
  （保存 / 返回）在视口内且不被底栏盖。
- **缓解**：底栏高度本身有 44px 下限，不能靠「把底栏做小」绕过；只能靠 §4.2 的正确留白 +
  上面两条的实测结论。

### 5.2 内容组件抽取带来的回归

- **要求**：`/settings`、`/about`、`/encyclopedia` 三个路由页**视觉不变**（抽样判据：
  SSR 文本与关键结构不变 + 计算值对拍 + 三档截图目视）。
- 三条具体风险：
  1. 页面级滚动容器被搬进 / 搬出内容组件 → 出现双层滚动或滚动失效。
     约束：**滚动归外壳**（路由页由 `.settings-screen` 等页面容器滚，弹层由 `Modal` 的正文滚）。
  2. `.settings-title` 之类的页面标题被搬进内容组件 → 弹窗里出现第二个标题。
     约束：标题属于外壳。
  3. `useNavigate` 被搬进内容组件 → 弹窗里的「返回 / 返回主菜单」会跳路由，与 D3 的精神（弹窗是主入口）冲突。
     约束：内容组件不依赖 router；返回 / 关闭钮属于外壳。
- **判据**：`node scripts/ui-computed-style.mjs --out`（改动前）→ 改动后 `--diff`；
  三个路由页的差异只允许来自底栏新增与底部留白这两类，其余差异逐个解释。

### 5.3 z-index 约定

- 底栏 `--z-bottom-bar: 1500`：高于 `.run-summary`(900) / 弹窗与全屏层(1000) / `.rp-overlay`(1200)，
  低于 `.cp-drag-ghost`(10002) 与 Tooltip(9999) —— 拖拽残影与 tooltip 都是瞬态、后者还该盖住底栏，符合直觉。
- **已知例外**：`RotateDevice` 的 9999 是**不透明全屏**。按这个层高表，横屏手机上底栏会被它盖住，
  与 D1 的「永不隐藏」字面冲突。要么接受这一个例外，要么把底栏提到 9999 之上。→ §8-1。
- **禁止**：任何新弹层直接写比 1500 更大 / 更小的裸数字而不在 `tokens.css` 的层高注释里登记。

### 5.4 Esc 与其它全局监听者冲突

`TournamentPanel.tsx:37-43` 与 `SearchSelect.tsx:182` 都在 `window` 上监听 Esc。
在赛程面板之上再开设置弹窗时，一次 Esc 可能**同时**关掉两层。
缓解（二选一，实现计划定）：

- **A（小）**：`Modal` 的 Esc 监听注册在**捕获阶段**并在命中时 `stopPropagation()`，
  阻止事件到达冒泡阶段的 `window` 监听者。
- **B（稳）**：引入一个极小的模块级 overlay 栈（`push/pop/isTop`），所有带 Esc 的弹层都注册，
  只有栈顶响应。代价是要动 `TournamentPanel`（超出「只加底栏」的范围，需用户认可）。

---

## 6. 验证计划

### 6.1 五项闸门（本仓库口径）

改动期间每次提交前跑：

1. `npx tsc --noEmit -p tsconfig.app.json`（必须带 `-p`，否则假绿）
2. `npx eslint src/ --quiet`
3. `npx vitest run`
4. `grep -rn ' as any' src/engine/`（零命中）
5. `node scripts/ui-geometry.mjs --theme both`（含 §6.3 的扩展后页面集）

样式相关另跑三件套：`node scripts/scss-triples.mjs`、`node scripts/ui-computed-style.mjs`、
`tmp/preview/` 截图目视。

### 6.2 SSR 测试（仓库无 jsdom，用 `renderToStaticMarkup` 按 props 驱动状态）

新增 `BottomBar.test.tsx`：

- `BottomBarView` 传 `active=null` → 渲染出四个按钮，文案恰好是 图鉴 / 玩法 / 设置 / 关于，
  `aria-pressed` 全为 `false`；按钮没有 `border` 类意图（断言 class 含 `bottom-bar-item` 而不是 `btn-ghost` 之类）。
- `active='encyclopedia'` → 图鉴那项 `aria-pressed="true"`，其余 `false`；
  `currentPath='/encyclopedia'` → 同样激活（§8-4 的行为）。
- `active='settings'` → 渲染出设置弹层结构（`role="dialog"`、标题「设置」、关闭钮）；
  `active='about'`、`active='gameplay'` 同理。
- 断言**不存在 emoji**（用 `/\p{Extended_Pictographic}/u` 扫渲染结果），防回归到 AGENTS.md 的禁令
  （注意：既有 `SettingsScreen` 的主题标签含 emoji，见 §8-7；若用户同意删，这条断言才能覆盖设置弹层）。

新增 / 改写内容组件测试：

- `SettingsContent` / `AboutContent` / `EncyclopediaContent` 各自独立渲染通过。
- 三个路由页的 **SSR 文本金样**：`/settings` 仍含 主题 / UI 缩放 / 叙事 / 返回主菜单；
  `/about` 仍含 炁 / 返回；`/encyclopedia` 仍含 图鉴 / 武器 / 功法 / 招式 / 奇物 / 搜索框文案。
- `ModeSelect.test.tsx:62-65` 改成「首页不再自带四个入口」（或删该用例），
  四个入口的断言移入 `BottomBar.test.tsx`。

**明确说明测不到的东西**：Esc 关闭、背景点击关闭、焦点归还、底栏实际高度、触摸目标尺寸 ——
没有 jsdom，`useEffect` 与布局都跑不了，这些一律由 §6.3 / §6.4 覆盖。

### 6.3 几何脚本 `scripts/ui-geometry.mjs`

现状（2.8-6）：默认断言集 `home,settings,encyclopedia` × `390x844 / 320x568 / 1280x800` × `light+dark`。

扩到**全部玩家可见页**：

| 页 | URL | 备注 |
| --- | --- | --- |
| home | `/` | 已有 |
| settings | `/settings` | 已有 |
| about | `/about` | 新增 |
| encyclopedia | `/encyclopedia` | 已有 |
| build | `/build/ajiu` | 新增（`ajiu` 是 `src/data/opponents/ajiu.ts` 的合法 id） |
| battle | `/battle?a=ajiu&b=baihu` | 新增，**必须带参数**（无参数会重定向到 DevMode，见 2.8-6） |
| roguelite-intro | `/roguelite` | 新增（初始即开场页，`gameState` 有初值） |
| roguelite-main | `/roguelite` + 点击「进入」后 | 新增，需 `prepare` |
| roguelite-battle | 继续点进第一场战斗轮 | 新增，需 `prepare`（`.rs-battle` 专项测点） |
| roguelite-summary | 打到结算（成本高） | 尽力；成本过高则只做目视 |
| not-found | `/no-such-page` | 新增 |

脚本改造：

1. `PAGES` 加 `prepare` 字段（参考 `ui-computed-style.mjs:33` 的 `prepare` 机制），
   在 `Page.navigate` + `waitLoad` 之后、`MEASURE` 之前 `Runtime.evaluate` 执行。
2. 新增断言（沿用现有两条，再加三条）：
   - 现有：`documentElement.scrollWidth === window.innerWidth`；无元素越出视口。
   - 新：`.bottom-bar` 的 `getBoundingClientRect()` 完整落在视口内，且
     `bottom <= innerHeight + 0.5`、`height === var(--bottom-bar-h)` 的计算值（±0.5）。
   - 新：底栏四个入口按钮的命中区 `rect.width >= 44 && rect.height >= 44`。
   - 新：底栏覆盖测试 —— 取页面底部 `--bottom-bar-h` 高度的一条横带，断言带内**没有**
     非底栏的可点交互元素（防「按钮被底栏盖住但视觉还在」）。
3. **`.rs-battle` 专项**：`prepare` 里点进第一场战斗轮后，读取
   `document.querySelector('.rs-battle')?.clientHeight` 与 `getBoundingClientRect()`，
   连同视口 / 主题 / `--ui-scale` 写进 `geometry.json`。
   通过条件：与改动前基线相比 `clientHeight` **只增不减**（用户要求）。
4. DevMode 页（`tag-preview` 等）仍只作参考、不作通过条件（`AGENTS.md` 豁免，D5）。
5. 截图留存在 `tmp/preview/`（已 gitignore），不参与判定；亮暗 × 三档 × 上述页面，
   另加「四个弹层各开一个」的目视截图。

`.rs-battle` 专项的不确定性（要写进实现计划）：点进战斗轮依赖故事线的开局选择顺序，
若走不到稳定可复现，则退而求其次 —— 用 `geometry.json` 记录每次量到的值 + 人工对比，
并在计划里明确这就是通过判据；**不要**为了让脚本好写而给产品代码加测试专用钩子。

### 6.4 计算值对拍（重构正确性）

- `node scripts/ui-computed-style.mjs --out tmp/preview/before.json`（改动前）→
  改动后 `--diff`。
- 预期差异：全局新增 `.bottom-bar*`；各层底部留白；`home-gameplay`（该脚本会点文案为「玩法」的按钮，
  改后点到的是底栏的「玩法」）的**弹窗内部**应逐处一致，除底部留白 / `max-height`。
- 其它页面的无关差异必须逐条解释；解释不了就是回归。

### 6.5 变异验证（防假绿，至少两条）

- 把 `.rs` 的 `calc(100dvh - var(--bottom-bar-h))` 改回 `100vh` → 几何脚本必须抓到
  「底部横带内有被底栏盖住的交互元素」或 `.rs-battle` 位置越界。
- 把 `BottomBarView` 的 `aria-pressed` 写死 `false` → `BottomBar.test.tsx` 必红。

---

## 7. 不做的事（YAGNI）

- **不重写三个屏幕的正文 / 文案**。内容组件只做搬迁，一字不改（emoji 主题标签是否删，见 §8-7）。
- **不动引擎 / 数据 / 像素美术 / 存档**（`src/engine/`、`src/data/`、`src/ui/pixel-sprites/`、
  `src/game/meta-save.ts`）。
- **不做用户没要的新功能**：不新增设置项；不做底栏自定义 / 拖拽 / 排序 / 隐藏 / 自动收起；
  不做主题快捷键；不做多语言；不加键盘快捷键。
- **不给 DevMode 做窄屏适配**（`AGENTS.md` 豁免，D5）。
- **不重建「玩法」弹窗的文案结构**（`GameplayModal` 的 193 行内容原样进 `Modal`）；
  该文件的 `SECTION_COLORS` 与 `docs/gameplay-guide.md` 的同步口径不变。
- **不为了脚本好写而在产品代码里留测试钩子**（§6.3）。
- **不引入新的 UI 依赖**（不装 jsdom、不装 testing-library、不装图标库；图标用内联 SVG）。

---

## 8. 待确认 / 假设

以下是我读到代码后发现的矛盾、缺口与我按常识填的默认值。**没有拍板，等用户定**；
每条给出我的判断与它影响的范围。

1. **`RotateDevice` 与「永不隐藏」冲突**（2.8-3）。
   横屏手机（≤768px）上 `RotateDevice` 是 9999 的不透明全屏「请旋转至竖屏」。
   我的判断：保留它盖住底栏 —— 那一刻整个应用都不可用，旋转提示优先；D1 列的界面里也没有它。
   需要确认：是否接受「横屏旋转提示期间底栏不可见」这唯一的例外。
2. **`aria-modal` 用不用**。底栏在弹窗之上始终可点，与 `aria-modal="true"`（宣称外部内容惰性）
   语义相抵。我的判断：不写 `aria-modal`，只写 `role="dialog"` + `aria-label`，
   并在 `Modal` 里注释理由。
3. **图标**。行为细则写了「图标 + 文字」，我假设图标用**内联 SVG**（24×24，`stroke`/`fill` 取
   `currentColor`，`aria-hidden="true"`），不引图片 / 不引图标库 / 不用 emoji（AGENTS.md 禁令）。
   需要确认：四项具体画什么（图鉴 / 玩法 / 设置 / 关于）。
   备选：本次只做文字标签，图标留后。
4. **路由页上的激活态**。人在 `/settings`（路由页）时，底栏「设置」是否显示 `aria-pressed="true"`
   且点击 no-op？我的判断：是（四项统一规则：目标已呈现 = 激活，点击不重复打开、不导航）。
   用户只点名了图鉴要激活态，这条是把它推广。
5. **三个弹窗入口是否也带 `aria-pressed`**。用户只要求图鉴。我的判断：四项一致（带上）。
6. **`React.lazy` 与 `AGENTS.md` 的冲突**（2.3-1）。
   `AGENTS.md` 写明动态 `import` 的唯一例外是「UI 的路由级代码分割（见 `src/App.tsx`）」，
   而底栏的四个面板不是路由。我的判断：必须懒加载（图鉴数据很大，`App.tsx` 特意把它做成路由懒加载），
   因此要么在 `AGENTS.md` 把例外扩成「UI 的重型按需面板（底栏的图鉴 / 设置 / 关于 / 玩法）」，
   要么用 `npm run build` 量首屏 chunk —— 若超过 `vite.config.ts` 的 600KB 警告线，懒加载就是硬要求。
   需要确认：是否允许在实现计划里同时改 `AGENTS.md` 这一句。
7. **既有 emoji（`SettingsScreen.tsx:14-18`：三个主题选项的 emoji 前缀）**（2.8-5）。
   抽内容组件会把它原样搬进设置弹窗。我的判断：本次不做（§7 不重写屏幕内容），
   但这与「禁止 emoji」相抵，且会污染 §6.2 的「无 emoji」断言（断言范围要避开设置弹层）。
   需要确认：是否顺手删掉这三个 emoji（一处小改动，但越出本 spec 的边界）。
8. **`--bottom-bar-content-h` 的具体值**。我写 `max(44px, 2.75rem)`（scale 1.0 @390px ≈ 45.6px），
   图标 24px。需要确认 / 定稿方式：实现计划里用几何脚本 + 截图在 390 / 320 / 1280 三档定，
   spec 只锁定「单一来源 + ≥44px + 用 rem 跟随字号」这三条不变量。
9. **图鉴弹层的搜索框是否自动聚焦**。路由页现在是 `autoFocus`（`EncyclopediaScreen.tsx:118`）。
   我的判断：弹层里**不要** autoFocus（打开即弹软键盘，会遮住内容与底栏），路由页保持 autoFocus。
10. **`Suspense` 缺省期间底栏显示**。按 D1「永不隐藏」我写成显示（底栏在 `Suspense` 之外）。
    需要确认这对「加载中…」占位页也成立（我认为成立）。
11. **路由变化时关闭弹层**。浏览器后退 / `navigate` 时底栏的弹层状态是保留还是关闭？
    我的判断：关闭（用 `useLocation` 监听 `pathname`），避免弹窗悬在与它无关的页面上。
12. **弹层打开时战斗是否暂停**。我的判断：不暂停（底栏只做设置 / 信息，不接管玩法；
    Roguelite 是回合制的，暂停没有实际意义）。需要确认。
13. **奖励三选一（`RewardPicker`，z-index 1200）期间底栏可点**（2.8-4）。
    我的判断：可点，符合 D1；打开设置不代选奖励、不跳过。需要确认这是想要的。
14. **底栏自身的 H5 触摸目标**：`--bottom-bar-content-h` 下限 44px + 按钮 `min-width:
    max(44px, 25%)`。四个 44px 宽的目标在 320px 视口下刚好放得下（4×44=176 ≪ 320），
    我按「一定放得下」写，不需要折行。需要确认无需横滚 / 折行。
