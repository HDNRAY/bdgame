# Project Memory

This is a roguelite auto-battle game (代号《单挑》).
Tech stack: TypeScript + Vite 6 + React 19 + Zustand + CSS Modules + Canvas API.

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
3. **Always run before commit:**
    ```bash
    npx tsc --noEmit -p tsconfig.app.json  # strict type check
    npx vitest run                         # all tests pass
    grep -rn ' as any' src/engine/         # zero as any
    ```

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
| Tag              | src/engine/entities/tag.ts        | 36 种标签类型，对应中文名见 tagDisplay.ts                         |
| EffectDef        | src/engine/entities/action.ts     | 24 种效果变体 (damage/heal/stat_buff/status 等)                   |
