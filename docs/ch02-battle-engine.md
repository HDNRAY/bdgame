# 第 2 章：战斗引擎

---

## 2.1 架构概览

战斗引擎是纯逻辑层（零外部依赖），由以下模块组成：

```
BattleEngine          — 状态机，驱动战斗循环
TurnManager           — 优先级队列调度（角色/召唤物/系统事件）
DistanceSystem        — 距离 0-6 档
effect-processor.ts   — EffectDef 分发表（运行时）
character.ts          — passiveEffectHandlers 分发表（构造期）
```

### 战斗流程

```
BattleEngine.runEvent(planFn)
  │
  ├─ 系统事件 → handleSystemEvent (buff到期/毒灼烧/过热)
  ├─ 召唤物    → handleSummonTurn (从 owner 武器获取召唤动作)
  └─ 角色      → planFn(self, enemy, state) → ActionCommand[]
                    ├─ bonus (before_main 辅招)
                    ├─ move (调整距离)
                    ├─ attack (主招)
                    └─ (after_main/on_hit 辅招由 #tryBonus 触发)
```

---

## 2.2 回合调度（TurnManager）

优先级队列（`entries: TurnEntry[]`），按 `nextActionAt` 升序排列。

```ts
type TurnEntryType = 'character' | 'system' | 'summon'
type SystemEventType = 'buff_end' | 'tick_poison' | 'tick_burn' | 'stun_reset' | 'permanent_burn'
```

**回合间隔公式：**

```
间隔 = (1200 + 600 + 700 + 额外前摇 + 额外硬直) × 2.8 / (1 + agi × 0.25)
```

- 基础间隔 1200ms + 基础前摇 600ms + 基础硬直 700ms
- 身法越高间隔越短：agi=10 → ~5460ms, agi=20 → ~3360ms, agi=30 → ~2420ms
- 招式可带 `extraPreDelay` / `extraStunTime` 修正

### 系统事件

| 事件             | 说明                                               |
| ---------------- | -------------------------------------------------- |
| `buff_end`       | stat_buff/stat_multiply/stat_transfer 到期自动恢复 |
| `tick_poison`    | 中毒周期性伤害                                     |
| `tick_burn`      | 灼烧周期性伤害                                     |
| `stun_reset`     | 眩晕连续递减追踪重置（5秒窗口）                    |
| `permanent_burn` | 过热——义体动力炉，间隔和伤害由 EFFECT_META 定义    |

---

## 2.3 战斗判定

### 2.3.1 命中判定

```ts
命中率 = clamp(0.8 + 攻击方灵巧 / 50 + 攻击方洞察 / 60 - 防御方身法 / 50 - 防御方洞察 / 60, 0.05, 0.95)
```

招式可设 `chance` 字段覆盖此公式（固定命中率）。

### 2.3.2 招架判定

武器带 `'parry'` tag 时可用：

```ts
招架率 = min(0.9, (身法 + 灵巧 + 洞察) / 120)
```

招架成功后按 `calcParriedDamage(damage, strength)` 减伤——力道越高减伤越多。

### 2.3.3 伤害计算

```
伤害 = Σ(缩放系数[属性] × 角色[属性]) × 暴击? 1.5 : 1
```

- scaling 由招式定义（如 `{ strength: 0.4 }`）
- 暴击率 = `0.05 + (灵巧 + 洞察) / 200`
- 固定伤害/自伤/百分比伤害不经过此公式

### 2.3.4 失心（Fumble）

`fumbleChance > 0` 时每次行动前判定：`random() < fumbleChance` → 晃神，跳过本行动。
来自义体神经惩罚。

---

## 2.4 效果系统（EffectDef）

所有效果由 discriminated union `EffectDef` 定义（`action.ts`），分两张表处理：

### 运行时效果表（effect-processor.ts）

| 类型             | 说明                                 |
| ---------------- | ------------------------------------ |
| `damage`         | 属性缩放伤害                         |
| `fixed_damage`   | 固定数值伤害                         |
| `self_damage`    | 自伤（%最大HP）                      |
| `heal`           | 回复（固定值 + %最大HP）             |
| `status`         | 中毒/灼烧/麻痹/眩晕/流血             |
| `stat_buff`      | 属性增减（可选时长）                 |
| `stat_multiply`  | 属性翻倍（有时长）                   |
| `stat_transfer`  | 从敌到己汲取属性（有时长）           |
| `restore_ap`     | 恢复 AP                              |
| `cleanse`        | 净化负面状态                         |
| `modify_turn`    | 修正对手回合时间                     |
| `interrupt`      | 打断（延迟 1000ms）                  |
| `knockback`      | 击退距离                             |
| `counter_damage` | 反击伤害                             |
| `summon_speed`   | 加速召唤物                           |
| `cripple`        | 崩劲（基于已损HP）                   |
| `permanent_burn` | 过热（占位，由 engine 系统事件处理） |

### 构造期效果表（character.ts passiveEffectHandlers）

| 类型                  | 说明                        |
| --------------------- | --------------------------- |
| `stat_buff`           | 属性增减（永久）            |
| `summon_damage_bonus` | 召唤物伤害加成（克隆武器）  |
| `max_ap_mod`          | 最大AP修正                  |
| `max_hp_mod`          | 最大HP修正                  |
| `move_efficiency`     | 移动效率倍率                |
| `fumble_chance`       | 失心率累加                  |
| `permanent_burn`      | 标记 permanentBurn modifier |

### EFFECT_META

所有效果类型在 `data/effects.ts` 注册元数据（label/desc/attrMods/tickInterval/damage），用于日志标签和持久伤害参数配置。

---

## 2.5 辅招时机（#tryBonus）

| 时机              | 触发点                                |
| ----------------- | ------------------------------------- |
| `before_main`     | 主招前（AI 决策阶段已选）             |
| `after_main`      | 主招执行完毕后（无论是否命中/AP不足） |
| `on_hit`          | 命中时                                |
| `on_take_damage`  | 受伤时                                |
| `before_turn_end` | 回合结束前                            |
| `turn_start`      | 回合开始时                            |

---

## 2.6 召唤物

武器可定义 `summon` 字段（`SummonDef`），战斗开始时创建对应数量的 `SummonInstance`。召唤物在 TurnManager 中有独立条目，按以下间隔循环行动：

```ts
间隔 = (基础间隔 + 前摇 + 硬直) × (0.6 + max(0, 0.4 - 悟性×0.01))
```

执行 owner 武器的召唤动作。

---

## 2.7 AI

`ai/index.ts` 的 `planEvent` 决策流程：

1. **选主招**：`pickMainAction` — 遍历招式列表（越靠前优先级越高），跳过 bonus/AP不足/距离不符/限次耗尽/自伤致死，返回第一个可用
2. **计算移动**：根据武器 `range` 与实际距离差计算所需 AP
3. **辅招**：`before_main` 辅招——buff 类检测 `pendingBuffs` 已有则跳过，AP 够主招+辅招才放
4. **移动**：推送 move 指令
5. **攻击**：推送 attack 指令

### 距离移动计算

```
每 AP 移动档位 = max(0.5, 身法/20)
```

受 `moveEfficiency`（义体加成）和 `minMoveCost`（凌波微步/forge 固定 2 档/AP）影响。
