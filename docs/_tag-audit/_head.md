# 全量 Tag 审计报告（武器 / 功法 / 招式 / 奇物）

> 只读审计，**未改动任何数据**。判定口径见 [`docs/_tag-audit/RUBRIC.md`](_tag-audit/RUBRIC.md)（本次唯一标准）。
> 明细分文件：`docs/_tag-audit/{weapons,passives-a,passives-b,actions-a,actions-b,artifacts}.md`。

## 一、审计范围

| 类别 | 数量 | 源文件 |
| --- | --- | --- |
| 武器 | 24 | `src/data/weapons/weapons.ts` |
| 起始武器 | 8 | `src/data/weapons/starting-weapons.ts` |
| 功法（被动） | 110 | `src/data/passives/passives.ts` |
| 招式（动作） | 155 | `src/data/actions/{melee,qi,unarmed,player,support,internal,index}.ts` |
| 奇物 | 76 | `src/data/artifacts.ts` |
| **合计** | **373** | |

## 二、tag 的实际影响面（决定每条问题的严重度）

| 级别 | 涉及 tag | 作用点 |
| --- | --- | --- |
| 改数值/可用性 | 招式的 `requiredTags` 交集、`move`、`summon`、`melee`/`range`/`unarmed`/`polearm`、`pre_action`/`post_action`、`imperial`、`stance`、`super_armor`、`parry` | `src/engine/combat/**`（`engine.ts`、`effects/handlers.ts`、`effects/damage.ts`、`utils/weapon.ts`、`buff-layer.ts`、`calc/action-executor.ts`） |
| 改抽卡/构筑相关性 | `inherent`（奖励池过滤）、`implant`/`imperial`（随机拾取过滤）、`tagRelevance` 权重分级（武器类型 4 / 流派 2 / 功能 0 / 其他 1） | `src/game/roguelite/reward-pool.ts`、`src/game/tagRelevance.ts`、`src/engine/combat/effects/handlers.ts` |
| 只影响展示 | 其余（含 `buff`） | Tooltip / Tag 徽章 / 构筑建议 |

> 结论先说：**`buff` 标错不改战斗数值**，但会污染"构筑相关性"权重与 UI 语义；`inherent` 与 `requiredTags` 标错则会**实际影响玩家能拿到/能用什么**，属于高危项。

## 三、tag 分级（`tagRelevance.ts`）

| 级别 | 权重 | tag |
| --- | --- | --- |
| 武器类型 | 4 | `unarmed` `slash` `blunt` `pierce` `polearm` `heavy` `melee` `range` `imperial` `thrown` |
| 流派 | 2 | `qi` `electric` `frost` `poison` `bleed` `burn` `summon` |
| 功能 | 0 | `move` `pre_action` `post_action` `chan` `heal` |
| 其他 | 1 | 其余全部 |

## 四、本次重点口径：`buff` 到底怎么算

- **算**：该实体真的给**角色**施加了增益状态（属性/状态提升、叠层增益本身带来数值收益、持续回复、护体…）。
- **不算**：只是**用 buff 机制做实现或标记** —— 内部计数器、状态旗标、条件载体、纯流程/视觉标记。判断依据是去 `src/data/buffs/` 看它引用的 buff 的 `effects` 是否给角色带来**数值或能力上的正收益**。

---

（以下为分类明细汇总）
