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

**文件结构**（`src/ui/pixel-sprites/`）：武器数据与挂点**一个武器一个文件**，公共逻辑单独成模块 ——
`weapons/entries/<武器>.ts`（美术 + 各姿势挂点，改某个武器只看这一个文件）、`weapons/hands.ts`（手部锚点/遮罩表，
全局按姿势）、`weapons/poses.ts`（`POSE_NAMES`/`makePoses`/表类型）、`weapons/mount.ts`（`resolveWeaponMount` 等解析）、
`weapons/dual.ts`（双持与双手角度规则）、`weapons/overlay.ts`（美术查询）；`weapons.ts` 只是汇总 barrel（导出名与拆分前一致）。
身体帧同理：`sprites/<姿势>.ts`（idle/attack/hit/dodge/parry/buff），`sprites/index.ts` 汇总成 `SPRITES`，`sprites.ts` 是 barrel。

**画法约定**（`src/ui/pixel-sprites/weapons/entries/`）：

- 一律按轴向几何生成：`u = (A - x - y)·√½`（沿轴，越大越靠尖端/左上）、`v = (y - x)·√½`（横向，符号决定受光/背光侧），`A` 取该武器轴起点的 `x + y`。禁止「按行阶梯」画斜线（会斜掉）。
- 刃/尖端一律画在美术网格的**左上端**（沿轴坐标 `k = x+y-6` 的小端）。要让长端朝角色正面，用握点/`flip` 去解决，不要反过来画刃（所有兵器点阵同源才好复用）。
- 武器美术画在 32×32 网格（`constants.ts` 的 `WEAPON_WIDTH/HEIGHT`）；像素颜色索引必须写**数字**（字符串会被当成颜色字面量，渲染成黑色）。
- 握点与姿势独立登记在 `WEAPON_POSES`：**一把武器只有一个握点**（写在 `...makePoses({ gripX, gripY })` 基底里），姿势要调就写 `gripDX/gripDY` 偏移；角度逐姿势显式写 `angle`（弧度或 `(N * Math.PI) / 180`）。**每把武器独立写配置，同族也不共享常量**，便于逐把微调。（历史包袱已删：第二握点 `grip2*` 与目标手 `target*` —— 它们原本只为"两手连线自动算角度"存在，现在角度自由编辑，模型简化为「一个握点 + 角度 + 手位偏移」；长柄武器的 `anchorHand: 'off'` 保留（锚副手）。）
- **手位覆盖一律写「相对偏移」**：`handDX/handDY`（相对 `HAND_POINTS[pose]`；锚副手的武器相对 `OTHER_HAND_POINT[pose]`）。优先级：绝对 `handX/handY`（旧数据仍支持）> 相对偏移 > 基准。编辑器拖动/输入写的都是偏移，`编辑器导出`也把绝对值折算成偏移，所以导出贴回后武器仍然**跟随全局手位表**（`HAND_POINTS` 一改全体跟着动），不会把自己锁死在绝对坐标上。基准解析唯一入口 `baseAnchorHand(cfg, pose, slot)`。
- **逐姿势美术**：武器可以有 6 个姿势各自的一张美术图（武器文件里的可选 `art` 字段，键为姿势名），缺的姿势按 `art[姿势] → art.idle → overlay` 坍缩；解析入口只有 `weapons/overlay.ts` 的 `getWeaponArt(weaponId, pose)`（空对象/空 pixels 视为没有）。编辑器「武器图」模式用画布上方的姿势条（通用 + 六姿势）逐个编辑，导出为只含 `pixels` 的 `art:` 块（空姿势不写）。**一把武器只有一份调色板 + 一套下标**：`palette` 声明在通用图的 `overlay` 上，六个姿势块不写、取图时由 `getWeaponArt` 继承（继承时返回的是带同一份 `palette` 的新对象，不是同一个引用；块自己写了 `palette` 就以它为准）；下标就是文件里 `palette` 的键，导出片段原样沿用、**不重新编号**。不写 `art` 的武器行为与从前完全一致。
- **导出片段的压缩语义**：表里的姿势条目是**整体替换** `...makePoses(基底)` 的同名条目（不是合并），因此写出来的条目必须自包含；只有与基底完全相同的姿势才省略。偏移为 0 一律不写（省略即 0，不需要显式写 `handDX: 0`）。
- **槽位（主手 / 副手）是一等维度**：`WEAPON_POSES[武器][姿势]` 是主手槽；副手槽写可选的 `off` 子表（`WEAPON_POSES[武器].off[姿势]`）。副手没登记时按「副手默认」：握柄与角度都沿用主手表（即这把武器自己的配置），只有手位取全局 `OTHER_HAND_POINT[pose]`（角度不再有全局默认表：`DUAL_MAIN_ANGLE` 与 `DUAL_OFFHAND_ANGLE` 都已删除）。面板只在武器带 `one_handed` 标签（引擎数据）时才显示副手槽。解析入口只有 `resolveWeaponMount(weaponId, pose, { slot, config?, facingRight? })`，战斗渲染器 / 像素预览 / 编辑器都走它，不要各算一套。
- **双持会画两把**：`CharacterSnapshot.offhand`（来自 `build.offhand`，战斗中固定）→ 渲染器为每个角色多两组 Graphics（副手武器画在主手武器**下面**，副手手部遮罩用另一侧的手）。
- 改手位或轴向后必须同步 `HAND_POINTS` / `OTHER_HAND_POINT` / `HAND_COVER` / `LEFT_HAND_COVER`。
- **手部遮罩规则**：遮不遮 = `handCover`（与 `flip` 同级的两层字段：写在 `poses` 基底里是整把武器的默认，单个姿势条目可覆盖；不填 = 遮），**且** `hit` 一律不遮（武器脱手）。遮哪只 = 只遮「锚定的那只手」；长柄（引擎 `polearm` 标签）两只手都在杆上 → 两只都遮（`weapon-tags.ts` 的 `isPolearm()`）。两条规则的唯一判定入口是 `weapons/dual.ts` 的 `shouldDrawHandCover(pose, cfg)`，调用方必须传**已经解析好的**该姿势配置（`resolveWeaponMount` 的 `config`），不要再各自复制判断。`handCover: false` 是给「甲片本身就是手」的武器（拳套/护手类）用的——那种武器的手由美术自己画。编辑器里在「武器挂点」页的「手部覆盖」下拉调（本槽位共用 / 本姿势两处）。

**像素编辑器**：DevMode 的「像素编辑器」tab（`/dev?tab=editor`，源码 `src/ui/screens/DevMode/PixelEditor/`），两种模式：

- **身体帧**（48×48，槽位 0~9）：槽位涂格、镜像、油漆桶、一键自动描边/加金边；**手部锚点可直接拖动**并导出
  `weapons/hands.ts` 的四张表片段（握点 + 2×2 遮罩格，还能自动吸附到最近的皮肤块）；导入导出都是「一张图」，
  导出片段与 `sprites/<姿势>.ts` 的字面量逐字符同构，可整段替换；手部锚点导出的是 `weapons/hands.ts` 的片段。老版本导出的渲染帧（60×48）载入时会自动裁掉左侧留白。
- **武器**（32×32，颜色任选）：调色板可加/改/删颜色 —— 一把武器只有一份调色板 + 一套下标，`palette` 声明在通用图的 `overlay` 上（姿势块不写、取图时继承），下标就是文件里 `palette` 的键，导出片段原样沿用、不重新编号；删色只把那一格留空、下标一律不重排（还有图在用就不许删），空位在调色板面板里不显示、加色会优先填回最低的空位；调色板单独用「复制调色板」按钮导出 `const PALETTE`（跳过空位），**片段里不夹带 palette**（隐式夹带会让「复制片段」的内容时有时无）。导出该武器文件里的 `overlay:` 块（只给稀疏 `pixels`；「复制当前条目」在通用图时会**带上 `palette: PALETTE,`** —— 共用调色板就挂在这一条上，整条替换时不带它就会把声明弄丢、七张图一起变洋红）；
  「武器挂点」模式导出 `poses:` 块。两者都粘进 `weapons/entries/<武器>.ts`（片段首行注释写了目标文件），
  也可以只粘其中一块（换美术不动挂点、换挂点不动美术）。

改任何 `DEFAULT_<POSE>` 都走它，不要手工逐格描边；规则不用背，右侧面板只显示尺寸/统计。

**预览工具**：`npm run pixel -- <武器ID[,ID...]> [姿势|all] [缩放]` 输出 `scripts/preview/*.png`（旋转方式与游戏一致：旋转整张位图 + 反向最近邻采样；不要用逐像素取整，会把 2 格宽的杆挤成 1 格）。新增武器后在 DevMode 的像素查看器确认五个姿势的包围盒都落在 120×54 画布内。
