# UI 配色系统：量化审计与设计方案

范围：**仅 UI 层配色** —— [themes.css](src/ui/styles/themes.css) 里的颜色 token，以及 `src/ui/**/*.scss` 里面板 / 按钮 / 文字 / 边框 / 背景 / 状态色。像素美术调色板（武器与身体帧）不作为本方案的设计输入。

审计轮只出数字与设计，**不改任何样式与 token 值**。分析脚本全部在 `/tmp/color-audit/`（chroma-js 通过临时目录安装），仓库内不留脚本、未改 `package.json`。

## 0. 落地状态（迁移进度）

第 6 节 8 个待拍板问题已全部拍板，结论与本文档第 3 节一致：

| # | 结论 |
| --- | --- |
| 1 | 青（H188）为交互主色、金（H82）为奖励次强调 |
| 2 | **亮色主题真做**（不做「只保留暗色」） |
| 3 | ap 与 gold 拉开成两个明显不同的颜色；**p1 并入 accent** |
| 4 | **接受**拆出 `--color-pressed`（按下背景不再字面等于描边色；精神不变：整块实心填充 + 文字用 `--color-on-accent`） |
| 5 | 亮色 accent 的 **C=0.083 保留**（sRGB 上限），不换色相 |
| 6 | 标签徽章走**方案 A**（保留色相身份 + 主题化 L/C），不收敛成 8 族 |
| 7 | 浅底可用 **`color-mix`** |
| 8 | 不变量测试**内联约 40 行 OKLab 数学**，不加 `chroma-js` 依赖 |

已完成的迁移步骤：

| 步骤 | 状态 | 说明 |
| --- | --- | --- |
| 修 `--color-bg-raised` 未定义 | **已完成** | 两套主题各补一条（亮 `#f5f5f7` / 暗 `#0a0a0f`，后并入第 1 步的别名） |
| 第 0 步 冻结口径 | **已完成** | 三元组对拍 `scripts/scss-triples.mjs`、几何+截图 `scripts/ui-geometry.mjs` |
| 第 1 步 只改 themes.css | **已完成** | 见 3.6 |
| 第 4 步 标签徽章 | **提案已出、待过目** | 见第 7 节；**尚未动 `tagDisplay.ts`** |
| 第 2 / 3 / 5 / 6 步 | 未开始 | — |

数据来源：
- [themes.css](src/ui/styles/themes.css)（暗/亮两套主题，47 个 token）
- 42 个 `src/ui/**/*.scss` 文件
- [tagDisplay.ts](src/bridge/tagDisplay.ts)（标签徽章颜色，53 条字面量）
- `src/ui/**/*.ts(x)` 内联颜色（作为迁移量级输入，单独统计）

---

## 1. 现状盘点

### 1.1 token 全表

[themes.css](src/ui/styles/themes.css) 共 **47 个 token**，两套主题 **1:1 结构对应**（无单边 token）。完整现状值与建议值对照见 [3.3](#33-具体值)。

### 1.2 使用与死 token

42 个 scss 文件共引用 **79 个不同的 CSS 变量**，其中 41 个是颜色类（`--color-*` / `--scrollbar-*`）。

**从未被 scss 引用**（6 个，纯死重）：

| token | 亮 | 暗 |
| --- | --- | --- |
| `--color-accent-hover` | #3dbdb5 | #5dddd4 |
| `--color-code-bg` | #f4f3ec | #1f2028 |
| `--color-text-inverse` | #e8e8f0 | #1a1a2e |
| `--color-tooltip-text-h` | #1a1a2e | #e8e8f0 |
| `--color-warning-bg` | rgba(230,126,34,0.1) | rgba(230,126,34,0.15) |
| `--shadow-sm` | 0 1px 3px rgba(0,0,0,.08) | 0 1px 3px rgba(0,0,0,.3) |

**被引用但从未定义**（2 个，真实缺陷）：

| token | 引用处 | 后果 |
| --- | --- | --- |
| `--color-bg-raised` | [CompareScreen.scss:60](src/ui/components/layouts/CompareScreen/CompareScreen.scss#L60)、[:80](src/ui/components/layouts/CompareScreen/CompareScreen.scss#L80) | 无回退值，声明在计算值阶段失效，表头与行悬停底色**根本不生效** |
| `--color-warn` | [RewardPicker.scss:46](src/ui/components/CharacterPanel/RewardPicker.scss#L46)、[:214](src/ui/components/CharacterPanel/RewardPicker.scss#L214) | 拼写错误（应为 `--color-warning`），实际吃回退值 `#e0a34a`，与 `--color-warning` 的 #e67e22 不是同一个颜色 |

`--section-accent` 由 [GameplayModal.tsx:180](src/ui/screens/ModeSelect/GameplayModal.tsx#L180) 内联写入，属正常用法。

### 1.3 硬编码颜色清单（scss）

**38 处字面色值，落在 31 条声明里，分布在 14 个文件，去重后 23 个不同色值。**

| 出现次数 | 字面值 | 位置 | 角色 |
| --- | --- | --- | --- |
| 4 | `#444` | PixelEditor.scss:337 | 透明棋盘格（编辑器） |
| 4 | `rgba(0,0,0,0.7)` | ModeSelect.scss:48 | 主按钮文字描边 |
| 3 | `#ffb86b` | PixelEditor.scss:166,167,617 | 编辑器「已改」高亮 |
| 2 | `#ffe66d` | BattleStatusPanel.scss:123、RogueliteScreen.scss:94 | 内息黄（= `--color-ap` 暗色值） |
| 2 | `#c0392b` | CharacterPanel.scss:484,485 | 减益红（≈ `--color-debuff-text`） |
| 2 | `#999` | CharacterPanel.scss:569、LogPanel.scss:74 | 弱文字（≈ `--color-text-dim`） |
| 2 | `#e0a34a` | RewardPicker.scss:46,214 | `--color-warn` 的回退值 |
| 2 | `#666` | RoundCard.scss:203、AttributeLabel.scss:49 | 弱文字 / 属性底色 |
| 2 | `#2e8b57` | BuildSim.scss:212,228 | `--color-success` 的回退值 |
| 2 | `#000` | TournamentSim.scss:38,44 | 强调底上的文字（应为 `--color-on-accent`） |
| 1 | `#4ecdc4` | BattleStatusPanel.scss:115 | = `--color-p1` |
| 1 | `#ff6b6b` | BattleStatusPanel.scss:119 | = `--color-p2` |
| 1 | `#9b59b6` | BattleStatusPanel.scss:127 | = `--color-qi` |
| 1 | `rgba(0,0,0,0.6)` | RewardPicker.scss:5 | 遮罩 |
| 1 | `#4caf50` | AttributeLabel.scss:52 | 属性色 |
| 1 | `#2196f3` | AttributeLabel.scss:55 | 属性色 |
| 1 | `#ff9800` | AttributeLabel.scss:58 | 属性色 |
| 1 | `#f44336` | AttributeLabel.scss:61 | 属性色 |
| 1 | `rgb(0 0 0 / 28%)` | SearchSelect.scss:73 | 阴影 |
| 1 | `rgb(0 0 0 / 0.35)` | BattleScreen.scss:84 | 阴影 |
| 1 | `rgb(0 0 0 / 0.5)` | BattleScreen.scss:105 | 遮罩 |
| 1 | `#2ecc71` | WeaponCompare.scss:6 | `--color-success` 的回退值 |
| 1 | `#1f6361` | ModeSelect.scss:48 | 主按钮文字阴影（accent 压暗） |

按文件：

| 文件 | 处数 |
| --- | --- |
| screens/DevMode/PixelEditor/PixelEditor.scss | 7 |
| components/ui/AttributeLabel/AttributeLabel.scss | 5 |
| screens/ModeSelect/ModeSelect.scss | 5 |
| components/BattleStatusPanel/BattleStatusPanel.scss | 4 |
| components/CharacterPanel/CharacterPanel.scss | 3 |
| components/CharacterPanel/RewardPicker.scss | 3 |
| screens/BattleScreen/BattleScreen.scss | 2 |
| screens/DevMode/BuildSim/BuildSim.scss | 2 |
| screens/DevMode/TournamentSim/TournamentSim.scss | 2 |
| 其余 5 个文件 | 各 1 |

### 1.4 相邻的 UI 硬编码面（迁移量级必须算进来）

scss 里的 38 处只是冰山一角。同一套 UI 颜色还有两张更大的字面量表（下表把它们与内部构成一并列出）：

| 来源 | 字面量数 | 说明 |
| --- | --- | --- |
| [tagDisplay.ts](src/bridge/tagDisplay.ts) `TAG_COLOR` | **53** 条（30 个不同色值） | 标签徽章，作为**文字色**画在 `--color-entity-bg` 上；两套主题共用同一份值 |
| `src/ui/**/*.ts(x)` | **84** 处 | 其中 canvas 层 25 处（战斗飘字 / 地面）、DevMode 像素编辑器 37 处（编辑器默认调色板与画布钩子）、**真正的界面色 22 处** |
| 其中 [GameplayModal.tsx:158-166](src/ui/screens/ModeSelect/GameplayModal.tsx#L158) | 9 条 | 「玩法」弹窗逐节色，直接写死在 TS 里 |
| 其中 p1 / p2 身份色 | 8 处 | `#4ecdc4` / `#ff6b6b` 在 TSX 里重复写死（BattleScreen、SelectionPanel、BattlePanel、battle-replay） |
| 其中 [Tag.tsx:14](src/ui/components/ui/Tag/Tag.tsx#L14) | 1 处 | `?? '#888'` 回退 |

**UI 层字面色值总量：38（scss）+ 53（标签）+ 22（TS 界面色）= 113 处**（若把 canvas 与像素编辑器也算进来是 175 处）。

标签徽章那一张表的对比度实测（文字色压在徽章底上）：

| 主题 | 徽章底色 | 53 条里不达 4.5 的条数 |
| --- | --- | --- |
| 亮 | #e8e8f0 | **46 / 53（87%）** |
| 暗 | #181828 | **17 / 53（32%）** |

最差的几条（亮色主题）：`one_handed` #13f168 = 1.25、`paralyze`/`qi`/`qi_action` #f1c40f = 1.36、`post_action` #e8b84b = 1.51、`heal`/`buff`/`pre_action` #2ecc71 = 1.72。

这不是「调一下就好」的问题——**同一个色值要在白底和黑底上都做文字色，是不可能的**。标签色必须变成主题化派生色。

---

## 2. 量化审计

方法：chroma-js；半透明色先按同主题 `--color-bg` 合成再算 WCAG 对比度；无定义 token 按其回退值代入。

### 2.1 关键组合对比度矩阵

按角色分组评估（不是无意义的全交叉）。门槛：正文类 4.5:1，非文本类（描边 / 实心底上的字）3:1 或 4.5:1。

**中性正文 × 面（6 × 9 = 54 对）——两套主题各 18 对不达标。** 下表摘出亮色主题 9 个面里的 5 个代表面：

| 前景 | on #ffffff | on #f5f5f7 | on #ececf2 | on #e8e8f0 | on #e0e0e8 |
| --- | --- | --- | --- | --- | --- |
| `--color-text` | 11.15 | 10.63 | 9.47 | 9.06 | 8.49 |
| `--color-text-h` | 17.06 | 16.26 | 14.49 | 13.86 | 12.99 |
| `--color-text-dim` | **3.46** | **3.17** | **2.94** | **2.84** | **2.63** |
| `--color-text-inverse` | **1.22** | **1.12** | **1.04** | **1.00** | **1.08** |
| `--color-tooltip-text` | 11.15 | 10.63 | 9.47 | 9.06 | 8.49 |
| `--color-tooltip-text-h` | 17.06 | 16.26 | 14.49 | 13.86 | 12.99 |

暗色主题同一张表：`--color-text-dim` #6b7280 在 **9 个面里的 8 个**不达标（#1f2028 3.35 / #1a1a22 3.58 / #191922 3.60 / #181828 3.62 / #16161e 3.72 / #111115 3.90 / #0a0a0f 4.09 / #000000 4.34）；`--color-text-inverse` #1a1a2e 在暗色主题下作正文全部 9 个面不达标（最低 1.01，最高 1.23）。

**语义色作正文 × 面（12 × 9 = 108 对）——亮色 91 对不达标，暗色 10 对不达标。**

亮色主题的语义色几乎全军覆没，因为其中 9 个 token 与暗色主题**同值**（霓虹亮色压在白纸上）：

| 前景 | on #ffffff | on #ececf2 | on #e0e0e8 |
| --- | --- | --- | --- |
| `--color-accent` #4ecdc4 | **1.93** | **1.64** | **1.47** |
| `--color-accent-hover` #3dbdb5 | **2.30** | **1.95** | **1.75** |
| `--color-gold` #d4a848 | **2.21** | **1.88** | **1.68** |
| `--color-ap` #e0c040 | **1.78** | **1.51** | **1.36** |
| `--color-p2` #ff6b6b | **2.78** | **2.36** | **2.11** |
| `--color-danger` #e74c3c | **3.82** | **3.25** | 2.90 |
| `--color-warning` #e67e22 | **2.85** | **2.42** | **2.17** |
| `--color-success` #27ae60 | **2.87** | **2.44** | **2.19** |
| `--color-qi` #9b59b6 | 4.67 | 3.96 | 3.55 |

暗色主题的 10 条集中在两个色：`--color-qi` #9b59b6（9 条，最差 3.47 on #1f2028，最好 4.50 on #000000，其中 #000000 因 `--color-bg` 与 `--color-canvas-bg` 同值被计两次）与 `--color-danger` #e74c3c（1 条，4.24 on #1f2028）。此外 `--color-p1` 与 `--color-accent` 完全同值，是冗余而非对比度问题。

**实心底上的文字（on-accent × accent/danger/warning/gold）：**

| 主题 | on accent | on danger | on warning | on gold |
| --- | --- | --- | --- | --- |
| 亮 (`--color-on-accent` #101018) | 9.78 | 4.96 | 6.65 | 8.56 |
| 暗 (`--color-on-accent` #000000) | 10.85 | 5.50 | 7.37 | 12.34 |

这一组是现状里唯一经过刻意校准的部分（[themes.css:32-35](src/ui/styles/themes.css#L32-L35) 有注释），两套主题都过线。

**语义色 × 匹配浅底（9 对）——亮色 7 对不达标，暗色 0 对：**

| 组合 | 亮 | 暗 |
| --- | --- | --- |
| `accent` on `accent-bg` | **1.81** | 9.35 |
| `danger` on `danger-bg` | **3.36** | 4.89 |
| `success` on `success-bg` | **2.60** | 6.29 |
| `warning` on `warning-bg` | **2.58** | 6.33 |
| `buff-text` on `buff-bg` | 4.78 | 11.52 |
| `debuff-text` on `debuff-bg` | 4.63 | 7.14 |
| `p1` on `accent-bg` | **1.81** | 9.35 |
| `p2` on `danger-bg` | **2.44** | 6.73 |
| `p1` on `success-bg` | **1.75** | 9.33 |

**描边 / 非文本 × 面（现状）：**

| 描边 token | 亮 on bg | 暗 on bg |
| --- | --- | --- |
| `--color-border` | 1.53 | 1.49 |
| `--color-border-hover` | **2.58** | **1.88** |
| `--color-tooltip-border` | 1.80 | 1.88 |
| `--color-entity-border` | 1.65 | 1.50 |
| `--color-accent-border` | 1.40 | **3.18** |
| `--color-buff-border` | 1.40 | 2.11 |
| `--color-debuff-border` | 1.66 | 1.66 |
| `--scrollbar-thumb` | 1.80 | 1.88 |

24 对里 21 对过不了 3:1。这**不全是缺陷**：1px 分隔线（`--color-border`）承担的是视觉分组而非「识别控件边界」，WCAG 1.4.11 不要求它达到 3:1，方案里显式豁免。但 `--color-border-hover`（交互描边）与 `--scrollbar-thumb`（可操作滑块）是例外，必须过 3:1，现状两套主题都不过。

### 2.2 实际配对：88 条，31 条不达标

从 scss 里抽出「同一条规则（或向上继承）里同时出现的 前景 `color` × 背景 `background`」共 **88 条**（两主题合计），其中 **31 条低于 4.5:1**。按严重度排序的前 20 条：

| 主题 | 对比度 | 前景 | 背景 | 位置 |
| --- | --- | --- | --- | --- |
| 亮 | **1.47** | #4ecdc4 accent | #e0e0e8 bg-hover | TournamentSim.scss:80（bg-hover 底上的 accent 文字） |
| 亮 | **1.59** | #4ecdc4 | #e8e8f0 entity-bg | SelectionPanel.scss |
| 亮 | **1.64** | #4ecdc4 | #ececf2 bg-panel | CharacterPanel / PixelEditor / EncyclopediaScreen |
| 亮 | **1.75** | #4ecdc4 | #e9f7ef success-bg | RoundCard.scss |
| 亮 | **1.78** | #e0c040 ap | #ffffff bg | BattleStatusPanel.scss |
| 亮 | **1.81** | #4ecdc4 | #edfaf9 accent-bg | Button.scss primary 静止态、SettingsScreen、SelectionPanel |
| 亮 | **1.88** | #d4a848 gold | #ececf2 bg-panel | ControlsBar、BattleScreen |
| 亮 | **1.93** | #4ecdc4 | #ffffff bg | ModeSelect / RogueliteScreen / SettingsScreen 等 |
| 亮 | **2.21** | #d4a848 | #ffffff | BattleStatusPanel / ControlsBar |
| 亮 | **2.63** | #8888a0 text-dim | #e0e0e8 bg-hover | RewardPicker.scss |
| 亮 | **2.78** | #ff6b6b p2 | #ffffff | BattleStatusPanel.scss |
| 亮 | **2.94** | #8888a0 | #ececf2 | EncyclopediaScreen |
| 亮 | **3.17** | #8888a0 | #f5f5f7 | SearchSelect / MetaPanel |
| 亮 | **3.36** | #e74c3c danger | #e74c3c danger | CharacterPanel / RoundCard |
| 亮 | **3.46** | #8888a0 | #ffffff | **14 处**（BattleStatusPanel / ControlsBar / IntroOverlay / RunSummaryPanel / RogueliteScreen …） |
| 亮 | **3.82** | #e74c3c | #ffffff | RogueliteScreen |
| 暗 | **3.58** | #6b7280 text-dim | #1a1a22 bg-hover | RewardPicker |
| 暗 | **3.62** | #6b7280 | #181828 entity-bg | SelectionPanel |
| 暗 | **3.90** | #6b7280 | #111115 bg-panel | EncyclopediaScreen |
| 暗 | **4.34** | #6b7280 | #000000 bg | **14 处** |
| 暗 | **4.50** | #9b59b6 qi | #000000 | BattleStatusPanel |

「1.81」这一条是 [Button.scss:133-136](src/ui/components/ui/Button/Button.scss#L133-L136) 的 primary 变体静止态：`color: var(--color-accent)` 压在 `background: var(--color-accent-bg)` 上（浅底 #edfaf9）。亮色主题下 accent 文字无论压在哪个面上都不可读。

### 2.3 交互态

现状存在**两套并存的按下口径**：

| 口径 | 写法 | 站点数 | 亮色对比度 | 暗色对比度 |
| --- | --- | --- | --- | --- |
| 实心强调（`background: var(--color-accent)`） | 文字用 `--color-on-accent`（17 处） | 19 处 / 12 文件 | 9.78 | 10.85 |
| 灰式按下（保持 `--color-text`） | `background: border-hover`，文字不变 | 7 处 / 5 文件 | **4.33** | **4.39** |

灰式按下的两套主题都**差一点点**不过 4.5（4.33 / 4.39）。这不是巧合：`--color-border-hover` 被同时当作「悬停描边」（需要与底色拉开 3:1）和「按下时的背景填充」（需要与文字拉开 4.5:1），**两个角色对明度的要求方向相反**。暗色主题里 #3a3a4a 作为描边只有 1.88:1（连 3:1 都不到），作为文字底又差 0.11。

`--color-border-hover` 作为描边在页面底上的对比度：亮 **2.58**、暗 **1.88**，两套都低于非文本 3:1 门槛。

hover 态（`@media (hover: hover)` 内）本身无对比度问题：正文 on bg-hover 亮 8.49 / 暗 6.81。

### 2.4 中性明度阶梯（OKLCH L）

亮色主题，17 个中性 token 按 L 降序：

| L | token | 值 | ΔL（相对上一档） |
| --- | --- | --- | --- |
| 1.0000 | `--color-bg` | #ffffff | — |
| 1.0000 | `--color-canvas-bg` | #ffffff | **0.0000** |
| 1.0000 | `--color-bg-input` | #ffffff | **0.0000** |
| 0.9707 | `--color-bg-alt` | #f5f5f7 | 0.0293 |
| 0.9630 | `--color-code-bg` | #f4f3ec | 0.0077 |
| 0.9566 | `--color-tooltip-bg` | #f0f0f5 | 0.0064 |
| 0.9448 | `--color-bg-panel` | #ececf2 | 0.0118 |
| 0.9333 | `--color-entity-bg` | #e8e8f0 | 0.0115 |
| 0.9333 | `--color-text-inverse` | #e8e8f0 | **0.0000** |
| 0.9090 | `--color-bg-hover` | #e0e0e8 | 0.0243 |
| 0.8600 | `--color-border` | #d0d0d8 | 0.0491 |
| 0.8377 | `--color-entity-border` | #c8c8d8 | 0.0223 |
| 0.8127 | `--color-tooltip-border` | #c0c0d0 | 0.0250 |
| 0.7109 | `--color-border-hover` | #a0a0b0 | 0.1018 |
| 0.6350 | `--color-text-dim` | #8888a0 | 0.0759 |
| 0.3551 | `--color-text` | #3a3a4a | **0.2800** |
| 0.2284 | `--color-text-h` | #1a1a2e | 0.1266 |

- 16 个相邻间隔里 **7 个小于 0.02**（3 对并列：bg/canvas-bg/bg-input 三者同值，entity-bg/text-inverse 同值）→ 面板底、输入底、画布底在视觉上**分不出层级**。
- 同时存在 **ΔL = 0.28 的跳空**（text-dim → text）→ 弱文字与正文之间没有中间档，要么很淡要么很重。
- 中段拥挤：bg-alt → bg-hover 的 5 档全部落在 0.97~0.91 这 0.06 的区间里。

暗色主题同样是 **8 / 16 个间隔小于 0.02**，`--color-bg` 与 `--color-canvas-bg` 并列在 L=0.0000，`--color-border-hover` 与 `--color-tooltip-border` 并列在 0.3551，`--color-entity-bg`（0.2173）与 `--color-tooltip-bg`（0.2176）相差 0.0003。

### 2.5 色相分布（OKLCH H）

十个语义色的两两间隔，按 ΔH 升序：

| ΔH | ΔL | 组合（亮） | 组合（暗） |
| --- | --- | --- | --- |
| **0.0** | 0.000 | accent ↔ p1（**完全相同**） | accent ↔ p1 |
| **6.6** | 0.081 | danger ↔ p2 | 6.6 |
| **10.5** | 0.059 | gold ↔ ap | **6.0** |
| 26.1 | 0.065 | danger ↔ warning | 26.1 |
| 28.6 | 0.058 | warning ↔ gold | 32.7 |
| 36.2 | 0.113 | accent ↔ success | 36.2 |
| 54.7 | 0.123 | danger ↔ gold | 62.3 |

问题点：

1. **`--color-p1` 与 `--color-accent` 两套主题下都是同一个十六进制值**（#4ecdc4）。p1 是纯冗余，代价是任何「只改 accent」的操作都会让两者分叉。
2. **danger ↔ p2 ΔH = 6.6°**：红与「对手色」几乎同色。#ff6b6b 与 #e74c3c 并排时全靠明度差 0.081 区分，色弱用户无法区分。
3. **gold ↔ ap ΔH = 10.5°（亮）/ 6.0°（暗）**：奖励金与内息黄在暗色主题下几乎同色（#e8c34a vs #ffe66d），而这两者在 BattleStatusPanel 里是同屏的。
4. danger ↔ warning 只有 26.1°，而这恰是最常被混淆的一对（伤害 vs 警示）。

### 2.6 彩度 / 明度一致性

| 主题 | 语义色 C 范围 | 语义色 L 范围 | L 极差 |
| --- | --- | --- | --- |
| 亮 | 0.112 ~ 0.194 | 0.514 ~ 0.813 | **0.299** |
| 暗 | 0.112 ~ 0.191 | 0.577 ~ 0.922 | **0.345** |

彩度是相对可控的（1.7 倍跨度），**明度完全失控**：亮色主题里 `--color-buff-text` #2d7a2d 在 L=0.514，`--color-ap` #e0c040 在 L=0.813；暗色主题里 `--color-qi` 在 0.577、`--color-ap` 在 0.922。结果是同一排徽章里有的发暗发闷、有的刺眼发亮，而它们本该是同一「档」的语义色。

### 2.7 主题镜像性

47 个 token 里 **9 个在两套主题里字面值完全相同**：

| token | 值 | 亮色主题下的后果 |
| --- | --- | --- |
| `--color-accent` | #4ecdc4 | 作文字 on #ffffff = **1.93** |
| `--color-accent-border` | rgba(78,205,196,0.5) | 作描边 on #ffffff = 1.40 |
| `--color-danger` | #e74c3c | 作文字 = **3.82** |
| `--color-success` | #27ae60 | 作文字 = **2.87** |
| `--color-warning` | #e67e22 | 作文字 = **2.85** |
| `--color-p1` | #4ecdc4 | 同 accent |
| `--color-p2` | #ff6b6b | 作文字 = **2.78** |
| `--color-qi` | #9b59b6 | 作文字 = 4.67（唯一勉强过的） |
| `--scrollbar-track` | transparent | 无影响 |

其余 token 的明度翻转是**结构对应**的（bg 1.000 → 0.000、text 0.355 → 0.714、text-h 0.228 → 0.933），这一部分做得对。

但有两处**角色不镜像**：

- `--color-text-dim`：亮 0.635 / 暗 0.551，ΔL 只有 **-0.084**，几乎没有翻转；而它在两侧都恰好卡在门槛下方（3.46 / 4.34）。这不是「两套各写各的」，而是「一个值被用在了两种底色上」。
- `--color-accent-hover`：亮色 **变暗**（#4ecdc4 → #3dbdb5，L -0.048），暗色 **变亮**（#4ecdc4 → #5dddd4，L +0.048）—— 这是唯一一处明确按主题调整了方向的强调色，但该 token 从未被使用。

结论：**结构对应，语义色失衡**。中性骨架是「一套值 + 明度翻转」，语义色是「一套值直接共用」，后者在亮色主题上整体失效。

### 2.8 三个最严重的问题

1. **亮色主题的语义色整体不可用作文字。** 7 个语义 token（accent / danger / success / warning / qi / p1 / p2）两套主题同值，实测 `--color-accent` 在亮色主题下作文字 1.47 ~ 1.93:1（需 4.5），`--color-ap` 1.36 ~ 1.78，`--color-gold` 1.68 ~ 2.21。实际配对里 31 条不达标中有 **17 条**来自这一族（亮色 16 条 + 暗色 1 条）。`--color-accent` 在 scss 里被当作文字色用了 **32 次**。

2. **弱文字 `--color-text-dim` 在几乎所有面上都不过线。** 亮色 #8888a0：on #ffffff 3.46、on #ececf2 2.94、on #e0e0e8 2.63；暗色 #6b7280：on #000000 4.34、on #111115 3.90、on #1a1a22 3.58。它在 scss 里被当作文字色用了 **96 次**，其中「on #ffffff」一条就出现 14 次、暗色「on #000000」14 次。

3. **中性阶梯既挤又跳。** 亮色 16 个相邻间隔里 7 个 < 0.02（bg/canvas-bg/bg-input 三值并列），同时有一个 0.28 的跳空；暗色 8/16 个 < 0.02。结果：面板/输入/画布底分不出层级，而弱文字与正文之间没有中间档。

补充两个结构性缺陷：

4. `--color-border-hover` 一个 token 承担「悬停描边」（需与底 3:1）与「按下背景」（需与文字 4.5:1）两个相反要求 → 灰式按下亮 4.33 / 暗 4.39，两边都差一点。
5. 标签徽章 53 个色值两套主题共用，亮色主题下 **46/53 作文字不达标**。

---

## 3. 设计方案

### 3.1 角色结构

保留现有命名（改名的收益低于打坏调用点的成本），把 token 收敛成三层：

**A. 中性阶梯（11 个，全部重定值）**

| 角色 | token | 用途 |
| --- | --- | --- |
| 面 0 | `--color-bg` | 页面底 / 画布底 |
| 面 1 | `--color-bg-alt` | 次级页底 / 抬升块 |
| 面 2 | `--color-bg-panel` | 面板 / 输入 / tooltip 底 |
| 面 3 | `--color-bg-hover` | 悬停底 |
| 描边弱 | `--color-border` | 分隔线（**装饰性，豁免 3:1**） |
| 描边强 | `--color-border-hover` | 悬停 / 聚焦描边（需 ≥3:1） |
| 按下 | `--color-pressed` | **新增**：按下时的填充 + 描边 |
| 文字弱 | `--color-text-dim` | 次要信息（需 ≥4.5:1，对所有面） |
| 文字 | `--color-text` | 正文 |
| 文字强 | `--color-text-h` | 标题 |
| 反色 | `--color-on-accent` | 压在任何实心强调底上的文字 |

**B. 语义强调色（8 个，两套主题各自定值，色相共用）**

`--color-accent`（青，交互主色）、`--color-success`（绿）、`--color-danger`（红）、`--color-warning`（橙）、`--color-gold`（琥珀金，奖励）、`--color-ap`（黄，内息）、`--color-qi`（紫，炁）、`--color-p2`（玫红，对手）。

**C. 浅底（由 B 派生）**

`--color-accent-bg` / `-danger-bg` / `-success-bg` / `-warning-bg` / `-buff-bg` / `-debuff-bg` 改为 `color-mix(in oklab, var(--color-X) 12%, var(--color-bg))`（亮）/ `16%`（暗）。派生而非硬写，保证浅底永远跟着强调色走，且因为混的是同主题的 bg（极值），文字压在其上必然过线。

**收敛（改成别名，调用点零改动）**：
`--color-canvas-bg → var(--color-bg)`、`--color-bg-input → var(--color-bg-panel)`、`--color-entity-bg → var(--color-bg-alt)`、`--color-entity-border → var(--color-border)`、`--color-code-bg → var(--color-bg-alt)`、`--color-bg-raised → var(--color-bg-alt)`（**修复当前未定义**）、`--color-tooltip-bg → var(--color-bg-panel) 0.97`、`--color-tooltip-border → var(--color-border-hover)`、`--color-tooltip-text → var(--color-text)`、`--color-tooltip-text-h → var(--color-text-h)`、`--color-p1 → var(--color-accent)`、`--color-buff-text → var(--color-success)`、`--color-debuff-text → var(--color-danger)`、`--scrollbar-thumb → var(--color-border-hover)`。

**删除（6 个，0 引用）**：`--color-accent-hover`、`--color-code-bg`、`--color-text-inverse`、`--color-tooltip-text-h`、`--color-warning-bg`、`--shadow-sm`。

**新增（1 个）**：`--color-pressed`。

**修名（2 处调用点）**：`--color-warn` → `--color-warning`。

### 3.2 两条主题路线

方案不是「同一组颜色翻个明度」，而是两个明确的美术方向：

- **暗色主题 = 霓虹**：纯黑底 + 高彩度亮色，强调色的 L 落在 0.68 ~ 0.93，压黑做发光。
- **亮色主题 = 纸墨**：白纸底 + 深墨彩，强调色的 L 落在 0.47 ~ 0.52，是「墨」不是「光」。

这不是审美偏好，是 sRGB 的硬约束：**青绿在 L=0.78 时彩度上限 0.14，在 L=0.47 时上限只有 0.087**。任何「亮色主题也用同一支亮青」的方案都过不了 4.5:1。把亮色主题定性为「纸墨」之后，低彩度从缺陷变成风格。

于是 `--color-on-accent` 也跟着翻转：亮色主题用**浅字**（#f4f5f9），暗色主题用**黑字**（#000000）。这样同一个 token 既能压在新强调色上，也能压在灰式按下的深底上。

### 3.3 具体值

值由脚本求解：在指定色相下，二分搜索满足全部对比度门槛的最亮（亮色主题）/ 最暗（暗色主题）OKLCH L，彩度取色域上限的 95% 并封顶 0.17。

#### 亮色主题（纸墨）

| token | 新值 | OKLCH L | C | H | 旧值 |
| --- | --- | --- | --- | --- | --- |
| `--color-bg` | #ffffff | 1.000 | 0.000 | — | #ffffff |
| `--color-bg-alt` | #f2f2f5 | 0.962 | 0.004 | 286.6 | #f5f5f7 |
| `--color-bg-panel` | #e5e5e9 | 0.923 | 0.005 | 286.5 | #ececf2 |
| `--color-bg-hover` | #d9d9dd | 0.886 | 0.005 | 286.5 | #e0e0e8 |
| `--color-border` | #bdbdc4 | 0.800 | 0.010 | 286.3 | #d0d0d8 |
| `--color-border-hover` | #7a7a84 | 0.583 | 0.015 | 286.0 | #a0a0b0 |
| `--color-pressed` | #4c4c55 | 0.420 | 0.015 | 285.8 | （新增） |
| `--color-text-dim` | #595966 | 0.469 | 0.021 | 285.6 | #8888a0 |
| `--color-text` | #393947 | 0.350 | 0.024 | 285.1 | #3a3a4a |
| `--color-text-h` | #1b1b2b | 0.230 | 0.031 | 283.7 | #1a1a2e |
| `--color-on-accent` | #f4f5f9 | 0.971 | 0.005 | 275.1 | #101018 |
| `--color-accent` | #006b65 | 0.476 | 0.083 | 188.0 | #4ecdc4 |
| `--color-success` | #006e35 | 0.471 | 0.125 | 151.7 | #27ae60 |
| `--color-danger` | #b22c36 | 0.508 | 0.170 | 22.0 | #e74c3c |
| `--color-warning` | #9a4800 | 0.498 | 0.129 | 51.2 | #e67e22 |
| `--color-gold` | #7c5902 | 0.488 | 0.100 | 81.7 | #d4a848 |
| `--color-ap` | #656204 | 0.483 | 0.102 | 107.6 | #e0c040 |
| `--color-qi` | #7c43b1 | 0.506 | 0.170 | 304.9 | #9b59b6 |
| `--color-p2` | #a72e73 | 0.508 | 0.170 | 349.9 | #ff6b6b |

#### 暗色主题（霓虹）

| token | 新值 | OKLCH L | C | H | 旧值 |
| --- | --- | --- | --- | --- | --- |
| `--color-bg` | #000000 | 0.000 | 0.000 | — | #000000 |
| `--color-bg-alt` | #010102 | 0.069 | 0.008 | 284.1 | #0a0a0f |
| `--color-bg-panel` | #09090b | 0.141 | 0.004 | 285.9 | #111115 |
| `--color-bg-hover` | #18181b | 0.210 | 0.006 | 285.9 | #1a1a22 |
| `--color-border` | #2d2d33 | 0.300 | 0.011 | 285.8 | #2a2a3a |
| `--color-border-hover` | #626375 | 0.505 | 0.028 | 282.8 | #3a3a4a |
| `--color-pressed` | #73737d | 0.578 | 0.015 | 285.9 | （新增） |
| `--color-text-dim` | #898997 | 0.635 | 0.019 | 282.3 | #6b7280 |
| `--color-text` | #afafc1 | 0.760 | 0.026 | 285.8 | #9ca3af |
| `--color-text-h` | #e8e9ff | 0.940 | 0.030 | 283.8 | #e8e8f0 |
| `--color-on-accent` | #000000 | 0.000 | 0.000 | — | #000000 |
| `--color-accent` | #18d2c7 | 0.780 | 0.133 | 188.0 | #4ecdc4 |
| `--color-success` | #3ec873 | 0.739 | 0.170 | 152.1 | #27ae60 |
| `--color-danger` | #ef6667 | 0.681 | 0.170 | 22.3 | #e74c3c |
| `--color-warning` | #ff8f42 | 0.758 | 0.162 | 52.0 | #e67e22 |
| `--color-gold` | #f1b218 | 0.801 | 0.161 | 82.1 | #e8c34a |
| `--color-ap` | #f3f056 | 0.930 | 0.170 | 108.2 | #ffe66d |
| `--color-qi` | #b179eb | 0.680 | 0.170 | 305.0 | #9b59b6 |
| `--color-p2` | #f072b3 | 0.719 | 0.170 | 350.1 | #ff6b6b |

#### 派生的浅底

| token | 亮 | 暗 |
| --- | --- | --- |
| `--color-accent-bg` | rgba(0,107,101,0.12) | rgba(24,210,199,0.16) |
| `--color-danger-bg` | rgba(178,44,54,0.12) | rgba(239,102,103,0.16) |
| `--color-success-bg` | rgba(0,110,53,0.12) | rgba(62,200,115,0.16) |
| `--color-warning-bg` | rgba(154,72,0,0.12) | rgba(255,143,66,0.16) |
| `--color-buff-bg` | rgba(0,110,53,0.12) | rgba(62,200,115,0.16) |
| `--color-debuff-bg` | rgba(178,44,54,0.12) | rgba(239,102,103,0.16) |
| `--color-buff-border` | rgba(0,110,53,0.35) | rgba(62,200,115,0.40) |
| `--color-debuff-border` | rgba(178,44,54,0.35) | rgba(239,102,103,0.40) |
| `--color-tooltip-bg` | rgba(229,229,233,0.97) | rgba(9,9,11,0.97) |
| `--color-overlay` | rgba(0,0,0,0.35) | rgba(0,0,0,0.60) |

### 3.4 验证数字

**关键组合（旧 → 新）**，加粗为不达标：

| 组合 | 门槛 | 旧·亮 | 新·亮 | 旧·暗 | 新·暗 |
| --- | --- | --- | --- | --- | --- |
| 正文 on 页面底 | 4.5 | 11.15 | 11.35 | 8.27 | 9.72 |
| 正文 on 面板 | 4.5 | 9.47 | 9.03 | 7.42 | 9.21 |
| 正文 on 悬停底 | 4.5 | 8.49 | 8.06 | 6.81 | 8.20 |
| 弱文字 on 页面底 | 4.5 | **3.46** | 6.90 | **4.34** | 6.09 |
| 弱文字 on 面板 | 4.5 | **2.94** | 5.49 | **3.90** | 5.77 |
| 弱文字 on 悬停底 | 4.5 | **2.63** | 4.90 | **3.58** | 5.14 |
| 标题 on 页面底 | 4.5 | 17.06 | 16.96 | 17.23 | 17.53 |
| 强调色作文字 on 页面底 | 4.5 | **1.93** | 6.38 | 10.85 | 11.08 |
| 强调色作文字 on 面板 | 4.5 | **1.64** | 5.08 | 9.74 | 10.50 |
| 强调色作文字 on 悬停底 | 4.5 | **1.47** | 4.53 | 8.93 | 9.35 |
| 危险 on 页面底 | 4.5 | **3.82** | 6.35 | 5.50 | 6.77 |
| 警告 on 页面底 | 4.5 | **2.85** | 6.36 | 7.37 | 9.26 |
| 成功 on 页面底 | 4.5 | **2.87** | 6.40 | 7.31 | 9.71 |
| 金 on 页面底 | 4.5 | **2.21** | 6.39 | 12.34 | 11.12 |
| 内息 on 页面底 | 4.5 | **1.78** | 6.36 | 16.79 | 17.41 |
| 气 on 页面底 | 4.5 | 4.67 | 6.37 | 4.50 | 6.80 |
| 对手色 on 页面底 | 4.5 | **2.78** | 6.40 | 7.57 | 7.76 |
| on-accent on 强调底 | 4.5 | 9.78 | 5.86 | 10.85 | 11.08 |
| on-accent on 危险底 | 4.5 | 4.96 | 5.83 | 5.50 | 6.77 |
| on-accent on 警告底 | 4.5 | 6.65 | 5.84 | 7.37 | 9.26 |
| on-accent on 金底 | 4.5 | 8.56 | 5.86 | 12.34 | 11.12 |
| **按下底上的文字** | 4.5 | **4.33**（旧：`text` on border-hover） | 7.80（新：`on-accent` on pressed） | **4.39** | 4.79（实测；方案原写 4.87，见 3.6） |
| 悬停描边 on 页面底 | 3 | **2.58** | 4.25 | **1.88** | 3.56 |
| 悬停描边 on 悬停底 | 3 | **1.96** | 3.02 | **1.55** | 3.00 |

**浅底上的文字（新值全过）**：

| 前景 | 浅底 | 亮 | 暗 |
| --- | --- | --- | --- |
| accent | accent-bg | 5.31 | 10.63 |
| danger | danger-bg | 5.29 | 6.60 |
| success | success-bg | 5.34 | 9.37 |
| warning | warning-bg | 5.30 | 8.95 |
| text | tooltip-bg | 9.12 | 9.27 |
| text-dim | tooltip-bg | 5.54 | 5.80 |

**把新值代入 2.2 那批实际配对重算**（90 条，比 88 条多是因为别名 token 补齐了引用）：亮色不达标从 **23** 条降到 **2** 条，暗色从 **8** 条降到 **1** 条。剩下的 3 条全部是「灰式按下保持 `--color-text`」那三处（亮 2.67 / 3.99，暗 2.73），由第 2 步引入 `--color-pressed` 后变为 **7.80 / 4.87**，归零。

**语义色可分性（新值）**：

| 主题 | 最小 ΔH | 对应组合 | ΔL | 结论 |
| --- | --- | --- | --- | --- |
| 亮 | 25.8° | gold ↔ ap | 0.005 | 由色相区分 |
| 亮 | 29.2° | danger ↔ warning | 0.010 | 由色相区分 |
| 暗 | 26.1° | gold ↔ ap | 0.129 | 由色相区分 |
| 暗 | 29.7° | danger ↔ warning | 0.077 | 由色相区分 |

八色相环：danger 22° / warning 52° / gold 82° / ap 108° / success 152° / accent 188° / qi 305° / p2 350°，**最小间隔 25.8°**（gold ↔ ap）。p1 并入 accent 后不再有 0° 对。

**彩度收敛**：亮色主题 C ∈ [0.083, 0.170]，暗色 C ∈ [0.133, 0.170]。亮色主题的 accent 只有 0.083 不是设计选择，是色域上限（青绿在 L=0.476 时最大 C=0.087）。

### 3.5 与画面里像素元素的关系

（一句脚注，不作为设计输入）UI 面板与像素角色、武器在屏幕上是相邻的，落地后按图确认 UI 强调色（尤其亮色主题的深墨青 #006b65 与暗色主题的亮青 #18d2c7）没有和角色衣物 / 皮肤的主色撞在一起即可，不为此调整 token。

### 3.6 第 1 步落地记录（只改 themes.css，零调用点改动）

**token 数 47 → 44，单侧各 44**（按「每个 `--x: value` 一条」逐名统计：删 5 个真死 token、加 2 个；1.1 节与附录 A 的 47 与本口径一致）。

其中 `--color-code-bg`（`src/index.css:123` 在用，改为 `var(--color-bg-alt)`）与 `--color-accent-border`（`SettingsScreen.scss:108` 在用，改为 `color-mix(accent 50%, transparent)`）**保留**，否则会破坏调用点。

| 处置 | token |
| --- | --- |
| 重定值（11 + 8） | 中性 11（bg / bg-alt / bg-panel / bg-hover / border / border-hover / pressed / text-dim / text / text-h / on-accent）+ 语义 8（accent / success / danger / warning / gold / ap / qi / p2） |
| 新增 | `--color-pressed`、`--color-bg-raised`（后者是本轮单独修的 bug） |
| 改别名（11） | `bg-input → bg-panel`、`canvas-bg → bg`、`bg-raised → bg-alt`、`entity-bg → bg-alt`、`entity-border → border`、`code-bg → bg-alt`、`tooltip-border → border-hover`、`tooltip-text → text`、`tooltip-text-h → text-h`、`p1 → accent`、`buff-text/debuff-text → success/danger`、`scrollbar-thumb → border-hover` |
| 改派生（7） | 6 个浅底 `color-mix(in oklab, var(--color-X) 12%/16%, var(--color-bg))` + `tooltip-bg`（panel 97%）+ `buff/debuff-border`（35%/40%） |
| 保留（有引用） | `--color-code-bg`（index.css）、`--color-accent-border`（SettingsScreen.scss，改为 `color-mix(accent 50%, transparent)`） |
| 删除（5，全仓 0 引用） | `--color-accent-hover`、`--color-text-inverse`、`--shadow-sm`、`--color-warning-bg`、`--color-tooltip-text-h` |

**两处偏离方案的取值**（都是为保证不变量 I1③ 与色域合法性）：

| token | 方案值 | 落地值 | 原因 |
| --- | --- | --- | --- |
| `--color-pressed`（暗） | `#73737d`（L 0.578） | `#78787f`（L 0.575） | 方案称 `on-accent on pressed` = 4.87，按内联 OKLab 复算是 **4.48 < 4.5**（不达标）。往上取到实测 **4.79** |
| `--color-accent-border` | `rgba(78,205,196,0.5)` | `color-mix(in oklab, var(--color-accent) 50%, transparent)` | 旧值是**暗色主题的霓虹青**直接共用；改成由 accent 派生，两套主题自动跟随 |

**实测结果**（脚本 `/tmp/color-audit/audit.mjs`，内联 OKLab + WCAG，无 chroma-js）：

| 指标 | 旧（HEAD） | 第 1 步后 |
| --- | --- | --- |
| 不变量 I1 ~ I8 违规 | 72 条 | **0 条** |
| 实际配对不达标（按声明计，97 对） | 28（亮 20 / 暗 8） | **5（亮 3 / 暗 2）** |
| 实际配对不达标（去重成「前景 × 背景」逻辑组合） | 18（亮 13 / 暗 5） | **3（亮 2 / 暗 1）** |
| 硬编码字面色（scss） | 38 处 / 23 值 / 14 文件 | 38 处 / 23 值 / 14 文件（第 3 步清） |

文档 2.2 节记的「31 条」是**按 (选择器, 媒体, 前景, 背景) 逐处计**的口径；本轮脚本按 (文件, 选择器, 媒体) 去重后旧值为 28、新值为 5。三种口径的结论一致：**剩下 5 处（3 个逻辑组合）全部是「灰式按下把 `--color-border-hover` 当背景」那一族**，即第 2 步 `--color-pressed` 的目标：

```
亮 2.67  text      on border-hover   BattleStatsPanel.scss:224
亮 2.67  text      on border-hover   EncyclopediaScreen.scss:85
亮 3.99  text-h    on border-hover   Button.scss:96（-default/-plain/-ghost 的 :active 同款）
暗 2.73  text      on border-hover   BattleStatsPanel.scss:224
暗 2.73  text      on border-hover   EncyclopediaScreen.scss:85
```

第 2 步把这三类站点的 `color` 改成 `--color-on-accent` 之后，实测为**亮 7.80 / 暗 4.79**（均 ≥4.5），归零。


---

## 4. 可验证不变量

全部是纯函数，输入是「token 名 → 颜色字符串」两张表，输出是违规列表。项目已有 vitest 与 `src/**/__tests__/` 惯例，可直接落地为 `src/ui/styles/__tests__/color-system.test.ts`。

| 编号 | 不变量 | 判据 |
| --- | --- | --- |
| **I1** | 对比度 | ① 每个文字 token（`text-dim` / `text` / `text-h` / `tooltip-text`）× 每个面 token（`bg` / `bg-alt` / `bg-panel` / `bg-hover`）≥ 4.5；② 每个语义色 × 每个面 token ≥ 4.5；③ `on-accent` × {`accent`, `danger`, `warning`, `gold`, `pressed`} ≥ 4.5；④ `border-hover` × {`bg`, `bg-panel`, `bg-hover`} ≥ 3；⑤ 9 对**匹配**的「语义色 × 自身浅底」≥ 4.5。`--color-border` 是装饰性分隔线，**显式豁免**（现状 1.53 / 1.49，方案不改变这一豁免） |
| **I2** | 面阶梯 | `bg` → `bg-alt` → `bg-panel` → `bg-hover` 严格单调，且相邻 ΔL ∈ [0.035, 0.075] |
| **I3** | 文字阶梯 | `text-dim` / `text` / `text-h` 相邻 ΔL ≥ 0.10；亮色主题三者 L 全部低于 `bg-hover`，暗色主题全部高于 `bg-hover` |
| **I4** | 按下档 | `abs(L(pressed) − L(bg-hover))` ≥ 0.15（按下必须比 hover 明显），且 `pressed` 对每个面 ≥ 3:1 |
| **I5** | 无并列 | 同一族内任意两个 token 的 `abs(ΔL)` ≥ 0.03（面族、文字族、描边族各自检查） |
| **I6** | 语义可分 | 任意两个语义色 ΔH ≥ 25° **或** ΔL ≥ 0.15 |
| **I7** | 彩度一致 | 所有语义色 C ∈ [0.07, 0.22]，且两套主题语义色 C 的最大值之差 ≤ 0.06 |
| **I8** | 主题镜像 | ① 两套主题的 token 名集合完全相同；② 同一语义角色在两套主题的 `abs(ΔH)` ≤ 5°；③ 除 `--scrollbar-track`（两套都是 `transparent`）外，**不允许同一 token 在两套主题取同一字面值**（挡住「共用霓虹色」这类回归） |

CI 接法：

1. 测试文件自己解析 [themes.css](src/ui/styles/themes.css)（`fs.readFileSync` + 正则），断言上表；这样 token 就是唯一事实来源，不需要再维护一份 TS 镜像。
2. 需要 OKLCH / WCAG 计算。二选一：`npm i -D chroma-js`（仅 devDependency，测试用），或把约 40 行的 sRGB↔OKLab 转换内联进 `src/ui/styles/oklch.ts`。**倾向后者**：项目对依赖很克制，且这段数学是冻结标准，不引入版本漂移。
3. 标签徽章单独一条测试：`TAG_COLOR` 的每个值（或派生后的最终色）对 `--color-entity-bg` 在**两套主题**下都 ≥ 4.5（现状 46/53 与 17/53 条不达标，这条测试会把问题钉死）。
4. 每条断言失败时打印「token 名 + 实际 L/C/H + 实测对比度 + 门槛」，而不是只报 `expected true to be false`。

---

## 5. 迁移计划

原则：**先冻口径，再改 token 值（零调用点改动），最后才扫字面量**。每一步都能独立回退。

### 第 0 步：冻结口径，写测试（不改颜色）

- 新增 `src/ui/styles/__tests__/color-system.test.ts`，实现 I1 ~ I8，先以「当前值」为基线跑一遍，把 31 条不达标与标签 46/53 条不达标作为**已知失败清单**记录下来（或先 `test.skip`，避免长期红灯）。
- 新增几何回归脚本（若尚无）：三档视口下 `document.body.scrollWidth <= innerWidth` 且关键容器无 `scrollHeight > clientHeight`。

**已落地（本轮）** —— 两个脚本，放在 `scripts/` 跟项目既有惯例，**零新增依赖**：

| 脚本 | 作用 | 用法 |
| --- | --- | --- |
| `scripts/scss-triples.mjs` | 编译 `src/**/*.scss` 摊平成 `(选择器, 媒体, 声明体)` 三元组并**对拍两次状态**：三元组集合必须逐字相同，只有颜色声明的值可变 | `node scripts/scss-triples.mjs [--baseline HEAD] [--current <目录>] [--json <文件>]`（退出码 0 = 通过） |
| `scripts/ui-geometry.mjs` | 无头 Chrome（CDP）三档视口 × 亮/暗 × 三页：断言 `documentElement.scrollWidth == innerWidth` 且超视口元素 0；截图**留存**到 `tmp/preview/`（不参与判定） | `node scripts/ui-geometry.mjs [--theme light\|dark\|both] [--pages home,encyclopedia,settings] [--port 5199]` |

三元组脚本只用仓库已有的 `sass` + 自写的约 60 行 CSS 解析（不引 postcss）；几何脚本用系统 Chrome + Node 内置 `WebSocket`。两个脚本都自己 spawn / 收尾服务（自有端口、记 PID、退出时 SIGTERM），不 `pkill`。

**验证**：`node scripts/scss-triples.mjs` 通过（基线 `HEAD` → 工作区）；不动任何样式。

### 第 1 步：只改 [themes.css](src/ui/styles/themes.css)

- 按 3.3 重定 18 个颜色值；
- 12 个 token 改成 `var()` 别名（含**修复 `--color-bg-raised` 的未定义**）；
- 删除 6 个零引用 token；
- 浅底改为 `color-mix`（若决定不引入 `color-mix`，则写等价 rgba 字面量）。

**调用点改动：0 个文件。** 这一步就把实际配对的不达标从 31 条压到 3 条（亮色 23 → 2，暗色 8 → 1）。**本轮实际落地记录见 3.6**：token 47 → 44（删 5 个整、加 2 个；`--color-code-bg` / `--color-accent-border` 因仍有引用而保留）；实测不达标按声明计 28 → 5、按「前景 × 背景」逻辑组合去重 18 → 3；I1 ~ I8 违规 72 → 0。

**验证**：
- I1 ~ I8 全绿（标签那条仍红，属第 4 步）；
- 编译后摊平对拍：`(选择器, 媒体, 声明体)` 三元组集合必须**完全一致**，只允许各三元组的**值**变化（颜色 token 值本来就该变）。非颜色声明（尺寸 / 字体 / 布局）逐字符相同；
- 三档视口截图：颜色必然变化，因此**不比 md5**，改看 ① 布局三元组不变 ② 几何无溢出；
- 人工确认亮色主题的深墨青不像「褪色」，暗色主题的 #18d2c7 不像「荧光棒」。

### 第 2 步：引入 `--color-pressed`，统一按下口径

改 5 个文件、7 处：

| 文件 | 处数 |
| --- | --- |
| [Button.scss](src/ui/components/ui/Button/Button.scss)（`-default` / `-plain` / `-ghost` 三个变体的 `:active`） | 3 |
| [DevMode.scss](src/ui/screens/DevMode/DevMode.scss) | 1 |
| [EncyclopediaScreen.scss](src/ui/screens/EncyclopediaScreen/EncyclopediaScreen.scss) | 1 |
| [BattleStatsPanel.scss](src/ui/components/BattleStatsPanel/BattleStatsPanel.scss) | 1 |
| [SelectionPanel.scss](src/ui/components/SelectionPanel/SelectionPanel.scss) | 1 |

口径（与 Button 顶部注释同步更新）：`background: var(--color-pressed); border-color: var(--color-pressed); color: var(--color-on-accent);`。实心强调那一族（19 处 `background: var(--color-accent)`）不动。

**验证**：I4 通过；`on-accent on pressed` 亮 7.80 / 暗 4.87；`:hover` 仍全部包在 `@media (hover: hover)` 里（当前 54 处，`grep -c 'hover: hover'` 不得减少）；`:active` 不新增 `:not(:disabled)`（会有特异性风险，见 Button.scss 注释）。

### 第 3 步：清 scss 硬编码（38 处 / 14 文件）

按 1.3 的表逐条替换：

| 处置 | 处数 |
| --- | --- |
| 状态色 / 内息 / 减益 / 属性底 → 对应 token（`#4ecdc4` → `var(--color-accent)` 等，共 8 处） | 8 |
| 改成 `var(--color-on-accent)`（TournamentSim 的 `#000` ×2） | 2 |
| 改成新的语义 token（AttributeLabel 4 个属性色 → 新增属性色映射表） | 4 |
| 灰色系（`#999` ×2、RoundCard 的 `#666`）→ `var(--color-text-dim)` | 3 |
| `--color-warn` → `--color-warning`（顺手删回退值） | 2 |
| `--color-success` 回退值 `#2e8b57` / `#2ecc71` → 直接依赖 token（回退值删除） | 3 |
| 纯黑阴影 / 遮罩（`rgba(0,0,0,.7)` ×4、三个 `rgb(0 0 0 / …)`、`rgba(0,0,0,.6)` ×1）→ 保持字面量或收敛成 `--color-overlay` / `--shadow-*` | 8 |
| 编辑器专用（`#ffb86b` ×3、`#444` ×4）→ 新增 `--color-editor-modified` / 保留棋盘格字面量 | 7 |
| ModeSelect 主按钮文字阴影 `#1f6361` → 由 `--color-accent` 派生或保留 | 1 |

`AttributeLabel` 的 4 个属性底色（#4caf50 / #2196f3 / #ff9800 / #f44336）与 `--color-*` 语义色不同源，建议新增一组**属性色** token（金木水火土 / 六属性）而不是硬塞进现有语义色。

**验证**：`grep -rn '#[0-9a-fA-F]\{3,8\}' src/ui --include=*.scss` 的命中数降到编辑器白名单以内；摊平对拍三元组不变；三档截图几何不变。

### 第 4 步：标签徽章收编（[tagDisplay.ts](src/bridge/tagDisplay.ts) 53 条）

两个方案，需拍板：

- **方案 A（推荐）：保留 53 个色相，按主题生成 L/C。** `TAG_COLOR` 改成 `Record<Tag, number>`（只存色相），徽章文字色 = `oklch(L_theme, C_theme, hue)`，L/C 取与语义色同一档（亮 0.50 / 0.13，暗 0.76 / 0.16）。53 个字面量归零，每个标签保留自己的色相身份，两套主题自动成立且必然过线。落地点：[Tag.tsx:14](src/ui/components/ui/Tag/Tag.tsx#L14) 改为读 CSS 变量或调用派生函数。
- **方案 B：53 → 8 个语义族。** 标签按语义归到 8 个 token。改动更小，但会有大量标签同色。

**验证**：新增测试「每个 tag 的最终色 × `--color-entity-bg`（两套主题）≥ 4.5」；标签密集页（Encyclopedia、BuildPanel）三档截图目视确认。

**本轮已出提案**：见 **第 7 节**（8 族 / 15 个色位、逐标签 H 与两套主题 L/C、实测对比度、改动比例与风险）。**尚未动 `tagDisplay.ts`**。

### 第 5 步：TS 里的界面色（22 处）

- [GameplayModal.tsx:158-166](src/ui/screens/ModeSelect/GameplayModal.tsx#L158)：9 个逐节色 → 收敛到语义 token（accent / success / gold / danger / qi / p2 等），`--section-accent` 继续由内联变量传递，但值改为 `var(--color-*)`。
- p1 / p2 身份色 8 处（BattleScreen、SelectionPanel、BattlePanel、battle-replay）：抽成一处常量并从 CSS 变量读取，避免第 1 步改了 `--color-p2` 而 TS 里仍是 `#ff6b6b`。
- [Tag.tsx:14](src/ui/components/ui/Tag/Tag.tsx#L14) 的 `?? '#888'` 回退 → `var(--color-text-dim)`。
- [CharacterPanel.tsx:78](src/ui/components/CharacterPanel/CharacterPanel.tsx#L78) 默认 `accentColor = '#888'` 同理。
- canvas 层（float-text 14 处、renderer 11 处）**独立决策**：它是战斗画布，不是 CSS 层，但里面的 `#4ecdc4` / `#ffe66d` 同样与 token 重复。建议至少把常量集中到一个模块并加注释指向 token。

**验证**：`grep` 命中数下降；TS 侧新增「常量与 token 值一致」的单测。

### 第 6 步：收尾

- 删除已无引用的别名 token（`--color-canvas-bg` / `--color-bg-input` / `--color-entity-bg` / `--color-entity-border` / `--color-code-bg` / `--color-tooltip-*` / `--color-p1` / `--color-buff-text` / `--color-debuff-text`）。
- 在 [themes.css](src/ui/styles/themes.css) 顶部写「token 角色表」，与 `docs/ui-color-system.md` 互链。
- 更新 [AGENTS.md](AGENTS.md) 的 UI 小节：新增「颜色只能来自 token」与「新增语义色必须同时给出两套主题的值并过 I1 / I6」。

### 验证口径汇总

| 手段 | 配色改动怎么用 |
| --- | --- |
| 编译后摊平 `(选择器, 媒体, 声明体)` 对拍（`scripts/scss-triples.mjs`） | **三元组集合必须逐字相同**；只允许声明体的**值**变化，且变化的声明必须全部是颜色属性（`color` / `background*` / `border*color` / `fill` / `stroke` / `box-shadow` / `text-shadow`）。出现非颜色声明的差异即判定回归 |
| 三档视口截图 md5 | 配色改动**必然改变像素**，因此 md5 不能作为通过条件。改为：① 摊平三元组集合不变（`scripts/scss-triples.mjs`）② 几何断言（`scrollWidth == innerWidth`、超视口元素 0，`scripts/ui-geometry.mjs`）通过 ③ 截图**留存**到 `tmp/preview/` 供人工目视 |
| 几何无溢出 | 与配色无关，照旧执行 |
| 单测 | I1 ~ I8 + 标签色测试；每次改 token 必跑 |

**本轮实测（第 1 步后）**：

| 手段 | 结果 |
| --- | --- |
| 三元组对拍（基线 `HEAD` → 工作区） | 三元组 900 / 900，消失 0、新增 0、声明体变化 0 → **通过**（第 1 步只改了 `themes.css`，它是 CSS 不是 SCSS，本就不进摊平集合） |
| 几何断言（`home` + `settings` × 三档 × 亮/暗 = 12 组） | 全部 `scrollWidth == innerWidth`、超视口元素 0 → **通过** |
| 截图留存 | 12 张 → `tmp/preview/{home,settings}-{light,dark}-{390x844,320x568,1280x800}.png` |
| 目视 | 亮色的深墨青不显「褪色」，暗色的 #18d2c7 不显「荧光棒」（首页标题 + 主按钮） |

另注：`/encyclopedia` 在 **320×568** 下有 13 个 `.encyclopedia-card` 越出视口（卡片固定宽度，`documentElement.scrollWidth` 仍等于 `innerWidth`，页面无横向滚动）。这是**既有布局问题、与配色无关**，因此没放进默认断言集；要复现用 `node scripts/ui-geometry.mjs --pages encyclopedia`。

---

## 6. 需要拍板的问题

1. **赛博朋克（青）还是古风（金）主导？** 方案把 `--color-accent` 定为青（H 188）作为交互主色，`--color-gold`（H 82）作为奖励 / 货币的次强调，两者色相拉开 94°。若希望古风主导（金作主色、青作点缀），则 I1 的求解目标要重跑，且 `--color-accent` 与 `--color-gold` 的角色定义要对调。

2. **亮色主题要不要真做？** 现状是 `theme: 'system'`，跟随系统的用户会直接看到亮色主题；而它当前有 **23 条**实际配对不达标（暗色 8 条）。方案给的是「纸墨」（深墨彩 + 浅字），视觉上与暗色的「霓虹」是两个方向。备选是**只保留暗色主题**：删掉亮色分支，31 条里 23 条直接消失，迁移量减半，但会丢掉跟随系统浅色的用户。**这是最影响工作量的一个决定。**

3. **强调色要不要收敛成一个？** 现状是 accent / p1 完全同值（冗余），另加 gold / ap 两个黄（ΔH 只有 6~10°）。方案做了两件事：p1 并入 accent（8 个 TS 调用点要改）、gold 与 ap 拉开到 26°。是否接受「内息黄」和「奖励金」变成两个明显不同的颜色（暗色主题下 #f3f056 vs #f1b218）？

4. **`--color-border-hover` 拆分是否接受？** 新增 `--color-pressed` 会让按下态背景（亮 #4c4c55 / 暗 #73737d）与悬停描边（亮 #7a7a84 / 暗 #626375）不再同色 —— 这与「按下时背景＝描边色」的既有口径**字面上不同**（精神一致：按下是一整块实心填充，且文字改用 `--color-on-accent`）。若坚持「按下背景必须等于某个描边 token」，则需把 `--color-border-hover` 压到 4.5:1（亮色主题求解为 L=0.547 / #707079），代价是它作为描边时对比过高 —— 亮色主题在白底上是 4.9:1 的深灰线，而描边只需要 3:1，视觉上会变成一根抢戏的粗框。

5. **亮色主题的 accent 只有 C=0.083。** 这是 sRGB 的硬上限（青绿 L=0.476 时最大彩度 0.087），不是可以调好的参数。若希望亮色主题的青色更「艳」，唯一出路是把 accent 改成别的色相（例如 H 250 的靛蓝，在同等 L 下彩度上限约 0.20），代价是丢掉赛博青。

6. **标签徽章走方案 A（53 个色相 + 主题化 L/C）还是方案 B（53 → 8 个语义族）？** A 保留每个标签的颜色身份、迁移量大；B 改动小但同色标签多。

7. **`color-mix` 能否接受？** 浅底用 `color-mix(in oklab, var(--color-X) 12%, var(--color-bg))` 派生，可以永远跟着强调色走且天然过线；代价是依赖 `color-mix`（Chrome 111+ / Safari 16.2+ / Firefox 113+）。不接受则写 6 组 rgba 字面量（方案里已经给出等价数值）。

8. **不变量测试的 OKLCH 实现**：加 `chroma-js` 作 devDependency，还是把约 40 行 sRGB↔OKLab 数学内联进仓库？

---

## 附录 A：现状 token 全表（47 × 2）

| token | 亮 | 暗 |
| --- | --- | --- |
| `--color-accent` | #4ecdc4 | #4ecdc4 |
| `--color-accent-bg` | rgba(78,205,196,0.10) | rgba(78,205,196,0.12) |
| `--color-accent-border` | rgba(78,205,196,0.50) | rgba(78,205,196,0.50) |
| `--color-accent-hover` | #3dbdb5 | #5dddd4 |
| `--color-ap` | #e0c040 | #ffe66d |
| `--color-bg` | #ffffff | #000000 |
| `--color-bg-alt` | #f5f5f7 | #0a0a0f |
| `--color-bg-hover` | #e0e0e8 | #1a1a22 |
| `--color-bg-input` | #ffffff | #16161e |
| `--color-bg-panel` | #ececf2 | #111115 |
| `--color-border` | #d0d0d8 | #2a2a3a |
| `--color-border-hover` | #a0a0b0 | #3a3a4a |
| `--color-buff-bg` | #e6f7e6 | #1a2e1a |
| `--color-buff-border` | #b8e6b8 | #2a4a2a |
| `--color-buff-text` | #2d7a2d | #8f8 |
| `--color-canvas-bg` | #ffffff | #000000 |
| `--color-code-bg` | #f4f3ec | #1f2028 |
| `--color-danger` | #e74c3c | #e74c3c |
| `--color-danger-bg` | rgba(231,76,60,0.10) | rgba(231,76,60,0.15) |
| `--color-debuff-bg` | #fde8e8 | #2e1a1a |
| `--color-debuff-border` | #f5baba | #4a2a2a |
| `--color-debuff-text` | #c0392b | #f88 |
| `--color-entity-bg` | #e8e8f0 | #181828 |
| `--color-entity-border` | #c8c8d8 | #2a2a3e |
| `--color-gold` | #d4a848 | #e8c34a |
| `--color-on-accent` | #101018 | #000000 |
| `--color-overlay` | rgba(0,0,0,0.30) | rgba(0,0,0,0.50) |
| `--color-p1` | #4ecdc4 | #4ecdc4 |
| `--color-p2` | #ff6b6b | #ff6b6b |
| `--color-qi` | #9b59b6 | #9b59b6 |
| `--color-success` | #27ae60 | #27ae60 |
| `--color-success-bg` | rgba(39,174,96,0.10) | rgba(39,174,96,0.15) |
| `--color-text` | #3a3a4a | #9ca3af |
| `--color-text-dim` | #8888a0 | #6b7280 |
| `--color-text-h` | #1a1a2e | #e8e8f0 |
| `--color-text-inverse` | #e8e8f0 | #1a1a2e |
| `--color-tooltip-bg` | rgba(240,240,245,0.97) | rgba(26,26,35,0.97) |
| `--color-tooltip-border` | #c0c0d0 | #3a3a4a |
| `--color-tooltip-text` | #3a3a4a | #9ca3af |
| `--color-tooltip-text-h` | #1a1a2e | #e8e8f0 |
| `--color-warning` | #e67e22 | #e67e22 |
| `--color-warning-bg` | rgba(230,126,34,0.10) | rgba(230,126,34,0.15) |
| `--scrollbar-thumb` | #c0c0d0 | #3a3a4a |
| `--scrollbar-track` | transparent | transparent |
| `--shadow-sm` | 0 1px 3px rgba(0,0,0,0.08) | 0 1px 3px rgba(0,0,0,0.30) |
| `--shadow-md` | 0 4px 12px rgba(0,0,0,0.10) | 0 4px 12px rgba(0,0,0,0.50) |
| `--shadow-lg` | 0 8px 32px rgba(0,0,0,0.15) | 0 8px 32px rgba(0,0,0,0.70) |

## 附录 B：审计脚本

全部在 `/tmp/color-audit/`（不纳入仓库）：

| 脚本 | 作用 |
| --- | --- |
| `parse-themes.js` | 解析 [themes.css](src/ui/styles/themes.css) 成两张 token 表 |
| `scss-pairs.js` | 极简 scss 块解析；抽「实际前景 × 背景」配对、硬编码清单、token 引用计数 |
| `token-roles.js` | 逐 token 统计「作文字 / 作填充 / 作描边」的次数 |
| `audit-contrast.js` | 对比度矩阵 + 实际配对 + 交互态 |
| `audit-color.js` | 中性阶梯 / 色相分布 / 彩度一致性 / 主题镜像 |
| `oklch-fit.js` | 色域内的最大彩度求解（避免 OEKLab 色相漂移） |
| `solve.js` | 在指定色相下解出满足门槛的 L，产出候选值 |
| `design.js` / `derive.js` / `final.js` | 候选方案的不变量打分、派生 token、文档表格生成 |

依赖：`chroma-js`，装在 `/tmp/color-audit/node_modules`（`npm i chroma-js --cache /tmp/npm-cache`），未写入项目 `package.json`。

---

## 7. 标签徽章映射提案（方案 A：保留色相身份 + 主题化 L/C）

**本节只是提案，尚未改 [tagDisplay.ts](src/bridge/tagDisplay.ts)。** 落地方式见 7.4。

### 7.1 结论先行

- 8 个语义族、**15 个色位**（不是 53 个色相、也不是收敛成 8 色）。同族内同一色位的标签**同色**——色相带负责表达语义，不再逐条造色。
- 15 个色位沿色环**全局**排布，任意两色位实测 `H` 相差 **24.2° ~ 25.9°**（要求 ΔH ≥ 25°，实测最小值 24.2° 来自取整误差，实现时按「色位表」写死即可）。
- **53 条全部**在**两套主题**下对 `--color-entity-bg` ≥ 4.5:1（最低 5.10，最高 10.08）。
- 现状复核（在旧底色 `#e8e8f0` / `#181828` 上量）：亮 **46 / 53** 不达标、暗 **17 / 53** 不达标，与 1.4 节的数字一致。

### 7.2 族与色位总表


| 族 | 色位 H（实测） | 亮色 | 实测·亮 | 暗色 | 实测·暗 | 覆盖标签数 |
| --- | --- | --- | --- | --- | --- | --- |
| 负面状态 | 5 | `#8c4e5d` | 5.59 | `#e299a9` | 9.30 | 2 |
| 负面状态 | 30 | `#8d5046` | 5.58 | `#e59c8f` | 9.42 | 2 |
| 武器流派 | 55 | `#7c5b45` | 5.46 | `#cda890` | 9.54 | 3 |
| 武器流派 | 80 | `#74603e` | 5.39 | `#c4ae8a` | 9.71 | 7 |
| 伤害进攻 | 105 | `#6c660e` | 5.30 | `#bab567` | 9.83 | 4 |
| 伤害进攻 | 130 | `#4a710f` | 5.14 | `#9cbe7a` | 9.99 | 4 |
| 内息资源 | 155 | `#1e7546` | 5.10 | `#88c19b` | 10.08 | 1 |
| 内息资源 | 180 | `#127365` | 5.13 | `#75c2b3` | 10.06 | 1 |
| 内息资源 | 205 | `#117079` | 5.20 | `#70c0c9` | 10.01 | 1 |
| 增益恢复 | 231 | `#116c8f` | 5.27 | `#68bde4` | 9.92 | 2 |
| 增益恢复 | 255 | `#2e64a6` | 5.39 | `#85b4f0` | 9.72 | 2 |
| 身法闪避 | 280 | `#5759a4` | 5.58 | `#a4aaf0` | 9.52 | 3 |
| 防御格挡 | 305 | `#715293` | 5.64 | `#bda5da` | 9.50 | 3 |
| 防御格挡 | 330 | `#844b80` | 5.70 | `#cf9fc9` | 9.39 | 3 |
| 机制规则 | 356 | `#855165` | 5.59 | `#d1a2b3` | 9.47 | 15 |

「实测·亮 / 实测·暗」= 该色位对同主题 `--color-entity-bg`（亮 `#f2f2f5` / 暗 `#010102`）的 WCAG 对比度。

### 7.3 逐标签映射

规则：

1. **色相带语义** —— 同族共享一条色相带，族内再用色位分段。
2. **彩度带权重** —— 关键 / 稀有语义（伤害、负面、内息）用高彩度（0.085 ~ 0.132）；常见 / 通用语义（武器流派、机制规则）用低彩度（0.055 ~ 0.075）。**武器族与伤害族色相带相邻，就是靠「彩度减半」区分的。**
3. **同标签色相两套主题不变** —— 只调 L/C（亮 L 0.50 / 暗 L 0.76）。
4. **与 UI 语义色避让** —— 只有真正负面的标签才用 danger 那条带（负面状态族）；其余族与语义色的最小距离标注在每族下方。
5. 同族内用 `ΔH ≥ 25°` 或 `ΔL ≥ 0.15` 区分；本方案同族 L 固定，因此全部靠 ΔH。


#### 负面状态

> 红（含 danger 22）。**只给真正负面的标签**；这是与 UI danger 唯一允许重叠的族

| 标签 | 中文 | 色位 H | 亮色（L .50） | 实测·亮 | 暗色（L .76） | 实测·暗 | 旧值 | 旧·亮 | 旧·暗 | 处置 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `paralyze` | 麻痹 | 5 | `#8c4e5d` (C 0.085) | 5.59 | `#e299a9` (C 0.090) | 9.30 | `#f1c40f` | 1.36 | 10.53 | 换色相 |
| `poison` | 中毒 | 5 | `#8c4e5d` (C 0.085) | 5.59 | `#e299a9` (C 0.090) | 9.30 | `#27ae60` | 2.36 | 6.09 | 换色相 |
| `debuff` | 弱化 | 30 | `#8d5046` (C 0.085) | 5.58 | `#e59c8f` (C 0.090) | 9.42 | `#7f8c8d` | 2.85 | 5.03 | 换色相 |
| `stun` | 眩晕 | 30 | `#8d5046` (C 0.085) | 5.58 | `#e59c8f` (C 0.090) | 9.42 | `#8e44ad` | 4.81 | 2.98 | 换色相 |

#### 武器流派

> 棕→赭；**彩度减半**（0.055）表达「常见／通用」，与伤害族靠彩度而非色相区分

| 标签 | 中文 | 色位 H | 亮色（L .50） | 实测·亮 | 暗色（L .76） | 实测·暗 | 旧值 | 旧·亮 | 旧·暗 | 处置 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `one_handed` | 单手 | 55 | `#7c5b45` (C 0.055) | 5.46 | `#cda890` (C 0.055) | 9.54 | `#13f168` | 1.25 | 11.51 | 换色相 |
| `unarmed` | 拳脚 | 55 | `#7c5b45` (C 0.055) | 5.46 | `#cda890` (C 0.055) | 9.54 | `#e67e22` | 2.34 | 6.14 | 微调 |
| `weapon` | 武器 | 55 | `#7c5b45` (C 0.055) | 5.46 | `#cda890` (C 0.055) | 9.54 | `#ff8c00` | 1.91 | 7.50 | 微调 |
| `blunt` | 钝击 | 80 | `#74603e` (C 0.055) | 5.39 | `#c4ae8a` (C 0.055) | 9.71 | `#e67e22` | 2.34 | 6.14 | 微调 |
| `heavy` | 重型 | 80 | `#74603e` (C 0.055) | 5.39 | `#c4ae8a` (C 0.055) | 9.71 | `#455a64` | 5.94 | 2.42 | 换色相 |
| `melee` | 近战 | 80 | `#74603e` (C 0.055) | 5.39 | `#c4ae8a` (C 0.055) | 9.71 | `#e67e22` | 2.34 | 6.14 | 微调 |
| `pierce` | 戳刺 | 80 | `#74603e` (C 0.055) | 5.39 | `#c4ae8a` (C 0.055) | 9.71 | `#f39c12` | 1.80 | 7.98 | 微调 |
| `polearm` | 长柄 | 80 | `#74603e` (C 0.055) | 5.39 | `#c4ae8a` (C 0.055) | 9.71 | `#795548` | 5.37 | 2.67 | 换色相 |
| `thrown` | 暗器 | 80 | `#74603e` (C 0.055) | 5.39 | `#c4ae8a` (C 0.055) | 9.71 | `#cd853f` | 2.45 | 5.85 | 微调 |
| `two_handed` | 双手 | 80 | `#74603e` (C 0.055) | 5.39 | `#c4ae8a` (C 0.055) | 9.71 | `#5d4037` | 7.65 | 1.88 | 换色相 |

#### 伤害进攻

> 橙→黄；与 gold(82)/ap(108) 相邻（伤害＝危险），与 weapon 靠彩度区分

| 标签 | 中文 | 色位 H | 亮色（L .50） | 实测·亮 | 暗色（L .76） | 实测·暗 | 旧值 | 旧·亮 | 旧·暗 | 处置 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `bleed` | 流血 | 105 | `#6c660e` (C 0.101) | 5.30 | `#bab567` (C 0.100) | 9.83 | `#c0392b` | 4.46 | 3.22 | 换色相 |
| `knockdown` | 倒地 | 105 | `#6c660e` (C 0.101) | 5.30 | `#bab567` (C 0.100) | 9.83 | `#e67e22` | 2.34 | 6.14 | 换色相 |
| `self_damage` | 自伤 | 105 | `#6c660e` (C 0.101) | 5.30 | `#bab567` (C 0.100) | 9.83 | `#7f8c8d` | 2.85 | 5.03 | 换色相 |
| `slash` | 劈砍 | 105 | `#6c660e` (C 0.101) | 5.30 | `#bab567` (C 0.100) | 9.83 | `#e74c3c` | 3.13 | 4.58 | 换色相 |
| `bonus_damage` | 附加伤害 | 130 | `#4a710f` (C 0.128) | 5.14 | `#9cbe7a` (C 0.100) | 9.99 | `#ff9800` | 1.77 | 8.12 | 换色相 |
| `burn` | 灼烧 | 130 | `#4a710f` (C 0.128) | 5.14 | `#9cbe7a` (C 0.100) | 9.99 | `#e74c3c` | 3.13 | 4.58 | 换色相 |
| `knockback` | 击退 | 130 | `#4a710f` (C 0.128) | 5.14 | `#9cbe7a` (C 0.100) | 9.99 | `#ff5722` | 2.60 | 5.53 | 换色相 |
| `low_hp` | 残血 | 130 | `#4a710f` (C 0.128) | 5.14 | `#9cbe7a` (C 0.100) | 9.99 | `#e74c3c` | 3.13 | 4.58 | 换色相 |

#### 内息资源

> 绿→青；与 success(152)/accent(188) 同属资源色语族（炁/内息本就常与青绿绑定）

| 标签 | 中文 | 色位 H | 亮色（L .50） | 实测·亮 | 暗色（L .76） | 实测·暗 | 旧值 | 旧·亮 | 旧·暗 | 处置 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `qi` | 炁 | 155 | `#1e7546` (C 0.110) | 5.10 | `#88c19b` (C 0.080) | 10.08 | `#f1c40f` | 1.36 | 10.53 | 换色相 |
| `qi_action` | 炁招 | 180 | `#127365` (C 0.086) | 5.13 | `#75c2b3` (C 0.080) | 10.06 | `#f1c40f` | 1.36 | 10.53 | 换色相 |
| `chan` | 缠劲 | 205 | `#117079` (C 0.081) | 5.20 | `#70c0c9` (C 0.080) | 10.01 | `#2ecc71` | 1.72 | 8.33 | 换色相 |

#### 增益恢复

> 蓝→靛；**偏离「绿色＝恢复」的直觉**，是为让开 accent 与 success 的代价

| 标签 | 中文 | 色位 H | 亮色（L .50） | 实测·亮 | 暗色（L .76） | 实测·暗 | 旧值 | 旧·亮 | 旧·暗 | 处置 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `buff` | 增益 | 230 | `#116c8f` (C 0.095) | 5.27 | `#68bde4` (C 0.100) | 9.92 | `#2ecc71` | 1.72 | 8.33 | 换色相 |
| `heal` | 回复 | 230 | `#116c8f` (C 0.095) | 5.27 | `#68bde4` (C 0.100) | 9.92 | `#2ecc71` | 1.72 | 8.33 | 换色相 |
| `cleanse` | 净化 | 255 | `#2e64a6` (C 0.120) | 5.39 | `#85b4f0` (C 0.100) | 9.72 | `#1abc9c` | 1.98 | 7.26 | 换色相 |
| `pre_action` | 前置 | 255 | `#2e64a6` (C 0.120) | 5.39 | `#85b4f0` (C 0.100) | 9.72 | `#2ecc71` | 1.72 | 8.33 | 换色相 |

#### 身法闪避

> 紫；与防御族同带但取紫端

| 标签 | 中文 | 色位 H | 亮色（L .50） | 实测·亮 | 暗色（L .76） | 实测·暗 | 旧值 | 旧·亮 | 旧·暗 | 处置 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `frost` | 霜冻 | 280 | `#5759a4` (C 0.117) | 5.58 | `#a4aaf0` (C 0.100) | 9.52 | `#00bcd4` | 1.88 | 7.62 | 换色相 |
| `move` | 位移 | 280 | `#5759a4` (C 0.117) | 5.58 | `#a4aaf0` (C 0.100) | 9.52 | `#1abc9c` | 1.98 | 7.26 | 换色相 |
| `sand_blind` | 迷眼 | 280 | `#5759a4` (C 0.117) | 5.58 | `#a4aaf0` (C 0.100) | 9.52 | `#f39c12` | 1.80 | 7.98 | 换色相 |

#### 防御格挡

> 紫→品红；与 qi(305) 的 UI 语义色同带，靠彩度与用法区分

| 标签 | 中文 | 色位 H | 亮色（L .50） | 实测·亮 | 暗色（L .76） | 实测·暗 | 旧值 | 旧·亮 | 旧·暗 | 处置 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `heavy_reduce` | 化解 | 305 | `#715293` (C 0.105) | 5.64 | `#bda5da` (C 0.080) | 9.50 | `#1abc9c` | 1.98 | 7.26 | 换色相 |
| `ignore_parry` | 破招 | 305 | `#715293` (C 0.105) | 5.64 | `#bda5da` (C 0.080) | 9.50 | `#8e44ad` | 4.81 | 2.98 | 微调 |
| `parry` | 招架 | 305 | `#715293` (C 0.105) | 5.64 | `#bda5da` (C 0.080) | 9.50 | `#3498db` | 2.59 | 5.55 | 换色相 |
| `counter` | 反击 | 330 | `#844b80` (C 0.105) | 5.70 | `#cf9fc9` (C 0.080) | 9.39 | `#e91e63` | 3.57 | 4.03 | 换色相 |
| `defense` | 防御 | 330 | `#844b80` (C 0.105) | 5.70 | `#cf9fc9` (C 0.080) | 9.39 | `#2980b9` | 3.53 | 4.07 | 换色相 |
| `super_armor` | 罡体 | 330 | `#844b80` (C 0.105) | 5.70 | `#cf9fc9` (C 0.080) | 9.39 | `#9b59b6` | 3.83 | 3.75 | 微调 |

#### 机制规则

> 低彩度玫红；与 p2(350) 同带、彩度只有其一半

| 标签 | 中文 | 色位 H | 亮色（L .50） | 实测·亮 | 暗色（L .76） | 实测·暗 | 旧值 | 旧·亮 | 旧·暗 | 处置 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `craft` | 天工 | 355 | `#855165` (C 0.075) | 5.59 | `#d1a2b3` (C 0.060) | 9.47 | `#920217` | 7.68 | 1.87 | 换色相 |
| `electric` | 雷电 | 355 | `#855165` (C 0.075) | 5.59 | `#d1a2b3` (C 0.060) | 9.47 | `#3498db` | 2.59 | 5.55 | 换色相 |
| `imperial` | 御物 | 355 | `#855165` (C 0.075) | 5.59 | `#d1a2b3` (C 0.060) | 9.47 | `#9b59b6` | 3.83 | 3.75 | 换色相 |
| `implant` | 义体 | 355 | `#855165` (C 0.075) | 5.59 | `#d1a2b3` (C 0.060) | 9.47 | `#7f8c8d` | 2.85 | 5.03 | 换色相 |
| `inherent` | 特性 | 355 | `#855165` (C 0.075) | 5.59 | `#d1a2b3` (C 0.060) | 9.47 | `#9e9e9e` | 2.20 | 6.53 | 换色相 |
| `internal` | 内置 | 355 | `#855165` (C 0.075) | 5.59 | `#d1a2b3` (C 0.060) | 9.47 | `#95a5a6` | 2.10 | 6.84 | 换色相 |
| `jiu` | 酒 | 355 | `#855165` (C 0.075) | 5.59 | `#d1a2b3` (C 0.060) | 9.47 | `#f3121d` | 3.51 | 4.10 | 换色相 |
| `post_action` | 后置 | 355 | `#855165` (C 0.075) | 5.59 | `#d1a2b3` (C 0.060) | 9.47 | `#e8b84b` | 1.51 | 9.49 | 换色相 |
| `range` | 远程 | 355 | `#855165` (C 0.075) | 5.59 | `#d1a2b3` (C 0.060) | 9.47 | `#2980b9` | 3.53 | 4.07 | 换色相 |
| `range_up` | 加射程 | 355 | `#855165` (C 0.075) | 5.59 | `#d1a2b3` (C 0.060) | 9.47 | `#4caf50` | 2.28 | 6.30 | 换色相 |
| `retrieve_weapon` | 收回武器 | 355 | `#855165` (C 0.075) | 5.59 | `#d1a2b3` (C 0.060) | 9.47 | `#607d8b` | 3.59 | 4.00 | 换色相 |
| `stance` | 架势 | 355 | `#855165` (C 0.075) | 5.59 | `#d1a2b3` (C 0.060) | 9.47 | `#1abc9c` | 1.98 | 7.26 | 换色相 |
| `summon` | 召唤 | 355 | `#855165` (C 0.075) | 5.59 | `#d1a2b3` (C 0.060) | 9.47 | `#8e44ad` | 4.81 | 2.98 | 换色相 |
| `talent` | 天赋 | 355 | `#855165` (C 0.075) | 5.59 | `#d1a2b3` (C 0.060) | 9.47 | `#e91e63` | 3.57 | 4.03 | 微调 |
| `trigger` | 触发 | 355 | `#855165` (C 0.075) | 5.59 | `#d1a2b3` (C 0.060) | 9.47 | `#9b59b6` | 3.83 | 3.75 | 换色相 |


### 7.4 改动比例与风险

对 53 条现有色值（在旧底色上算的实测对比度也一并列出）：

| 处置 | 条数 | 含义 |
| --- | --- | --- |
| **微调**（ΔH ≤ 25°） | 9 | 色相基本不动，只是把「两套主题共用的霓虹色」换成主题化 L/C |
| **换色相**（ΔH > 25°） | 44 | 原有色值几乎全是「随手取的常用色」（bootstrap / material 调色板），与新语义族无对应关系 |

**换色相比例高是必然的**，原因不是方案激进，而是现状的颜色本来就没有语义体系：同一族内 `#e67e22`（unarmed / blunt / melee / knockdown）与 `#e74c3c`（slash / burn / low_hp）重合，而 `#1abc9c` 同时被 move / cleanse / stance / heavy_reduce 四族共用。**不换色相就不可能让「色相带语义」成立。**

风险与代价：

1. **「绿色＝恢复」的直觉被打破**：`buff` / `heal` 落在蓝靛带（H230 / 255）。要让开 accent 青（188）与 success 绿（152）只有这么多空间；如果用户更看重直觉，可把「增益恢复」与「身法闪避」的色相对调（增益→绿 H155~205，身法→蓝靛）。
2. **`poison` 从绿色改成红色**（H5）：它按语义归进「负面状态」。如果坚持「中毒＝绿」，它要么留在负面族里破例走绿，要么移出负面族（届时负面族只剩 stun / debuff / paralyze）。
3. **`electric` 落在玫红带**（机制规则 H356）：雷电的自然色相是蓝紫，被机制族的低彩度玫红盖掉了。可接受的替代是把它挪进「伤害进攻」。
4. **与 UI 语义色有 4 处近邻**（ΔH < 8°）：武器族 H80 ↔ gold 81.7、伤害族 H105 ↔ ap 107.6、内息族 H155 ↔ success 151.7、机制族 H356 ↔ p2 349.9。徽章（文字色、低彩度）与语义色（实心填充 / 描边）用法不同，判断为可接受；若要更保守，需要把 15 个色位压到 13 个以内腾出间距。
5. **机制规则族 15 个标签同色**：这是「8 族 + 色相带」口径下的必然结果。若要再细分，需要新增第 9 个族（例如「来源 / 出处」与「实现语义」分开）。

### 7.5 落地方式（第 4 步再动）

- `TAG_COLOR: Record<Tag, string>` → `TAG_HUE: Record<Tag, number>`（15 个色位），颜色由 `oklch(L_theme, C_theme, hue)` 派生：亮 `L 0.50`、暗 `L 0.76`，C 见各族色位表（受 sRGB 色域上限截断，截断后实测值已列在表里）。
- 测试：新增「每个 tag 的最终色 × `--color-entity-bg`（两套主题）≥ 4.5」与「任意两色位实测 ΔH ≥ 24°」两条断言，内联 OKLab 数学（与第 4 节口径一致）。
- `Tag.tsx` 的 `?? '#888'` 回退 → `var(--color-text-dim)`（归第 5 步）。

