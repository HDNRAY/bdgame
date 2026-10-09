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
| 6 | 标签徽章走**方案 A**（保留色相身份 + 主题化 L/C），不收敛成 8 族。后续经用户逐条校准到 **11 族 / 17 个色位**：雷=蓝、流血=红、控制=灰、酒=棕、劈砍/戳刺/远程=流派、前置=机制、heal 浅绿 / poison 深绿 —— 见第 7 节 |
| 7 | 浅底可用 **`color-mix`** |
| 8 | 不变量测试**内联约 40 行 OKLab 数学**，不加 `chroma-js` 依赖 |

已完成的迁移步骤：

| 步骤 | 状态 | 说明 |
| --- | --- | --- |
| 修 `--color-bg-raised` 未定义 | **已完成** | 两套主题各补一条（亮 `#f5f5f7` / 暗 `#0a0a0f`，后并入第 1 步的别名） |
| 第 0 步 冻结口径 | **已完成** | 三元组对拍 `scripts/scss-triples.mjs`、几何+截图 `scripts/ui-geometry.mjs` |
| 第 1 步 只改 themes.css | **已完成** | 见 3.6（实际配对不达标按声明计 28 → 5、逻辑组合 18 → 3） |
| 第 2 步 引入 `--color-pressed` | **已完成** | 9 处（5 个文件）按下态统一；不达标 **归零**，见 5.x |
| 第 4 步 标签徽章 | **已完成** | 53 条两套主题定值 + 不变量测试 + 目视页，见第 7 节 |
| 第 3 / 5 / 6 步 | 未开始 | — |

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

**实测结果**（脚本 `/tmp/color-audit/audit.mjs`，内联 OKLab + WCAG，无 chroma-js；「旧」= 迁移前 `783232f`，用 `git worktree` 取该提交的整棵树跑同一脚本）：

| 指标 | 旧（`783232f`） | 第 1 步后 |
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

### 第 2 步：引入 `--color-pressed`，统一按下口径（已完成）

口径（已同步进 [Button.scss](src/ui/components/ui/Button/Button.scss) 文件头注释）：

```scss
&:active {
    background: var(--color-pressed);
    border-color: var(--color-pressed);
    color: var(--color-on-accent);
}
```

**实际改了 5 个文件、9 处**（比方案预估的 7 处多 2 处 —— 全仓扫描发现 DevMode 的侧栏项与 SelectionPanel 的卡片也是同一个「灰式按下 = 描边色」写法，一并统一）：

| 文件 | 处数 | 位置 |
| --- | --- | --- |
| [Button.scss](src/ui/components/ui/Button/Button.scss) | 3 | `-default` / `-plain` / `-ghost` 的 `:active` |
| [BattleStatsPanel.scss](src/ui/components/BattleStatsPanel/BattleStatsPanel.scss) | 1 | 状态徽章按钮 |
| [EncyclopediaScreen.scss](src/ui/screens/EncyclopediaScreen/EncyclopediaScreen.scss) | 1 | 筛选块 |
| [DevMode.scss](src/ui/screens/DevMode/DevMode.scss) | 1 | 侧栏 nav item |
| [SelectionPanel.scss](src/ui/components/SelectionPanel/SelectionPanel.scss) | 1 | 选择卡片 |

实心强调那一族（`background: var(--color-accent)` / `danger` / `gold` 等 19 处）不动，`-bare` 变体的 `filter: brightness()` 也不动。

**验证结果**：

| 指标 | 结果 |
| --- | --- |
| 实际配对不达标（按声明计，101 对） | 5 → **0**（亮 3 → 0 / 暗 2 → 0） |
| 实际配对不达标（去重成逻辑组合） | 3 → **0** |
| `on-accent on pressed` | 亮 **7.80** / 暗 **4.79**（均 ≥ 4.5） |
| `|ΔL(pressed, bg-hover)|` | 亮 0.467 / 暗 0.365（I4 要求 ≥ 0.15） |
| `pressed` 对页面底 | 亮 8.49 / 暗 4.79（I4 要求 ≥ 3） |
| 三元组对拍 | 900 / 900，消失 0 / 新增 0；**7 条三元组的声明体变化，全部是颜色声明** |
| `@media (hover: hover)` 处数 | 未减少（`grep -c 'hover: hover'` 前后一致） |

> 方案 3.4 表里写的是「暗 4.87」，实测 **4.79**：方案给的暗色 `--color-pressed` 是 `#73737d`，按内联 OKLab 复算 `on-accent on pressed` 只有 4.48（不达标）。第 1 步已把它调到 `#78787f`（L 0.575），实测 4.79。

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

### 第 4 步：标签徽章收编（已完成）

采用**方案 A 的变体**：保留色相身份，但**不保留 53 个色相**——按语义归成 **11 族 / 17 个色位**（同族同色位同色），两套主题各自定值。完整表格、逐条归类依据、存疑项、实测对比度与风险见 **第 7 节**。

落地点：

- 颜色的**唯一事实来源**是 [themes.css](src/ui/styles/themes.css)：两套主题各 53 条 `--tag-color-<tag>`，随 `[data-theme]` 自动切换。
- [tagDisplay.ts](src/bridge/tagDisplay.ts) 的 `TAG_COLOR` 从 `Record<Tag, string>` 改成 `Record<Tag, { light: string; dark: string }>`（色板的 TS 镜像，供测试与工具读取）。
- [Tag.tsx](src/ui/components/ui/Tag/Tag.tsx) 不再内联颜色，改成 `var(--tag-color-<tag>, var(--color-text-dim))`。
- 不变量测试 [tag-colors.test.ts](src/bridge/__tests__/tag-colors.test.ts)（13 条断言，含用户 8 条口径）+ 变异验证 + DevMode「标签配色」目视页（`/dev?tab=tags`）见 7.9。

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
| 三元组对拍 | 第 1 步：900 / 900，消失 0、新增 0、声明体变化 0（只改 `themes.css`，它是 CSS 不是 SCSS，不进摊平集合）。第 2 步：900 / 906（+6 来自新文件 `TagPreview.scss`），**既有文件新增 0、消失 0，7 条声明体变化全部是颜色声明** |
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

## 7. 标签徽章配色（已定稿并落地）

**状态：已实现**（[tagDisplay.ts](src/bridge/tagDisplay.ts) 的 `TAG_COLOR` + [themes.css](src/ui/styles/themes.css) 的 `--tag-color-*`；不变量测试 [tag-colors.test.ts](src/bridge/__tests__/tag-colors.test.ts)）。

### 7.1 归类判据（新增标签按此归属）

用户已逐条校准过四轮（雷 / 流血 / 劈砍·戳刺 / 酒 / 控制类 debuff / 前置 / 远程 / 霜冻 / 麻痹 / 持续伤害归属 / 第十五条的六条色相方向）。**先有判据，再挑颜色** —— 判据取自 [tag.ts](src/engine/entities/tag.ts) 的定义与它**实际被挂在哪里**（武器？招式？还是引擎判定？）：

| # | 如果这个标签在说… | 归到 | 色相带 / 彩度 |
| --- | --- | --- | --- |
| 1 | **怎么打**（技法 / 流派身份） | 武器流派族 | 低彩度 0.055 的冷色（有色相、只压彩度） |
| 2 | **造成什么**：立即结算的伤害 | 伤害进攻族（红→橙） | 高彩度 0.10~0.13 |
| 3 | **造成什么**：按回合 / 持续掉血 | 持续伤害族（血红 / 火红 / 深绿） | 高彩度 0.10~0.13 |
| 4 | **规则本身**（时机 / 射程 / 来源 / 特性…） | 机制规则族 | 低彩度 0.075 青灰 |
| 5 | **资源**（内息 / 缠劲） | 内息资源族 | 青→蓝 |
| 6 | **增益 / 恢复** | 增益恢复族 | 绿 |
| 7 | **被控 / 感官被压制** | 控制族 | **灰，C ≤ 0.02**（靠明度分档） |
| 8 | **防御动作** | 防御格挡族 | 紫罗兰→品红 |
| 9 | 单标签特例 | 雷（蓝）/ 霜冻（冰蓝）/ 麻痹（黄）/ 酒（棕） | — |

**三条容易混的边界（都是本轮校准出来的）**：

- **"劈砍 / 戳刺"不是伤害，是打法。** 判据不是名字，而是：它们是 `tagRelevance.ts` 里的 `weaponType`（权重 4 的 Build 方向），并且 `overlord_art` 那种增强器是按 `tags.includes('slash')` 去找"这一类招式"的。
- **"被控"与"造成伤害"是两种坏。** 引擎自己在 `buff-apply.ts` 有 `CC_DEBUFF_IDS = ['stun','knockdown','disarmed']`，`buff-end.ts` 把 `frost/paralyze/knockdown/sand_blind/stun` 一起当"控制类到期标签" —— 所以它们成族；而掉血的（流血 / 灼烧 / 中毒）另算一族。
- **"持续伤害"与"即时伤害"分开**：流血 / 灼烧 / 中毒是三种持续掉血（血红 / 火红 / 深绿），`bonus_damage` / `self_damage` / `low_hp` 是即时伤害向。

### 7.2 族与色位总表

| 族 | 色位 H | 亮（L / C / hex） | 实测·亮 | 暗（L / C / hex） | 实测·暗 | 覆盖标签 |
| --- | --- | --- | --- | --- | --- | --- |
| 持续伤害 | 85 | L 0.50 / C 0.108 `#8a5800` | 5.41 | L 0.76 / C 0.105 `#d0ac5f` | 9.69 | burn |
| 持续伤害 | 135 | L 0.35 / C 0.100 `#214502` | 9.81 | L 0.58 / C 0.089 `#63864f` | 5.02 | poison |
| 持续伤害 | 25 | L 0.50 / C 0.180 `#b32228` | 5.92 | L 0.76 / C 0.120 `#f4928a` | 9.26 | bleed |
| 伤害进攻 | 15 | L 0.50 / C 0.119 `#9b424d` | 5.73 | L 0.76 / C 0.099 `#e9979d` | 9.32 | self_damage bonus_damage |
| 伤害进攻 | 45 | L 0.35 / C 0.111 `#681f00` | 10.53 | L 0.58 / C 0.100 `#ab6646` | 4.69 | low_hp |
| 武器流派 | 185 | L 0.50 / C 0.056 `#3c6e67` | 5.19 | L 0.76 / C 0.054 `#8abdb6` | 9.97 | unarmed slash one_handed weapon thrown |
| 武器流派 | 210 | L 0.50 / C 0.055 `#3b6c75` | 5.24 | L 0.76 / C 0.055 `#88bbc4` | 9.89 | blunt pierce imperial polearm heavy range melee two_handed |
| 增益恢复 | 160 | L 0.53 / C 0.085 `#3a7b5b` | 4.51 | L 0.76 / C 0.080 `#83c1a0` | 10.04 | cleanse heal buff |
| 内息资源 | 225 | L 0.36 / C 0.078 `#004361` | 9.51 | L 0.58 / C 0.090 `#3285a2` | 4.98 | qi |
| 内息资源 | 250 | L 0.50 / C 0.100 `#32669a` | 5.37 | L 0.76 / C 0.090 `#85b6e9` | 9.80 | qi_action chan |
| 雷 | 275 | L 0.50 / C 0.150 `#4d57b7` | 5.59 | L 0.78 / C 0.113 `#a1b1ff` | 10.18 | electric |
| 霜冻 | 295 | L 0.50 / C 0.049 `#655e7d` | 5.45 | L 0.80 / C 0.044 `#bfb9d8` | 11.07 | frost |
| 麻痹 | 85 | L 0.42 / C 0.087 `#664700` | 7.62 | L 0.66 / C 0.085 `#aa8e53` | 6.66 | paralyze |
| 控制 / 感官 | 135 | L 0.50 / C 0.011 `#61655f` | 5.32 | L 0.76 / C 0.011 `#aeb3ac` | 9.78 | stun sand_blind debuff |
| 控制 / 感官 | 135 | L 0.35 / C 0.010 `#383c37` | 10.05 | L 0.58 / C 0.010 `#787c76` | 4.91 | knockback knockdown |
| 身法闪避 | 320 | L 0.50 / C 0.116 `#804b8c` | 5.69 | L 0.76 / C 0.101 `#ce9cd9` | 9.32 | move |
| 防御格挡 | 345 | L 0.50 / C 0.104 `#8c4971` | 5.68 | L 0.76 / C 0.080 `#d79dbd` | 9.39 | parry ignore_parry heavy_reduce |
| 防御格挡 | 10 | L 0.50 / C 0.105 `#954755` | 5.68 | L 0.76 / C 0.081 `#df9ca5` | 9.38 | counter defense super_armor |
| 酒 | 60 | L 0.50 / C 0.055 `#7b5c43` | 5.44 | L 0.76 / C 0.050 `#caaa92` | 9.61 | jiu |
| 机制规则 | 110 | L 0.35 / C 0.074 `#3d3d02` | 10.07 | L 0.58 / C 0.060 `#7c7e54` | 4.94 | implant trigger talent pre_action post_action internal summon stance retrieve_weapon range_up inherent craft |

「实测·亮 / 实测·暗」= 该色位对同主题 `--color-entity-bg`（亮 `#f2f2f5` / 暗 `#010102`）的 WCAG 对比度。**53 条 × 两套主题全部 ≥ 4.5**（最低 4.51、最高 10.71）。

### 7.3 五条规则

1. **色相带语义** —— 同族共享一条色相带；色相环上 20 个色位间隔 ≥ 25°。
2. **彩度带权重** —— 关键 / 稀有（伤害、持续伤害、控制、雷）高彩度（0.09~0.13）；常见 / 通用（流派、机制、酒、霜冻）低彩度（0.02~0.075）。
3. **同标签色相两套主题不变** —— 只调 L/C。
4. **与 UI 语义色避让** —— 用 ΔH ≥ 25° **或**跨族来避；本方案保留的最近邻居见 7.9 风险第 4 条。
5. **同族可分** —— `ΔH ≥ 25°` **或**（两套主题都 `ΔL ≥ 0.15`）。

### 7.4 「偏白」的物理限制（第十二条，必须记住）

用户要求**霜冻偏白**。但标签色是**文字色**（压在浅色徽章底 `--color-entity-bg` 上），所以：

| 主题 | 徽章底 | 「白」能不能做 | 实际取值 |
| --- | --- | --- | --- |
| 暗（`#010102`） | 近黑 | **能**，高明度就是"白" | `#a4b4bd`，L 0.76（接近白） |
| 亮（`#f2f2f5`） | 近白 | **不能**，白字压白底不可见 | `#536672`，L 0.50（只能是中等明度的**灰蓝**） |

**"偏白"落在色相 / 彩度层面**：霜冻的 C 0.044~0.049（低于流派族 0.055 与 accent 0.083），色相 H295 明确偏蓝 —— 读起来是**蓝白**（第十五条把 C 从 0.022~0.030 提上来、色相从灰青 H235 挪到蓝 H295）。**L 仍然必须由对比度决定**，这与暗色主题深绿的 L 下界是同一种约束：**hue / chroma 可以听人话，L 不可以。**

### 7.5 用户校准记录（26 条，标注来源）

| # | 结论 | 来源 |
| --- | --- | --- |
| 1–7 | 前七条（主色 / 亮色主题 / ap≠gold / pressed / C 上限 / 方案 A / color-mix + 内联 OKLab） | 用户（第 6 节决定 1~8） |
| 8 | **雷 = 蓝**（H285） | **用户指定** |
| 9 | **流血 = 红** | **用户指定** |
| 10 | **控制类 debuff = 灰**（C 0.009~0.010） | **用户指定**（覆盖我"控制=紫"的建议） |
| 11 | **酒 = 棕**（H75） | **用户指定** |
| 12 | **劈砍 / 戳刺 / 钝击 / 远程 = 流派**（低彩度冷色） | **用户指定** |
| 13 | **前置 = 机制族** | **用户指定** |
| 14 | heal 浅绿 / poison 深绿 | **用户指定** |
| 15 | 身法闪避留蓝靛（后微调为紫 H330，给绿带腾位） | 我判断 |
| 16 | debuff 族拆成「持续伤害」与「控制 / 感官」 | 我判断（用户认可） |
| 17 | 显示名简化：附加伤害 → **附伤**、加射程 → **射程** | **用户指定** |
| 18 | **霜冻 = 偏白**（低彩度冰蓝；L 见 7.4 的物理限制） | **用户指定** |
| 19 | **麻痹 = 偏黄**（H60，自成一族，移出控制灰） | **用户指定** |
| 20 | **流血 / 灼烧 = 持续伤害族**（血红 / 火红 / 中毒深绿） | **用户指定** |
| 21 | **流血 = 大红（正红）**：H25（不是偏冷的绯红） | **用户指定**（第十五条） |
| 22 | **灼烧 = 火红（红偏黄）**：H85（比流血更偏黄 46°） | **用户指定**（第十五条） |
| 23 | **麻痹 ≈ 金黄**：H85（从土黄 H60 挪到金黄） | **用户指定**（第十五条） |
| 24 | **霜冻 = 蓝白**：C 放宽到 0.049、色相明确偏蓝 H295、暗色主题 L 提到 0.80 | **用户指定**（第十五条） |
| 25 | **雷电 = 亮蓝**：H275（正蓝，不再是偏紫的 H285）、暗色主题 L 0.78 | **用户指定**（第十五条） |
| 26 | **残血再往红挪**：H45（原 H65） | **用户指定**（第十五条） |

### 7.6 灰 debuff 与低彩度流派怎么区分（一对天然近邻）

两者都"淡"，所以靠**两把尺子同时**量：

| 维度 | 控制 / 感官（灰） | 武器流派（低彩度冷色） |
| --- | --- | --- |
| **彩度** | **C ≤ 0.02**（实测 0.009~0.010，等于无色相） | C = 0.055（有色相，只是压暗） |
| **色相** | H100（名义值；C≈0 时实际无色相） | H185 / H210（青绿→青，明确有色相） |
| **族内分层** | 只用**明度**分两档（L 0.50 / 0.35） | 用**色相**分两档（ΔH 25°） |
| 语义 | 能力被压下去 | "我是这一类打法" |

验证：测试 `灰 debuff 与低彩度流派族可区分` 断言 `C(控制) < C(流派)` 且 `C(流派) > 0.03`；另一条断言控制类 5 个标签的 C 都 ≤ 0.02。

### 7.7 全 53 条复核表（按族分组）

| 标签（中文 + id） | 现属族 | 归类依据 | 色位（H / 亮 / 实测·亮 / 暗 / 实测·暗） |
| --- | --- | --- | --- |
| **灼烧** `burn` | 持续伤害 | 对目标造成持续掉血（**火红**，用户指定） | H85 · `#8a5800` 5.41 · `#d0ac5f` 9.69 |
| **中毒** `poison` | 持续伤害 | 对目标造成持续掉血（**深绿**，用户已定） | H135 · `#214502` 9.81 · `#63864f` 5.02 |
| **流血** `bleed` | 持续伤害 | 对目标造成持续掉血（**血红**，用户指定） | H25 · `#b32228` 5.92 · `#f4928a` 9.26 |
| **自伤** `self_damage` ⚠ | 伤害进攻 | 对自己造成伤害（代价型效果） | H15 · `#9b424d` 5.73 · `#e9979d` 9.32 |
| **附伤** `bonus_damage` ⚠ | 伤害进攻 | 对目标造成额外伤害 | H15 · `#9b424d` 5.73 · `#e9979d` 9.32 |
| **残血** `low_hp` ⚠ | 伤害进攻 | 血量越低越强：伤害向状态 | H45 · `#681f00` 10.53 · `#ab6646` 4.69 |
| **拳脚** `unarmed` | 武器流派 | 怎么打：拳脚流派 | H185 · `#3c6e67` 5.19 · `#8abdb6` 9.97 |
| **劈砍** `slash` | 武器流派 | 怎么打：劈 / 砍的技法身份（`tagRelevance` 归 weaponType） | H185 · `#3c6e67` 5.19 · `#8abdb6` 9.97 |
| **钝击** `blunt` | 武器流派 | 怎么打：钝击技法 | H210 · `#3b6c75` 5.24 · `#88bbc4` 9.89 |
| **戳刺** `pierce` | 武器流派 | 怎么打：戳 / 刺的技法身份（`tagRelevance` 归 weaponType） | H210 · `#3b6c75` 5.24 · `#88bbc4` 9.89 |
| **御物** `imperial` ⚠ | 武器流派 | 怎么打：御物流派 | H210 · `#3b6c75` 5.24 · `#88bbc4` 9.89 |
| **长柄** `polearm` | 武器流派 | 怎么打：长柄流派 | H210 · `#3b6c75` 5.24 · `#88bbc4` 9.89 |
| **重型** `heavy` | 武器流派 | 怎么打：重型兵器流派 | H210 · `#3b6c75` 5.24 · `#88bbc4` 9.89 |
| **远程** `range` | 武器流派 | 怎么打：远程流派（用户指定） | H210 · `#3b6c75` 5.24 · `#88bbc4` 9.89 |
| **近战** `melee` | 武器流派 | 怎么打：近战流派 | H210 · `#3b6c75` 5.24 · `#88bbc4` 9.89 |
| **单手** `one_handed` | 武器流派 | 怎么打：单手兵器流派 | H185 · `#3c6e67` 5.19 · `#8abdb6` 9.97 |
| **双手** `two_handed` | 武器流派 | 怎么打：双手兵器流派 | H210 · `#3b6c75` 5.24 · `#88bbc4` 9.89 |
| **武器** `weapon` | 武器流派 | 怎么打：武器来源的 buff | H185 · `#3c6e67` 5.19 · `#8abdb6` 9.97 |
| **暗器** `thrown` | 武器流派 | 怎么打：暗器流派 | H185 · `#3c6e67` 5.19 · `#8abdb6` 9.97 |
| **净化** `cleanse` | 增益恢复 | 净化 | H160 · `#3a7b5b` 4.51 · `#83c1a0` 10.04 |
| **回复** `heal` | 增益恢复 | 回复（正向资源） | H160 · `#3a7b5b` 4.51 · `#83c1a0` 10.04 |
| **增益** `buff` | 增益恢复 | 增益 | H160 · `#3a7b5b` 4.51 · `#83c1a0` 10.04 |
| **炁** `qi` | 内息资源 | 资源：炁 | H225 · `#004361` 9.51 · `#3285a2` 4.98 |
| **炁招** `qi_action` | 内息资源 | 资源：纯炁凝聚的招式 | H250 · `#32669a` 5.37 · `#85b6e9` 9.80 |
| **缠劲** `chan` | 内息资源 | 资源：缠劲 | H250 · `#32669a` 5.37 · `#85b6e9` 9.80 |
| **雷电** `electric` | 雷 | 雷：单标签（**蓝**，用户指定） | H275 · `#4d57b7` 5.59 · `#a1b1ff` 10.18 |
| **霜冻** `frost` | 霜冻 | 被控：引擎按控制类状态处理（`buff-end` 到期标签）；**偏白 / 冰蓝**（用户指定） | H295 · `#655e7d` 5.45 · `#bfb9d8` 11.07 |
| **麻痹** `paralyze` | 麻痹 | 被控：无法行动（CC_DEBUFF_IDS）；**偏黄**（用户指定） | H85 · `#664700` 7.62 · `#aa8e53` 6.66 |
| **眩晕** `stun` | 控制 / 感官 | 被控：无法行动（CC_DEBUFF_IDS） | H135 · `#61655f` 5.32 · `#aeb3ac` 9.78 |
| **击退** `knockback` ⚠ | 控制 / 感官 | 被位移：失去站位 | H135 · `#383c37` 10.05 · `#787c76` 4.91 |
| **迷眼** `sand_blind` | 控制 / 感官 | 感官被压制（迷眼） | H135 · `#61655f` 5.32 · `#aeb3ac` 9.78 |
| **倒地** `knockdown` | 控制 / 感官 | 被控：倒地（CC_DEBUFF_IDS） | H135 · `#383c37` 10.05 · `#787c76` 4.91 |
| **弱化** `debuff` | 控制 / 感官 | 被削弱：能力被压下去 | H135 · `#61655f` 5.32 · `#aeb3ac` 9.78 |
| **位移** `move` | 身法闪避 | undefined | H320 · `#804b8c` 5.69 · `#ce9cd9` 9.32 |
| **招架** `parry` | 防御格挡 | 防御动作：可招架 | H345 · `#8c4971` 5.68 · `#d79dbd` 9.39 |
| **反击** `counter` | 防御格挡 | 防御动作：反击 | H10 · `#954755` 5.68 · `#df9ca5` 9.38 |
| **破招** `ignore_parry` | 防御格挡 | 防御动作：无视招架 | H345 · `#8c4971` 5.68 · `#d79dbd` 9.39 |
| **化解** `heavy_reduce` | 防御格挡 | 防御动作：化解重器负担 | H345 · `#8c4971` 5.68 · `#d79dbd` 9.39 |
| **防御** `defense` | 防御格挡 | 防御动作：防御 | H10 · `#954755` 5.68 · `#df9ca5` 9.38 |
| **罡体** `super_armor` | 防御格挡 | 防御动作：罡体 | H10 · `#954755` 5.68 · `#df9ca5` 9.38 |
| **酒** `jiu` | 酒 | 酒：道具 / 资源型标签（**棕**，用户指定） | H60 · `#7b5c43` 5.44 · `#caaa92` 9.61 |
| **义体** `implant` | 机制规则 | 规则：义体来源 | H110 · `#3d3d02` 10.07 · `#7c7e54` 4.94 |
| **触发** `trigger` | 机制规则 | 规则：触发槽 | H110 · `#3d3d02` 10.07 · `#7c7e54` 4.94 |
| **天赋** `talent` ⚠ | 机制规则 | 规则：天赋来源 | H110 · `#3d3d02` 10.07 · `#7c7e54` 4.94 |
| **前置** `pre_action` | 机制规则 | 规则：前摇时机（用户指定） | H110 · `#3d3d02` 10.07 · `#7c7e54` 4.94 |
| **后置** `post_action` | 机制规则 | 规则：收招时机 | H110 · `#3d3d02` 10.07 · `#7c7e54` 4.94 |
| **内置** `internal` | 机制规则 | 规则：内部实现，不对玩家暴露 | H110 · `#3d3d02` 10.07 · `#7c7e54` 4.94 |
| **召唤** `summon` ⚠ | 机制规则 | 规则：召唤来源 | H110 · `#3d3d02` 10.07 · `#7c7e54` 4.94 |
| **架势** `stance` | 机制规则 | 规则：架势 / 姿态 | H110 · `#3d3d02` 10.07 · `#7c7e54` 4.94 |
| **收回武器** `retrieve_weapon` | 机制规则 | 规则：收回武器 | H110 · `#3d3d02` 10.07 · `#7c7e54` 4.94 |
| **射程** `range_up` | 机制规则 | 规则：射程增减 | H110 · `#3d3d02` 10.07 · `#7c7e54` 4.94 |
| **特性** `inherent` | 机制规则 | 规则：不可复制 / 不可禁用 | H110 · `#3d3d02` 10.07 · `#7c7e54` 4.94 |
| **天工** `craft` | 机制规则 | 规则：天工锻造品 | H110 · `#3d3d02` 10.07 · `#7c7e54` 4.94 |

⚠ = 存疑项（集中在 7.8）。

### 7.8 存疑项（7 条，供逐条定夺）

用户已定掉 `frost`（第十二条：偏白）；其余 7 条保持待定：

| 标签 | 现属族 | 两种归法的道理 |
| --- | --- | --- |
| **自伤** `self_damage` | 伤害族（H30） |
| **残血** `low_hp` | 伤害族（H65） |
| **附伤** `bonus_damage` | 伤害族（H30） |
| **击退** `knockback` | 控制族（H100） |
| **御物** `imperial` | 流派族（H210） |
| **召唤** `summon` | 机制族（H100） |
| **天赋** `talent` | 机制族（H100） |

**处置建议**：`自伤` / `附伤` / `残血` 建议留在**伤害族**（落点都是伤害数值）；`击退` 建议留在**控制族**（失去站位，与倒地同类）；`御物` 建议留在**流派族**（`tagRelevance.ts` 已归 weaponType）；`召唤` / `天赋` 建议留在**机制族**（回答"从哪来"而非"怎么打"）。若用户希望"召唤流 / 天赋流"成为 Build 身份，可移流派族。

### 7.9 第十五条的四处碰撞与区分依据

六条方向校准撞上了已有色带，逐处处理如下（实测值）：

| 碰撞 | 最近邻 | ΔH | ΔC | ΔL | 靠什么区分 |
| --- | --- | --- | --- | --- | --- |
| **流血大红(H25) ↔ 灼烧火红(H85)** | 同族 | **46.4°** | 0.072 | 0.00 | **色相**（都保住"红"，但火红明显偏黄；远超族内 25° 门槛） |
| **灼烧火红(H71 亮) ↔ danger/警告暖带** | danger(H22) / warning(H51) | 49° / 20° | 0.108 vs 0.17 | 0.01 | **彩度**（灼烧 C 0.108 < danger 0.17）+ 跨族（持续伤害 vs UI 语义） |
| **麻痹金黄(H85) ↔ gold(H82) / 酒(H60)** | gold / jiu | **7.9°** / 25° | 0.087 vs 0.10 / 0.055 | 0.08 / 0.08 | 跨族 + **彩度**（麻痹 0.087 低于 gold 的 0.10）+ **明度**（麻痹 L0.42/0.66，酒 L0.50/0.76） |
| **雷电亮蓝(H275) ↔ 机制族(H110) / 内息(H225,250) / 霜冻(H295)** | 霜冻 / 内息 | **19.8°** / 25° | **0.150 vs 0.049** | 0.00 | **彩度**（雷 0.150 是全场最高，霜冻只有它 1/3）+ 跨族 |
| **霜冻蓝白(H295) ↔ 雷电(H275) / accent(188)** | 雷电 / accent | 19.8° / 107° | 0.049 vs 0.150 / 0.083 | 0.00 | **彩度**（霜冻 0.049 < accent 0.083，远低于雷 0.150）+ 明度（暗色主题 L0.80 近白） |

**结论**：四处都靠"**跨族 + 彩度/明度**"并存，没有为了不变量改掉用户的方向（流血仍是 H25 正红、灼烧仍是 H85 火红、麻痹仍是 H85 金黄、雷仍是 H275 正蓝）。

### 7.10 改动比例与风险

| 处置 | 条数 |
| --- | --- |
| **微调**（ΔH ≤ 25°） | 10 |
| **换色相**（ΔH > 25°） | 43 |

现状复核（旧底色 `#e8e8f0`）：亮 **46/53** 不达标；定稿后 **0/53**。

风险与代价：

1. **色相环已经很满（20 个色位 / 环上 16 条色相带）**：再加新族只能靠"共享色相带 + 明度档"或复用既有族；两条新语义色挤进暖带时，`麻痹`（H60）与伤害族的 `低血`（H65）只差 5°，靠 ΔL 0.15 分开 —— 这是规则允许的，但视觉上不如色相区分干净。
2. **`霜冻` 亮色主题做不到"白"**（见 7.4），只能是灰蓝。若用户不接受，唯一出路是把徽章底改成深色（那是另一个设计决定）。
3. **机制族 12 个标签同色**：族口径下的必然结果。
4. **保留的跨族近邻**：`持续伤害`(H30) ↔ danger(22) 8°、`麻痹`(H60) ↔ warning(51) 9°、`控制`(H100) ↔ ap(108) 8°、`流派`(H185/H210) ↔ accent(188) 3°/22°、`恢复`(H160) ↔ success(152) 8°、`酒`(H75) ↔ gold(82) 7°。它们**不同族**，区分靠彩度（0.055~0.08 vs 语义色 0.083~0.17）与明度。

### 7.11 落地方式（已完成）

- **颜色的唯一事实来源是 [themes.css](src/ui/styles/themes.css)**：两套主题各 53 条 `--tag-color-<tag>`（共 106），随 `[data-theme]` 自动切换，零运行时开销。
- **`TAG_COLOR` 是 `Record<Tag, { light: string; dark: string }>`**（TS 镜像）；[Tag.tsx](src/ui/components/ui/Tag/Tag.tsx) 改成 `var(--tag-color-<tag>, var(--color-text-dim))`。
- **不变量测试** [tag-colors.test.ts](src/bridge/__tests__/tag-colors.test.ts)（**22 条断言**，内联约 30 行 OKLab/WCAG）：4 条通用（对比度 / 两主题不同 / 同族可分 / CSS-TS 一致）+ 18 条用户口径（雷=蓝、流血=红、控制=灰、酒=棕、劈砍等=流派、前置∈机制+远程∈流派、控制≠红绿、heal 浅/poison 深、灰 vs 流派可分、**霜冻=低彩度冰感**、**麻痹=偏黄**、**流血/灼烧/中毒同族且血红≠火红**）。
- **变异验证**（13 组，全部红灯）：`stun`→紫、`bleed`→绿、`electric`→红、`jiu`→绿、`frost`→高彩度蓝、`paralyze`→灰、`burn`→血红同色；第十五条又跑 6 组：**`bleed`→偏冷绯红**（`H 应 20~40`）、**`burn`→大红同色**（`火红必须比大红更偏黄`）、**`frost`→高彩度蓝**（`C 应 ≤ 0.06` 且低于 electric 一半）、**`electric`→偏紫蓝**（`H 应 240~280`）、**`paralyze`→土黄**（`H 应 75~100`）、**`low_hp`→黄**（`H 应 30~55`）。
- **目视页**：DevMode「标签配色」tab（`/dev?tab=tags`），按 13 族分组，截图 `tmp/preview/tag-preview-{light,dark}-*.png`。
