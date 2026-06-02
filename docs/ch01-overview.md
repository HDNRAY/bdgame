# 第 1 章：项目总览与技术方案

---

## 1.1 游戏概述

2088 年，赛博化世界。贫富差距极端，义体改造盛行，热武器被禁。人类重新发掘体内的"炁"。
玩家操控一名武者，从 32 强守门人战起步，经历小组赛→8强→4强→半决赛→决赛，在 ~30 个节点中抉择成长路径，最终夺冠。

核心玩法：Roguelite 节点选择 + 自动战斗 + 功法/招式/触发器构筑。

## 1.2 技术栈

| 层           | 技术            | 版本 | 用途                             |
| ------------ | --------------- | ---- | -------------------------------- |
| 语言         | TypeScript      | 5.x  | 全栈类型安全                     |
| 构建         | Vite            | 6.x  | 开发/打包                        |
| UI 框架      | React           | 19.x | 全部 UI 组件                     |
| UI 状态      | Zustand         | 5.x  | UI 层状态(当前屏幕、hover、焦点) |
| 样式         | CSS Modules     | -    | 组件级作用域样式                 |
| 战斗渲染     | 原生 Canvas API | -    | 角色站位、动作播放               |
| 测试         | Vitest          | 3.x  | 逻辑层单元测试                   |
| 桌面端(后续) | Tauri v2        | -    | 桌面应用打包                     |
| 移动端(后续) | Capacitor       | -    | iOS/Android 打包                 |

## 1.3 不使用的技术及原因

| 技术               | 原因                                         |
| ------------------ | -------------------------------------------- |
| Unity / Cocos / UE | 重型引擎，不适合文字为主的轻量游戏           |
| Phaser.js          | 物理引擎/场景管理对自动战斗无价值，UI 能力弱 |
| PixiJS             | 当前阶段动画复杂度不需要，后续可引入         |
| Redux / MobX       | 逻辑层不用全局状态管理；UI 层 Zustand 足够   |

## 1.4 架构分层

```
┌──────────────────────────────────────────┐
│  UI 层 (src/ui/)                          │
│  React 组件，从 bridge 读取只读数据        │
│  Zustand 管理 UI 状态                      │
│  键盘/鼠标/触屏 输入适配                   │
└──────────────┬───────────────────────────┘
               │ player action → command
               ▼
┌──────────────────────────────────────────┐
│  Bridge 层 (src/bridge/)                  │
│  UI action → GameCommand                  │
│  GameState → ReadonlyView (给 UI)         │
│  触发 Zustand set() 的唯一入口            │
└──────────────┬───────────────────────────┘
               │ command
               ▼
┌──────────────────────────────────────────┐
│  逻辑层 (src/engine/)                     │
│  纯 TypeScript，零外部依赖                 │
│  OOP 实体 + EventBus 解耦                 │
│  Character / Skill / Action / Trigger     │
│  BattleEngine / EventQueue / TurnManager  │
└──────────────────────────────────────────┘
```

## 1.5 逻辑层内部设计

**实体 (OOP):**

- `Character` — 角色（属性、功法集、招式集、触发器槽、Buff集、义体等级）
- `Skill` — 功法（被动效果）
- `Action` — 招式（前摇、伤害、命中判定、硬直）
- `Trigger` — 触发器（条件 + 效果，需占用触发槽）
- `Buff / Dot` — 增益/减益/持续伤害
- `Implant` — 义体（属性大幅提升 + 惩罚递增）

**系统 (EventBus 解耦):**

- `BattleEngine` — 管理战斗生命周期 (start → in_battle → end)
- `EventQueue` — 按时间戳排序的事件优先队列
- `TurnManager` — 根据身法等因子计算角色回合
- `ActionExecutor` — 执行招式，调用命中/伤害计算
- `TriggerSystem` — 监听事件，匹配条件，插入新事件
- `DotSystem` — 中毒等独立计时dot
- `BuffSystem` — Buff 的叠加/衰减/移除

**事件总线示例:**

```
EventBus channels:
  turn_start   → DotSystem 检查中毒 → 插入 bleed 事件
  before_action → TriggerSystem 检查 → 可能插入反击事件
  after_damage → BuffSystem 检查 → 插入 流血 事件
  on_dodge     → 流血dot 触发额外扣血
```

## 1.6 文件夹结构

```
bdgame/
├── public/                    # 静态资源
├── src/
│   ├── engine/                # 逻辑层（零外部依赖）
│   │   ├── entities/          # Character, Skill, Action, Trigger, Buff
│   │   ├── systems/           # BattleEngine, EventQueue, TurnManager
│   │   ├── data/              # 游戏数据（功法/招式/触发器/义体配置）
│   │   ├── events/            # EventBus 定义与事件类型
│   │   └── index.ts           # 逻辑层统一导出
│   ├── bridge/                # Bridge 层
│   │   ├── game-bridge.ts     # command → engine, state → view
│   │   ├── commands.ts        # GameCommand 类型定义
│   │   └── views.ts           # ReadonlyView 类型定义
│   ├── ui/                    # UI 层
│   │   ├── screens/           # 主菜单、地图、战斗、结算
│   │   ├── components/        # Button, Tooltip, Panel
│   │   ├── hooks/             # 自定义 hooks
│   │   ├── input/             # 输入适配（键盘导航、触屏手势）
│   │   └── store.ts           # Zustand UI store
│   ├── battle/                # 战斗可视化（Canvas 渲染）
│   │   ├── renderer.ts        # Canvas 渲染器
│   │   └── animations.ts      # 动画定义
│   ├── App.tsx
│   └── main.tsx
├── tests/
│   ├── engine/                # 逻辑层单元测试（核心）
│   └── e2e/                   # 端到端测试（后续）
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── docs/
    ├── plan.md                # 索引入口
    ├── ch01-overview.md       # 本文档
    └── ch02-battle-engine.md  # 第 2 章
```

## 1.7 数据驱动设计

所有游戏内容定义为数据配置，引擎读取配置执行：

```ts
// 示例：招式数据定义 (src/engine/data/actions.ts)
export const 回旋踢: ActionDef = {
    id: 'roundhouse_kick',
    name: '回旋踢',
    baseDamage: 8,
    primaryAttr: '身法',
    effects: [
        { type: 'damage', damageType: 'flat', value: 12 },
        { type: 'dot_apply', dotId: 'bleed', value: 5, duration: 3 },
    ],
    preDelay: 300,
    stunTime: 200,
}
```

新增招式/功法/触发器只需加一条数据定义，引擎不用改。
新增**机制**时（如新效果类型），需在引擎对应的 effect 处理器注册，引擎核心逻辑不动。

## 1.8 事件日志与对局回放

每个战斗事件（回合开始、移动、选招、前摇、命中判定、招架、伤害、效果链、硬直、回合结束）都会被序列化为 `BattleEvent` 记录到 **事件日志**。

```ts
// 每场战斗产生一个只读的事件流
type BattleLog = BattleEvent[]

// 可用于：
//   1. 战斗回放/慢放（逐帧播放日志）
//   2. 复盘分析（哪次招架改变了战局）
//   3. 调试（对比两次不同 build 的同一节点战斗）
//   4. 分享（导出日志让其他人观看）
```

事件日志与 `EventQueue` 共享事件类型定义，但日志是**只读归档**，不参与战斗逻辑。

## 1.9 引擎扩展点（MVP 预留）

| 扩展点                | 触发时机       | 用途示例               |
| --------------------- | -------------- | ---------------------- |
| `on_calc_damage`      | 伤害计算后     | 特定功法增幅           |
| `on_calc_accuracy`    | 命中计算后     | 失明debuff影响命中     |
| `on_turn_order`       | 回合排序前     | 身法以外的加速效果     |
| `on_before_event`     | 任意事件入队前 | 触发器拦截/修改事件    |
| `on_attribute_change` | 属性变化后     | 功法联动效果           |
| `on_action_select`    | AI选招前       | 恐惧debuff限制招式选择 |
