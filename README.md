# 《单挑》— 肉鸽自走棋战斗引擎

> 代号《单挑》，一个 roguelite auto-battle 游戏的战斗引擎层。

## 快速上手

```bash
# 安装依赖
npm install

# 运行全部测试（51 个）
npm test

# 类型检查
npx tsc --noEmit -p tsconfig.app.json
```

## 脚本玩法

### `npm run demo [n]` — 满配对战模拟

两个满配（33 节点）角色单挑，展示完整战斗日志和伤害统计。

```bash
# 看一场完整战斗
npm run demo

# 跑 100 场统计胜率
npm run demo 100
```

输出包含：
- 角色最终属性（修炼基础值，不含装备/被动加成）
- 逐回合行动日志（移动/攻击/触发/状态/dot）
- 伤害统计（按角色/招式/dot/自伤/治疗分项）

### `npm run node-demo [n] [bg] [weapon]` — 节点探索+对战

模拟玩家从背景选择到节点探索再到对战的完整流程。

```bash
# 5 节点探索 + 100 场对战（默认）
npm run node-demo

# 指定节点数和背景/武器
npm run node-demo 10 0 0    # 10 节点，均衡，铁指环
npm run node-demo 33 1 2    # 33 节点，力士，铁枪
```

背景序号：`0=均衡 1=力士 2=刺客 3=玄门`
武器序号：依启动时列表为准

## 技术栈

TypeScript + Vite 6 + React 19 + Zustand 5（UI 层待建）

### 引擎架构

```
scripts/           CLI 对战模拟
  demo-battle.ts     固定角色满配对战
  node-demo.ts       节点探索+随机对手对战

src/engine/
  ai/                AI 决策
  calc/              纯函数（伤害/命中/暴击/回合间隔）
  combat/            战斗引擎（状态机/效果处理/日志/统计）
  data/              数据（背景/武器/招式/功法/奇物/对手）
    opponents/         角色定义（满配 targetAttrs）
  entities/          核心实体（角色/属性/招式/标签）
  systems/           系统（修炼/节点探索/对手生成）
```

### 核心概念

- **修炼点**：每节点 2 点，33 节点 = 66 点
- **cost 曲线**：≤13=1pt, 14~19=2pt, 20+=3pt
- **距离系统**：0~10 档
- **EffectDef**：25+ 效果类型的联合类型
- **LogEvent**：22+ 事件类型的日志系统
- **StatsTracker**：按角色/招式统计伤害和治疗
