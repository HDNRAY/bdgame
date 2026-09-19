# Project Memory

This is a roguelite auto-battle game (代号《单挑》).
Tech stack: TypeScript + Vite 6 + React 19 + Zustand + CSS Modules + Canvas API.

## 写作规范

**编写/修改任何叙事文本（事件文案、故事线、角色背景、设定文档）之前，必须先读 `docs/writing-style.md`**，并按其中规则写作（白描、短句、「」对话、时间锚点、节点结构）。参考文档：`docs/background/town-settings.md`（世界观）、`docs/background/character-relations.md`（角色关联）、`docs/stories/`（各故事线）。

**禁止 emoji**：所有文本（事件文案、UI 文案、角色/故事设定文档、设计文档）一律不得出现 emoji/表情符号（如 ✅❌⚠️🔥⚔💀）。需要"已完成/未完成"类标记时用文字（「已」「未」「是」「否」）代替。

## 玩法/数值文档

**终局与元进度：`docs/ending-design.md`** — n33 决赛之后的 **n33.5 隐藏boss**（= 最近一次通关的玩家 build：保留 13 个奖励、义体拉满、属性六项各 7 点起（`CHAMPION_BASE_ATTR`）、奖励与义体全部叠加不抵扣，不走 `gen()`）与 **n34 许愿 / 转身离开**；两段无奖励，用「插入事件」实现（`src/data/events/ending.ts`），不动节点编号；元进度存档 `MetaSave`（`localStorage` key `dantiao:meta:v1`，`src/game/meta-save.ts`）。改终局/存档相关代码前先对照本文档。两个易错点：**(1)** 隐藏boss 的 build `id` 必须与玩家（`'player'`）不同，否则 `winner === enemy.id` 会让 boss 战恒判为败；**(2)** 胜负分支要写在战斗轮的**下一轮**（选项在推轮时按 `result.won` 过滤，战斗轮自己的选项是战斗结算前过滤的）。「转身，离开」要连选三次（每次都被蛊惑一句，次数记在 `flags.leave_step`），走完真结局会先盖一页章页样式的终章（`TRUE_ENDING_EPILOGUE`）。隐藏boss 胜率用 `npm run tour -- champion_boss --champion=<build.json>` 测（DevMode「元进度」页可导出该 JSON）。

**对战玩法说明：`docs/gameplay-guide.md`** — 面向玩家的规则手册：一场对决怎么进行、六属性作用、内息/缠劲资源循环、距离与射程、出手结算顺序、数值公式（命中/暴击/招架）、特殊机制、流派思路。改动任何涉及战斗机制、属性公式、资源循环的代码前，先对照本文档确认不破坏文档所述规则（数值以引擎为准，文档负责玩家可读表述）。首页「玩法」弹窗（`src/ui/screens/ModeSelect/GameplayModal.tsx`）是本文档的界面精简版，两处文案需同步。文档与弹窗均为玩家向表述，不要写入实现细节（代码标识符、内部钩子名等）。

## RTK (token-saving command compression)

RTK is installed on this machine. When running shell commands via `bash`, **always prefix with `rtk`** where supported to reduce token cost and save on API usage:

| Normal command            | Use instead                                   | Why                      |
| ------------------------- | --------------------------------------------- | ------------------------ |
| `git status`              | `rtk git status`                              | 45 lines → ~12 lines     |
| `git diff`                | `rtk git diff`                                | Condensed diff           |
| `git log -n 10`           | `rtk git log -n 10`                           | One-line commits         |
| `git add/commit/push`     | `rtk git add"/"rtk git commit"/"rtk git push` | → "ok" / "ok abc1234"    |
| `ls` / `ls -la`           | `rtk ls`                                      | Tree view, ~80% less     |
| `cat src/foo.ts`          | `rtk read src/foo.ts`                         | Smart file reading       |
| `grep "pattern" .`        | `rtk grep "pattern" .`                        | Grouped search results   |
| `npm test` / `npx vitest` | `rtk test npm test`                           | Failures only, ~90% less |
| `npx tsc --noEmit`        | `rtk tsc`                                     | Errors grouped by file   |
| `npx eslint .`            | `rtk lint`                                    | Grouped by rule/file     |

For commands not in this table, run normally — RTK passes through unknown commands.

## Coding rules

When modifying engine source code (`src/engine/`), the following must hold **before every commit**:

1. **Zero `as any`** — use discriminated union + switch for type narrowing. If unavoidable, justify with a comment.
2. **Zero unused variables/imports** — `noUnusedLocals: true` + `noUnusedParameters: true` in tsconfig. Parameters that MUST exist for type signature but are truly unused get `_` prefix. Never use a `_`-prefixed variable in code.
3. **不要硬编码业务逻辑到 engine** — 优先用 buff hook（`onCritDamage` / `onAfterCritDamage` / `onDealDamage` 等）、artifact/passive effect、trigger action 等已有扩展点实现特性。避免直接修改 `src/engine/` 下的核心战斗管道。
4. **不要动态 `import()`** —— 引擎 / 数据 / 脚本 / 测试里一律用顶层静态 `import`；类型也一样：写顶层 `import type { X } from '…'`，**不要**写行内 `import('…').X`。
   动态 import 会把依赖关系藏起来、破坏类型检查与 tree-shaking，在 vitest/tsx 下还容易制造隐性 async 边界；它历史上被用来绕过循环依赖 —— 那应该改成拆模块，或用惰性索引（参考 `src/data/buffs/index.ts` 的懒构建），而不是动态 import。
   唯一例外：UI 的路由级代码分割（`React.lazy(() => import('./ui/screens/…'))`，见 `src/App.tsx`）。

5. **Always run after every change (not just before commit):**
    ```bash
    npx tsc --noEmit -p tsconfig.app.json  # strict type check（覆盖 src，含 __tests__）
    npx eslint src/ --quiet                # eslint zero errors
    npx vitest run                         # all tests pass
    grep -rn ' as any' src/engine/         # zero as any
    ```
    **`tsc` 必须带 `-p tsconfig.app.json`。** 根 `tsconfig.json` 是 `files: []` + `references` 的
    solution 配置，不带 `-p` 时一个文件都不查 —— 所以 `npx tsc --noEmit`（以及 `rtk tsc`）打印的
    "No errors found" 是**假绿**。vitest 只转译、不做类型检查，测试文件里的类型错误只能靠这条命令拦住
    （历史上漏过：`engine.execute` 是私有方法、钩子 ctx 形状不匹配）。
    `scripts/` 目前**不在任何 tsconfig 的 include 里**（app 只含 `src`，node 只含 `vite.config.ts`），
    且 `eslint src/` 不覆盖它 —— 改脚本时顺手跑 `npx eslint scripts/<file>`。

## UI 组件架构

### 架构原则（非固定目录，随需调整）

1. **职责分层**：
    - `src/ui/components/ui/` — 通用可复用 UI 原子组件（Tooltip、Tag、TagList、EffectList、EntityItem 等），不依赖业务数据
    - `src/ui/components/tooltip-contents/` — 各实体类型的 tooltip 内容组件，组合 UI 原子组件 + 引擎数据
    - `src/ui/components/panels/` — 业务面板组件（BuildPanel、BattlePanel、ReplayPanel、SelectionPanel 等）
    - `src/ui/hooks/` — 通用 hooks

2. **组件化原则**：
    - 任何重复出现的 UI 模式（Tag 徽章、Effect 列表、Entity 列表项、Tooltip 包裹）必须提取为独立组件
    - Tooltip 是通用容器（定位/显隐/动画），不关心内容
    - `*Tooltip` 组件是具体内容，组合 TagList、EffectList 等原子组件
    - 调用方只需 `<Tooltip content={<WeaponTooltip weapon={w} />}>hover me</Tooltip>`

3. **数据展示在 engine 层**：
    - Tag 中文名/颜色映射 → `src/engine/data/tagDisplay.ts`
    - EffectDef → 中文描述逻辑 → `src/engine/data/effectDisplay.ts`
    - 纯函数，不依赖 React，可被任意层调用

4. **Tooltip 渲染**：
    - 使用 `createPortal` 挂到 `document.body`，`position: fixed`
    - 避免被父容器 overflow/position 裁切

5. **实体显示约定**：
    - 所有实体（武器/招式/功法/奇物/属性）都应有完整 tooltip
    - 触发器的 action 必须复用 `ActionTooltip` 组件
    - 功法/奇物的 tooltip 必须展示其带来的所有效果：buff、属性变化、触发槽（含条件名+招式名）
    - 触发 section 只显示玩家手动设置的触发 (`character.build.triggers`)，功法/奇物自带的触发在其 tooltip 中展示

### 数据源

| 类型             | 定义位置                          | 关键字段                                                          |
| ---------------- | --------------------------------- | ----------------------------------------------------------------- |
| WeaponDef        | src/engine/data/weapons.ts        | name, description, tags, range, effects, triggers                 |
| ActionDefinition | src/engine/entities/action.ts     | name, description, tags, apCost, effects, target, chance, maxUses |
| Passive          | src/engine/entities/passive.ts    | name, description, tags, effects, triggers                        |
| Artifact         | src/engine/entities/artifact.ts   | name, description, tags, effects, triggers                        |
| AttrName         | src/engine/entities/attributes.ts | ATTR_CN[attr], ATTR_DESC[attr] (注释)                             |
| Tag              | src/engine/entities/tag.ts        | 53 种标签类型，对应中文名见 tagDisplay.ts（功法不带同名 tag：类型即身份） |
| EffectDef        | src/engine/entities/action.ts     | 效果变体全表看类型定义（damage/heal/stat_buff/stat_restriction 等，别写死个数） |

**招式挡奖励池的两道闸**（`src/game/roguelite/reward-pool.ts` 的 `_getActionPool()`）：

| 手段           | 挡奖励池 | 挡 AI 主招候选                                                 |
| -------------- | -------- | -------------------------------------------------------------- |
| `internal` 标签 | 是       | 是（`src/engine/ai/index.ts` 的主招循环直接跳过该标签）        |
| `_` id 前缀     | 是       | 否（全库只有 `_getActionPool()` 读这个前缀）                    |

「AI/对手要用、但不该被玩家当「学招式」奖励抽到」的招式只加 `_` 前缀，**不要加 `internal`** —— `internal` 会让 AI 出不了这张牌（曾因此把一刀/德克的胜率砍半）。两个手段不等价的完整说明见 `docs/tag-audit.md` §十二。

**出招条件 vs 触发器**：出招条件是**自己的套路**（自身状态门槛，唯一表达 `ActionConfig.condition`，解析入口 `resolveCondition()`）；触发器是**见招拆招**（交手事件，表在 `src/data/triggers.ts`）。自身状态阈值（如血量）**不做成触发槽**。细节见这两个文件的文件头注释。

## 像素美术（武器叠加图）

**可靠参照只有三把**：桃木剑、齐眉棍、玄铁重剑（人工逐格调过，可当模板）。其余武器图为早期 AI 生成，不可当参照。

**画法约定**（`src/ui/pixel-sprites/weapons.ts`）：

- 一律按轴向几何生成：`u = (A - x - y)·√½`（沿轴，越大越靠尖端/左上）、`v = (y - x)·√½`（横向，符号决定受光/背光侧），`A` 取该武器轴起点的 `x + y`。禁止「按行阶梯」画斜线（会斜掉）。
- 刃/尖端一律画在美术网格的**左上端**（沿轴坐标 `k = x+y-6` 的小端）。要让长端朝角色正面，用握点/`flip` 去解决，不要反过来画刃（所有兵器点阵同源才好复用）。
- 武器美术画在 32×32 网格（`constants.ts` 的 `WEAPON_WIDTH/HEIGHT`）；像素颜色索引必须写**数字**（字符串会被当成颜色字面量，渲染成黑色）。
- 握点与姿势独立登记在 `WEAPON_POSES`：单手武器锚主手；双手武器给 `gripX/gripY` + `grip2X/grip2Y`，角度由两手连线自动算（`getWeaponAngle`），可用 `handX/handY/targetX/targetY/angle` 逐姿势覆盖。**每把武器独立写配置，同族也不共享常量**，便于逐把微调。
- 改手位或轴向后必须同步 `HAND_POINTS` / `OTHER_HAND_POINT` / `HAND_COVER` / `LEFT_HAND_COVER`。

**预览工具**：`npm run pixel -- <武器ID[,ID...]> [姿势|all] [缩放]` 输出 `scripts/preview/*.png`（旋转方式与游戏一致：旋转整张位图 + 反向最近邻采样；不要用逐像素取整，会把 2 格宽的杆挤成 1 格）。新增武器后在 DevMode 的像素查看器确认五个姿势的包围盒都落在 120×54 画布内。
