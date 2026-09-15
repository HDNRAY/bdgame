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


---

# 执行摘要

## 一、判定统计（373 个实体）

| 类别 | 数量 | ❌ 错标 | ⚠️ 存疑 | ✅ 合理 |
| --- | --- | --- | --- | --- |
| 武器（+8 起始） | 32 | 0 ※ | 21 | 11 |
| 功法 · 上半 | 55 | 1 ※ | 42 | 12 |
| 功法 · 下半 | 55 | 6 | 34 | 15 |
| 招式 · 近战/炁/空手 | 56 | 2 ※ | 40 | 14 |
| 招式 · 玩家/支援/内部 | 99 | **19** | 39 | 41 |
| 奇物 | 76 | 6 | 46 | 24 |
| **合计** | **373** | **34** | **222** | **117** |

※ 标记者是**主 agent 复核后下调**的条目：武器原报 ❌2、功法上半原报 ❌3、招式 A 原报 ❌3，其中 5 条经复核不成立（理由见文末「校订记录」）。
下文 ❌ 条目的代码依据由各子任务给出（附行号）；主 agent 复核了其中的高危项，未逐条复算。

## 二、跨类别的高危问题（按建议修复顺序）

1. **内部招式进奖励池（已验证，已修）**
   `internal.ts` 共 38 条；池层原先直接吃 `allMainActions`，**不按 `internal` 过滤、也不认 `_` 前缀**，于是实现型招式会作为「学招式」奖励发给玩家，学了永远不生效 —— **死奖励**（受害最明显的是 `_orb_shot` / `_huan_shot` / `_silk_shot` / `_fei_jian_shot` / `_fen_shen_shot`，连 `trigger` 都没有）。
   **修法（见 §八.2 与 §十二）**：池层两道闸 —— `internal` 标签 + `_` 前缀。但 `internal` **还会把招式剔出 AI 主招候选**，所以「AI 要用、玩家不该学」的招式只能用 `_` 前缀。招式池 155 → 118。

2. **`inherent` 双向错（已验证，直接影响抽卡）**
   `reward-pool.ts:97` 按奇物自身 `inherent` 过滤随机池，于是：
   - 误标：`乌铠`(iron_will)、`冰蚕衣`(frost_silk_robe)、`斗铠`(combat_armor) 三件通用防具被**永久挡在随机池外**（玩家永远抽不到）；
   - 漏标：`人造发声器`(sonic_generator) 是唯一不带 `inherent` 的义体（其余 14 件义体全带），会进随机池。
   功法侧同类风险见「需裁定」区（`tai_shang_yu_fa` 未标 vs `ling_long_xin_qiao` 永久排除）。

3. **`buff` 语义漂移 —— 正是你说的"实现/标记当增益"**
   - 集中在**功法**：下半 6 条为假 `buff`（`yi_ma_xin_yuan`、`tongtian`、`chou_dao_duan_shui` 引用的 buff 自身零收益，实际只给对手上负面；`tai_shang_yu_fa` 实为回血；`ling_ao_bu` 实为冲撞触发招；`qi_electric_conversion` 无电系效果却标 `electric`）；上半 6 条把 buff 当实现手段（`nei_xi_mian_chang` 只放大已有 buff 时长、`wan_xiang_jian_yi` 纯计数载体、`shenxing_baibian` 引用的 buff 无数值钩子、`yue_nv_sword` 的 buff 触发器已被注释…）。
   - 招式侧方向反标：`electric_yoyo`、`flash`、`bi_hai_chao_sheng_qu`、`shi_qi`、`yi_dian_han_mang` 把「给对手上异常」标成 `buff`。
   - 对照：**奇物侧零假阳性**（24 条 `buff` 全部是真增益），招式 A 组 8 处 `add_buff` 也全部核对通过。
   - 现状：功法 86/110 带 `buff`（78%），明显偏高。

4. **元素/状态漏标 → 流派权重（权重 2）拿不到**
   `frost`（`frost_mastery`、`blowing_snow_sword`）、`burn`（`zhu_huo_jue`）、`paralyze`（`thunder_art`、`yu_xiao_jian_fa`）、`bleed`（`momentum_mastery`）；控制类漏标 12 处（`stun`/`paralyze`/`knockdown`/`knockback`）。

5. **武器类型 tag（权重 4）缺失/误标**
   - 招式系统性缺 `melee`（约 20 条）：`engine.ts:827` 用**招式自身**的 `tags.includes('melee')` 决定是否发 `on_melee` → 这些招被近身命中不触发；
   - `polearm` 误标在刀剑/飞剑上（`玄铁重剑`、`素铁霸刀`、`黑云剑`）→ 会触发 `on_polearm`；
   - `unarmed` 误标（`fissure` 是棍招、`dagger` 等）→ 污染空手流关联；
   - `slash` 误标（`three_section_spear`）。

6. **起始武器进了随机池（已验证）**
   `reward-pool.ts:112`：`[...WEAPON_DB, ...STARTING_WEAPONS].filter(w => !w.tags.includes('imperial'))` —— 8 把起始武器（含 `bare_hands`）都会进随机池，与 `starting-weapons.ts:8` 的「不进奖励池」注释矛盾。

7. **其它成体系的口径不一致**（详见各分类明细）
   - `pre_action`/`post_action`：已复核无问题 —— `feng_fan` 双标不会重复释放（blacklist + 位移招不走 support 通道），`wind_hear`/`_resheath` 的 `post_action` 正确（见裁定 F）；
   - `chan`：8 条有 `chanCost` 却无 `chan` 标签（`gear_hang` 等），`wind_hear` 反之；
   - `damage`：招式文件里几乎不用该 tag（只 buff/功法在用），造成 3 处语义漂移；
   - `passive` 标签系统性缺失（功法上半 42/55）；
   - `qi` 泛标（放大了与炁无关条目的权重）。

8. **`requiredTags` 体系本身是自洽的**：99 条招式的 requiredTags 并集全部命中武器 tag 并集，无孤立项；两份子任务里"武器缺 tag 就永远拿不到招"的 ❌ 经复核**不成立**（判定是 `.some()`，见校订记录 3）。

## 三、需要你裁定的口径（影响后续批量修法）

1. `debuff` ＝「只给对手」还是「任何弱化」？（决定 `独臂`/`momentum_mastery` 是否错标）
2. `buff` 的施加层级：只算"给角色加状态"，还是"给对手上负面"也算？
3. `inherent` 的边界：哪些功法/奇物该永久排除出随机池（`tai_shang_yu_fa`、`ling_long_xin_qiao`、三件通用防具、义体是否统一补 `inherent`）。
4. 奇物/武器是否该用 `damage` 这个 tag（现在 76 件奇物、32 把武器无一标）。
5. `chan`、`move`、`trigger`、`thrown` 在功法里 0 处使用，是否属约定省略。
6. `pre_action`/`post_action` 的精确语义与互斥规则。

（各项的代码证据与具体条目，见每个分类明细末尾的「需裁定」区。）

---

## 校订记录（主 agent 复核）

## 四、你的裁定（2026-09，已确认；tag 变更留待批量执行）

| # | 问题 | 裁定 | 待办（尚未动 tag） |
| --- | --- | --- | --- |
| 1 | `low_hp` 口径冲突（血祭护腕） | **现状没问题** | 不改 |
| 5 | `craft` 口径 | **craft = 锻造物，不一定是天工出品** | 保留 5 件现状；但 `tag.ts:57` 注释仍写「天工出品」，与口径不符，建议改为「锻造物/人造装备」 |
| 7 | `sonic_generator` 归属 | **应该是义体** | 应改为 `implant`（+ `inherent`）、去掉 `craft` |
| 8 | `qi` 的边界 | **qi 就是炁，与内息无关**（参考 凝炁诀 / 凝炁玉） | 便携式核动力炉、蓄炁瓶（内息回复）**不补** `qi`；九阴真经、聚缠法衣（缠劲）的 `qi` **应去掉** |
| 9 | `imperial` 边界（浮游眼） | **现状没问题** | 不改 |
| 11 | `trigger` 口径 | **倾向直接移除该标签** | 记录为待办（13 件奇物 + 其它实体在用） |
| 12 | 描述与实现不一致 | **现在就改描述** | ✅ 已改（见下） |
| 2 / 3 / 4 / 6 / 10 | 义体补 `buff`、奇物补 `damage`、`dot` 死标签、`inherent` 边界、奇物 `stance` | **按报告结论执行** | 义体统一补 `buff`；6 件增伤奇物补 `damage`；`dot` 不再使用；乌铠/冰蚕衣/斗铠 去掉 `inherent`（通用防具应进池）；虎彻之眼/定心香氛补 `stance` |

### 已执行的描述修正（本轮唯一动过的数据，共 5 处）

| 位置 | 原 | 现 | 依据 |
| --- | --- | --- | --- |
| `artifacts.ts` 乌铠 | 消耗 **1AP** 减少 4 点、门槛「超过5点」 | 消耗 **1缠劲** 减免 4 点，每场最多 20 次、门槛「超过4点」 | `buffs/defense.ts:28` `dmg_reduce`：`final<=4` 直接返回、`spendChan(1)`、`uses>=20` |
| `artifacts.ts` 青竹斗笠 | 距离 **≥5**、额外 **+15%** | 距离 **≥4米**、额外 **+20%** | `buffs/defense.ts:115` `ranged_dodge`：`dist>=4 → 0.2` |
| `artifacts.ts` 软猬甲 | 减免所有伤害；**反伤**并令对手流血 | 受伤减免 1 点；令对手流血 | `buffs/defense.ts:307` `soft_armor`：`(final-1)`，只叠 `bleed`，无反伤 |
| `buffs/defense.ts` 软猬甲 buff 描述 | 同上（含「反伤」） | 同上 | 同上 |
| `artifacts.ts` 女儿红 | 持续 **5秒** | 持续 **9秒** | `buffs/defense.ts:467` `nv_er_hong`：`expiry.ms = 9000` |

### 追加裁定（2026-09，第二轮）

| 问题 | 裁定 | 待办 |
| --- | --- | --- |
| `debuff` 是否只对对手 | **不是，对自己也算**（弱化即标） | `独臂`/`momentum_mastery` 的 `debuff` 判为正确；RUBRIC 已同步修正 |
| 三把重型刀剑的 `heavy`/`polearm` | **玄铁重剑、素铁霸刀、绣冬 只是 `heavy`，不是 `polearm`** | 玄铁重剑/素铁霸刀：去掉 `polearm`、补 `melee`；绣冬现状已正确（`melee`+`heavy`）。另：`引擎铁锤` 目前有 `polearm` 却无 `heavy`，待确认是否同属重型武器 |
| 四个 `on_*` 事件（melee/range/unarmed/polearm）| **确认无消费方，考虑删除** | 见校订记录 5；删除后 `melee` 等 tag 只剩「权重档 + requiredTags」两个消费点 |
| `melee` 口径 | **采用 (a)：`melee` = 短兵（刀剑匕首），与 `polearm`/`unarmed` 并列互斥** | 玄铁重剑、素铁霸刀：去掉 `polearm`、补 `melee`；`引擎铁锤` 有 `polearm` 无 `heavy`，待定 |

## 五、`thrown`（暗器）现状与建议

**结论：不需要给 `赤手空拳` 加 `thrown`。** 三条依据：

1. **暗器招式本来就不设武器门槛**：`actions/player.ts` 里的暗器招式（`flick` 弹指、《银针》等）`requiredTags: []` → 空手或任何武器都能用，不存在"空手用不了暗器"的问题；
2. **`thrown` 的战斗消费点在招式侧**：`src/data/buffs/buffs.ts:187/254/259/289` 都是判断「来源**招式**是否带 `thrown`」来给命中率/额外伤害，从不读武器；
3. **玩家 tag 集合是推导出来的**：`engine.ts:515` `_derivePlayerTags()` = 已获得奖励的 tags ∪ 已装备武器的 tags → 只要**暗器招式和暗器功法**带 `thrown`，暗器流的权重自然成立，武器不必背这个 tag。

**真正该补的是暗器类功法**（现在 110 个功法里 `thrown` 出现 **0 次**）：`漫天花雨`(fei_hua_shou)、`练打秘诀`(lian_da_mi_jue)、`例无虚发`(li_wu_xu_fa)。

**三种表达方式（待你选）**

| 方案 | 做法 | 效果 |
| --- | --- | --- |
| 1（推荐） | 不动武器；暗器**招式/功法**统一带 `unarmed` + `thrown` | 空手(权重4) 与暗器(权重4) 两档都能吃到 |
| 2 | 以后真出「暗器囊 / 投掷武器」，把 `thrown` 落到那件武器上 | 暗器成为独立武器系；目前无此武器，`thrown` 事实上是招式侧标签 |
| 3 | 把 `thrown` 从 `tagRelevance` 的 weaponType(4) 挪到 school(2) | 暗器流与"雷/毒"同档，而不是与"剑/刀"同档 |

## 六、待裁定的口径清单（去重后 10 组，附我的建议）

> 各分类明细末尾的 45 条「需裁定」按主题合并如下。多数同源：**同一语义在不同实体上口径不一致**。

| # | 主题 | 现状矛盾 | 我的建议 |
| --- | --- | --- | --- |
| A | **`buff` 判到哪一层**（4 份报告都问） | `gear_shift`（增益由所授招式产生）、`nei_xi_mian_chang`（只放大已有 buff 时长）、`combat_instinct`（只有 `trigger_slot_mod`）、`extreme`（缠满条件增益）、`yuxin_sword_mastery`（叠层上限翻倍）算不算；武器 27/32、义体 14 件有真增益却全不标 | 口径定为「**本条 effects/triggers 直接给角色施加增益状态**」；间接收益、条件载体不标。是否统一给武器/义体/奇物补 `buff` 请一并定 |
| B | **`qi` 的宽窄** | 严格派：`铁布衫`/`万象剑意`/`越女剑法` 无炁机制却标；宽松派：描述写"以炁驱动/激活"的 8 把武器反而未标（`iron_back_hand`/`dinghai_shen_tie`/`ganjiang`…），`三节枪`、`_sonic_wave` 存疑 | 严格口径（**有炁资源/炁伤/以炁驱动才标**）。注意：武器补 `qi` 会**实际改数值**（`qi_amplify`、`斗铠`），需谨慎 |
| C | **`heavy` 的语义** | `tag.ts:29` 写「巨型双手」，但长枪/单手剑（绣冬）/飞剑都带 | 定为「**重器（力道驱动）**」，可叠加在长柄上；不与 `polearm` 互斥 |
| D | **`damage` 的口径与覆盖面** | 招式 56+99 里几乎不用（仅 2 处）、奇物 0 处、功法 14 条漏标 | 定为「**显著提升输出/破防/暴击**」，按此补齐；否则明确该 tag 只用于 buff |
| E | **`move` / `chan` / `self_damage` / `ignore_parry` 的粒度** | 带 `short_dash` 的攻击招多数未标 `move`；8 条有 `chanCost` 无 `chan`，`wind_hear` 反之；用 `self_hp_cost` 的不算 `self_damage`；穿透算不算 `ignore_parry` | 分别定为：有位移即 `move`；涉及缠劲（消耗或回复）即 `chan`；卖血即 `self_damage`；只有真"无视招架"才 `ignore_parry` |
| F | **`pre_action` / `post_action` 的边界与互斥** | 原判：`feng_fan` 同带两者会重复释放；`wind_hear`/`_resheath` 该蓄势却标 `post_action` | **已核实不成立**：`ai/index.ts:151` 把前摇指令 id 作为 blacklist 传给收招阶段（`support-planner.ts:24`），位移招又不分阶段地跳过 support 通道（:41）；`post_action` 对「收招补架势」类的判定正确。无需改动 |
| G | **`inherent` 的边界（剩余）** | `tai_shang_yu_fa`（玄门祖传）未标；`ling_long_xin_qiao` 仅数值增益却被永久排除；只在特定对手处授予的 `zui_quan`；以及"对手专属装备是否一律不进池" | 定为「**血脉/传承特性、不应被随机获取**」，逐条按"能否被抽到"判定 |
| H | **武器上的 `unarmed` / 多攻击类型** | 匕首/忍者刀/鹤山剑带 `unarmed`（握兵器也能吃拳脚招）；玄铁重剑同时带 `blunt`+`slash`+`pierce` | 去掉"握兵器还能用拳脚招"的 `unarmed`；多攻击类型（重剑）保留 |
| I | **形态 tag 在功法上的使用** | 110 个功法 `thrown`/`move`/`range`/`melee` 合计 0 处；`bai_ju_guo_xi`（3 米内）、`hearing_power`（徒手）属明显形态 | 给"形态明确"的功法补形态 tag（参与权重即可） |
| J | **招式池的两处泄漏** | `tempest`（唐柔专属奇物招式）无 `internal`/`inherent` 会进池；15 条 `internal.ts` 招式未挡池 | 池层两道闸（`internal` + `_` 前缀）；「AI 要用」的招式用 `_` 前缀而非 `internal`；`tempest` 按裁定保留在池内 |

另有**一批描述与机制不符**（`thunder_storm` 写麻痹实为眩晕、`hearing_power` 写徒手实为任意命中、`ru_lai_shen_zhang` 形态、`soft_armor` 等已改）—— 建议单独出一轮文案同步清单。

## 七、第二轮裁定（A–J）

| # | 你的裁定 | 待办 |
| --- | --- | --- |
| **A** | **能叠层的一般都算 `buff`；叠层上限翻倍也算** | 据此**撤销** passives-a 里大部分"多标 buff"判定（只放大时长/计数载体只要给角色带来数值或能力收益即保留）；仅"引用的 buff 自身零收益"（给对手上负面、纯回血、纯触发）仍不算 buff |
| **B** | **`qi` 只有真的有炁机制的才算**；炁系伤害一般表现为穿透或增加距离（设计备注） | 去掉 `铁布衫`/`万象剑意`/`越女剑法` 等的 `qi`；描述写"以炁驱动"的 8 把武器补 `qi`（⚠️ 会真改数值，需单独确认） |
| **C** | **`heavy` = 重型武器，不是"巨型双手"** | 更新 `tag.ts:29` 注释 |
| **D** | 待你定（建议见报告） | 推荐**删掉 `damage`**，`support-planner.ts:79` 改为只看 `buff` |
| **E** | **short_dash 不算 `move`**；`chanCost` 与 `chan` 必须一致；**穿透不算 `ignore_parry`** | `wind_hear` 去掉 `chan`；8 条有 `chanCost` 的补 `chan`；穿透类不标 `ignore_parry` |
| **F** | 同带 `pre_action`+`post_action` = 招前招后都能放，但**不应释放两次** | **已核实：不会重复**。前摇选完后其 id 作为 blacklist 传入收招阶段（`ai/index.ts:151`、`support-planner.ts:24`）；`feng_fan` 是纯位移招，本就走 `planMove`（`support-planner.ts:41` 跳过位移招，与阶段无关）。无需改动 |
| **G** | **功法上的 `inherent` 只表示"不进普池"**（原意是"飞龙探云手能否被偷"，该机制已移除） | 按"是否应进普池"逐条判 |
| **H** | 武器带 `unarmed` **没问题**（持匕首时本就能同时用拳脚）；**`阿赖耶识` 的 `unarmed` 去掉** | 白山"同时释放拳脚招式"改用别的方式 → 记录，后续讨论 |
| **I** | `thrown`/`range`/`melee` 该标就标；**`move` 只有「凤舞九天」该标** | 按此批量 |
| **J** | **`tempest` 可以进池**（不改）；**`internal.ts` 里的都要挡住奖励池** | 修法已修正（见 §十二）：**不补 `internal` 标签**，改用 `_` 下划线前缀 —— `internal` 会让招式退出 AI 主招候选（`ai/index.ts:76-80`），一刀/德克会因此崩盘；本次只需给 `iaijutsu_strike`、`resheath` 改名（`_iaijutsu_strike`、`_resheath`），其余 11 条本就带 `_` 前缀 |

### D 的现状依据

`damage` 作为 tag 全项目**只有一个消费方**：`src/engine/ai/support-planner.ts:79`「招式 tags 含 `damage` **或** `buff` → 前置动作优先级 50」。其余 grep 命中均为 *effect type* `'damage'`，与 tag 无关。`tagRelevance` 中它是权重 1 的未分类 tag。

## 八、执行记录（D 落地 + 池层修复）

### 1. `damage` tag 已彻底删除（2026-09 执行）

| 位置 | 改动 |
| --- | --- |
| `src/engine/entities/tag.ts` | 删除 `\| 'damage'` 成员与一条陈旧注释 |
| `src/bridge/tagDisplay.ts` | 删除 `TAG_CN`/`TAG_COLOR` 的 `damage` 条目 |
| `src/engine/ai/support-planner.ts:79` | 改为 `if (tags.includes('buff')) return 50` |
| 数据层 5 个文件 | 36 处 `tags: [...]` 数组移除 `'damage'`（`passives.ts` 6、`buffs/damage.ts` 24、`buffs/weapon.ts` 3、`buffs/buffs.ts` 1、`actions/player.ts` 2） |
| `AGENTS.md` | Tag 数量 36 → 55（原数字早已过期） |

> 注：第一次批量替换误把**效果类型** `type: 'damage'` 一起删了，已 `git checkout` 回滚相关文件后改用「只处理 `tags: [...]` 数组」的精确替换；最终 `tsc` / `eslint` / 422 测试 / `vite build` 全过。

### 2. 池层修复（在改 tag 之前先做）

`src/game/roguelite/reward-pool.ts` `_getActionPool()` 现在排除两类招式：

```ts
allMainActions.filter((a) => !a.tags.includes('internal') && !a.id.startsWith('_'))
```
- 动作池由 155 → **120** 条；
- `_arm_explosion` 不必标 `internal`（AI 仍可经 conditionId 出手），也不会进「学招式」池；
- `tempest` 保留在池内（按裁定「可以进池」）。

### 3. 剩余

- 实现型招式已全部挡住奖励池（§十二：`internal` 标签 + `_` 前缀两道闸）；
- `dot` 是全库无人使用的死标签，是否一并清理待定。

### 4. `dot` 已删除（同上流程）

`dot` 全库**零数据使用**（`stats-tracker.ts` 里的 `'dot'` 是默认动作名字符串，与 tag 无关）。删除 `tag.ts:41` 成员与 `tagDisplay.ts` 两条映射；Tag 总数 55 → **54**，`AGENTS.md` 同步。

## 九、tag 整理执行计划（按影响面排序）

从 6 份明细的「建议」列汇总：**约 290 处待改**；其中「补 `damage`」25 处随标签下架作废，「去 `debuff`」2 处按口径（对自己也算）作废。

| 批次 | 内容 | 处数 | 依据 | 风险 |
| --- | --- | --- | --- | --- |
| **P0 高危**（改玩家能拿到/能用什么） | ① `internal` 补齐（J）；② `inherent` 双向修正：去 3（乌铠/冰蚕衣/斗铠）、补 3、`ling_long_xin_qiao` 复议；③ 起始武器进池问题（改注释 or 补 `inherent`） | ~20 | J / G | 高（直接影响抽卡与可用性） |
| **P1 口径统一**（按 A–J） | ① `qi` 严格化：去 10、补 15（武器补 `qi` 会改数值，需单独确认）；② `chan` 一致：补 2、去 1，另 8 条有 `chanCost` 无 `chan`；③ `move`：去掉 short_dash 类、只留凤舞九天；④ 形态 tag：`thrown`/`range`/`melee` 该标就标（补 39、去 6）；⑤ `heavy` 注释更正；⑥ 阿赖耶识去 `unarmed` | ~80 | B/C/E/H/I | 中（`qi` 会影响数值） |
| **P2 补齐一致性** | ① `buff`：按 A 口径保留叠层类（撤销大部分"去 buff"）、补齐 54 处（含 14 件义体、27 把武器 —— 需先定"是否统一补"）；② `defense` 12 / `counter` 3 / `heal` 5 / `debuff` 12 / 元素状态 34 / `ignore_parry` 6 / `stance` 3 / `self_damage` 2；③ `passive` 统一（功法 42 条缺失）；④ `trigger` 移除（13 件） | ~180 | A / 各报告结论 | 低（多为展示与权重） |
| **P3 文案同步** | 描述与机制不符的一批（`thunder_storm` 写麻痹实为眩晕、`hearing_power` 写徒手实为任意命中、`ru_lai_shen_zhang` 形态等） | 待清点 | 明细分报告 | 低 |

**开始前需要你定的三件事**：
1. **武器 / 义体是否统一补 `buff`**（27 把武器、14 件义体都有真实数值增益，现状一个不标）；
2. **起始武器**：是"不进池"（那就补 `inherent`）还是"进池没问题"（那就改 `starting-weapons.ts:8` 的注释）；
3. **`qi` 补到武器上会真改数值**（`qi_amplify`、`斗铠`），是只补描述里明确"以炁驱动"的那几把，还是全部严格按描述补。

## 十、第三轮澄清（2026-09，含立即执行项）

### 1. `buff` 的最终口径（收窄）
**只有"施加了状态"才算 `buff`** —— 可叠层、有持续、有条件、触发型的状态；**纯粹的属性数值加成（`stat_buff` / `attrMods` 型）不算**。
例：`惊鸿` 的 `stat_buff {敏捷+1、灵巧+2、力道+1}`、`千机` 的 `qianji_crit`（暴击伤害+30%）都**不属于** `buff`。

连带影响：
- **义体 14 件不补 `buff`**（它们全是 `stat_buff` 直接属性加成）；
- 武器侧同理，只有"触发/叠层状态"类的才算，纯属性加成的不算；
- P2 的「补 `buff` 54 处」大幅缩水，需要逐条按"是状态还是直接属性"筛。
- 另注：**buff 定义自身**（`src/data/buffs/*.ts` 里的 `BuffDef.tags`）是引擎侧的分类标记（如 `buff-layer.ts` 读 `stance`），与实体 tag 不是同一层，不受本条影响。

### 2. 起始武器不进随机池 —— 已执行
`reward-pool._getWeaponPool()` 改为**只读 `WEAPON_DB`**，不再合并 `starting-weapons.ts`：

```ts
this._weaponPool = WEAPON_DB.filter((w) => !w.tags.includes('imperial'))
```
- 武器池 32 → **23** 把，零起始武器（`bare_hands`/`peach_sword`/`qimei_staff`/`long_spear`/`dagger` 均不在池内）；
- 御物仍按原规则排除；
- `starting-weapons.ts:8` 的"不进奖励池"注释现在与代码一致；
- `reward-pool.test.ts` 里断言相反行为的旧用例已改写（并补上"不含起始武器/御物"的断言）；
- `_derivePlayerTags()` 仍然会查 `[...WEAPON_DB, ...STARTING_WEAPONS]`（那是为了识别**已装备**的意图，必须保留）。

### 3. `qi` 的最终口径
**`qi` = 有炁的「外放」**（炁劲、炁弹、炁刃、炁盾等对外的炁）；**"以炁驱动"不算** —— 能源/驱动方式不是炁的对外释放。

连带影响：
- 描述写"以炁驱动/激活/供能"的那 8 把武器**一律不补** `qi`；
- P1 的 `qi` 子批变成：**只做"去"**（去掉 10 处无炁外放的泛标），"补"的 15 处逐条按"有没有炁外放"重筛。

## 十一、P0 执行结果（2026-09）

| 项 | 改动 | 结果 |
| --- | --- | --- |
| ~~`internal` 补齐（J）~~ **已回退** | 曾给 13 条补 `internal`（`iaijutsu_strike`、`resheath`、`_orb_shot`、`_huan_shot`、`_silk_shot`、`_fei_jian_shot`、`_fen_shen_shot`、`_flying_lion_roar`、`_golden_bell_swing`、`_eat_beans`、`_chuan_yun`、`_luo_yue`、`_sonic_wave`），导致德克 48.9%→31.4%、一刀 55.8%→16.9% | 已 `git checkout` 回退；改为 `_` 前缀方案，见 §十二 |
| `inherent` 去（通用防具） | `iron_will`（乌铠）、`frost_silk_robe`（冰蚕衣）、`combat_armor`（斗铠）去掉 `inherent` | 三件现在**进**奇物池 |
| `sonic_generator`（人造发声器） | `['craft','qi','implant']` → `['implant','inherent']` | 按裁定「应该是义体」；现在**不进**池 |
| `ling_long_xin_qiao`（玲珑心窍） | 去掉 `inherent` | 按裁定**进**池 |
| 暴雨梨花钉（奇物 id=`tempest`） | `['inherent']` → `['thrown']` | 按裁定**进**池，且带 `thrown`（暗器） |
| 阿赖耶识 `unarmed` | **不改**（裁定更正：持械同时用拳脚没问题，阿赖耶识也一样） | 与 H 的初版裁定相反，以本轮为准 |
| 风切 / 匕首 的 `unarmed` | **无需改** —— `风切` 现有 tags 已含 `unarmed`（`slash/pierce/parry/melee/unarmed/one_handed`），匕首同理 | 与「匕首、风切都应该有 unarmed」一致 |

奇物池：76 → **51**（25 件 inherent 排除，加回乌铠/冰蚕衣/斗铠/玲珑心窍* 等）；`*` 玲珑心窍属功法池。

> 过程记录：`internal` 补标第一次用正则批量替换时，因"边遍历边改字符串"导致偏移错乱写坏了文件，已 `git checkout` 回滚并改为逐行定位重做（diff 13 增 13 删，tsc/eslint/422 测试全过）。**该批补标随后因胜率回归被整体回退，见 §十二。**
## 十二、第四轮修正（`internal` 回退 → 下划线前缀，2026-09）

### 1. 口径：两个挡池手段不等价

| 手段 | 挡奖励池 | 挡 AI 主招候选 |
| --- | --- | --- |
| `internal` 标签 | 是（`reward-pool.ts` `_getActionPool`） | **是**（`ai/index.ts:76-80` 直接 `continue`） |
| `_` 前缀 | 是（同一个 filter） | 否（全库只有 `reward-pool.ts` 读它） |

`_` 前缀全仓库只有一个消费方（`_getActionPool`），AI、引擎、UI 都不读；`internal` 则同时服务池过滤与 AI 剔除。因此适用面是：

- **AI/对手要用、玩家不该从「学招式」拿到的** → `_` 前缀，**不标 `internal`**；
- **AI 与玩家都不该主动用的纯触发实现招** → 保持 `internal`（现存 23 条全部同时带 `_` 前缀，`internal` 在池层是冗余的，它实际承担的是 AI 剔除）。

### 2. 回归与回退

按旧裁定给 `internal.ts` 13 条补 `internal` 后，同一套 `simulateWinRate`（等级 33，对 `xiaohua/laifeng/layue/hongti/daixuan/junshi`，N=60）：

| 对手 | 基线 | 补 `internal` 后 | 回退后 |
| --- | --- | --- | --- |
| 博士·德克 | 48.9% | 31.4% | 48.6% |
| 一刀 | 55.8% | 16.9% | 55.6% |

根因：一刀的主招 `iaijutsu_strike`、`post_action` 辅招 `resheath`，与德克召唤物的 `_sonic_wave`（人造发生器 `on_parried` 触发）都在 AI 主招循环里取用，补 `internal` 等于把它们从候选里删掉。**已整体 `git checkout` 回退**。

### 3. 本次实际改动

| 位置 | 改动 |
| --- | --- |
| `src/data/actions/internal.ts` | `iaijutsu_strike` → `_iaijutsu_strike`；`resheath` → `_resheath`（只改 id，名字/tags/数值不动） |
| `src/data/passives/passives.ts:82` | `grantsActions` 同步为 `['_iaijutsu_strike', '_resheath']` |
| `src/data/opponents/yidao.ts:29` | `actionId` 同步为 `_resheath` |
| `src/engine/__tests__/reward-pool.test.ts` | 新增断言：action 池不含 `_` 前缀、不含 `internal` 标签；并点名 `_iaijutsu_strike`/`_resheath` 不在池内 |

- 招式池 155 → **118**（其余 11 条「漏标」本就带 `_` 前缀，池层早已挡住，不必再动）；
- `tempest` 按裁定 J 保留在池内，不动；
- 未改：`_resheath` 的 `post_action`（裁定 F 已复核：收招定位正确，不改）、`_sonic_wave` 的 `qi`（P1）；
- 复测：博士·德克 48.6%、一刀 55.6%，与基线一致（`_` 前缀对战斗零影响）。

## 十三、P1 执行结果（2026-09）

按裁定 B/C/E/I 与第三轮澄清执行：**49 处 tag 改动**（6 个数据文件）+ `tag.ts` 注释 + `weapon_stance` 两处判定。

### 1. `qi` 去标（14 处，只去不补）

口径 = 「炁的外放」；「以炁驱动」一律不补（核动力炉/蓄炁瓶/炁电转换/描述写"以炁驱动"的 8 把武器）。

| 范围 | 条目 |
| --- | --- |
| 功法 11 | `iron_bone`（铁布衫）、`wan_xiang_jian_yi`（万象剑意）、`yuxin_sword_mastery`（真假无用）、`tongtian`（通天录）、`no_parry_style`（流风回雪）、`yun_long_san_xian`（云龙三现）、`bai_ju_guo_xi`（白驹过隙）、`chou_dao_duan_shui`（抽刀断水）、`ru_shen_zuo_zhao`（入神坐照）、`chan_xin_hui_yan`（禅心慧眼）、`iaijutsu_mastery`（居合道，拔刀术无炁） |
| 奇物 2 | `jiu_yin_zhen_jing`（九阴真经）、`ju_chan_fa_yi`（聚缠法衣）——都是缠劲体系，保留 `chan` |
| 招式 1 | `_sonic_wave`（音波，人造发生器） |

### 2. `chan` 与缠劲机制对齐（5 处）

`chan` 全库**零代码消费方**（无 `includes('chan')`），且 `tagRelevance` 里它权重 0 → 纯展示/无战斗影响。核对口径 = 招式 `chanCost` + 所施 buff 是否 `spendChan`/`chanRegen`：

- 去：`wind_hear`（听风式：无 `chanCost`，`wind_hear_buff` 不回缠）；
- 补：`nineteen_stops`、`hun_yuan_gong`、`qian_kun_da_nuo_yi`（三条 buff 均 `spendChan`）、`iron_will`（乌铠 `dmg_reduce` `spendChan(1)`）；
- 复核：审计说的「8 条有 `chanCost` 无 `chan`」（`gear_hang`/`big_leap`/`lightning_speed`/`jindou`/`santou_liubi`/`chanzi_heal`/`chanzi_stance`/`deng_ping_du_shui`）**当前全部已带 `chan`**，无需处理。

### 3. `move` 粒度（2 处）

- 去：`_iaijutsu_strike`（居合斩只有 `short_dash` → 裁定 E「short_dash 不算 move」）；
- 补：`feng_wu_jiu_tian`（凤舞九天，功法侧唯一该标 `move` 者 → 裁定 I）；
- 其余「补 `move`」建议（`retrieve_blade`/越女剑法/踏雪/神行百变/醉拳/灵鳌步/残影步/奇门八卦/轮舞月斩/天外飞仙/液压腿）按裁定 I 一律不做。

### 4. 形态 tag（27 处）

| 子项 | 改动 |
| --- | --- |
| 补 `melee`·招式 20 | 刀剑刺斩 14：`cun_mang`、`nine_deaths_strike`、`pursuit_thrust`、`thrust`、`light_slash`、`heavy_slash`、`gash`、`spinning_slash`、`cyclone_slash`、`qi_slash`、`blaze_strike`、`horizontal_slash`、`rising_slash`、`follow_the_current`；拳脚 6：`push_palm`、`dian_xue`、`hand_blade`、`iron_charge`、`eighteen_palms`、`three_inch_light` |
| 补 `melee`·武器 2 | `overlord_blade`（素铁霸刀）、`dark_iron_sword`（玄铁重剑） |
| 去 `polearm`·武器 3 | `overlord_blade`、`dark_iron_sword`、`fei_jian`（黑云剑是飞剑，非长柄） |
| 去 `melee` 补 `thrown`·招式 1 | `sky_burner`（燎天裂地势，顺势脱手投掷） |
| 补 `thrown`·功法 3 | `li_wu_xu_fa`（例无虚发）、`fei_hua_shou`（漫天花雨）、`lian_da_mi_jue`（练打秘诀）——三条 buff 只对 `thrown` 招式生效 |
| 补 `range`·招式 1 | `return_spear`（回马枪，`getRange [3,4]`，对齐 `_luo_yue` 的口径） |

### 5. `heavy` 注释更正

`tag.ts`：`| 'heavy' // 巨型双手` → `// 重型武器（力道驱动，可与 polearm 叠加）`（裁定 C）。

### 6. 连带修复：`weapon_stance` 的「重器架势」

`overlord_blade`/`dark_iron_sword` 去掉 `polearm` 后，行云流水的 `polearm_stance`（撼岳，其 buff 描述本就是「**重器**架势，命中+10%」）不再对它们生效 → 刘西瓜胜率由 49.3% 掉到 **40.5%**（唯一带 `weapon_stance` 的对手）。

修法：重器架势按 `polearm || heavy` 判定，短兵架势排除 `heavy`（避免又被压回守拙）：

```ts
// 撼岳（重器架势）：polearm || heavy
return w.tags.includes('polearm') || w.tags.includes('heavy')
// 守拙（短兵架势）：melee && !heavy
return w.tags.includes('melee') && !w.tags.includes('heavy')
```

- 刘西瓜回到 46.3% / 47.1%（同码两次跑）；
- 全库仅刘西瓜持 `weapon_stance`，该修复不影响其他人的对局；
- 唯一顺带变化：`xiu_dong`（绣冬，`melee`+`heavy`）由守拙（招架+10%）变为撼岳（命中+10%），与「`heavy` = 重型武器」口径一致。

### 7. 未做（留待后续）

- 需裁定仍未动：`ru_lai_shen_zhang` 的 `range`/`getRange` 冲突、`shadow_kick` 的 `requiredTags`、`three_inch_light` 的 `qi_action`、`tian_wai_fei_xian` 的 `move`/`thrown`；
- P2 全部未动：`buff` 按状态口径重筛、`defense`/`counter`/`heal`/`debuff`/元素状态/`ignore_parry`/`stance`/`self_damage`、`passive` 统一、`trigger` 移除；
- 零散：`gash` 缺 `slash`、`qi_electric_conversion` 的 `electric`。

### 8. 校验

`tsc` 无错、`eslint` 无错、**423 测试全过**、`vite build` 通过。

`npm run tour`（32 人 × 3100 场，同码跑两次）：

| 次 | 区间 | 刘西瓜 |
| --- | --- | --- |
| P1 前（基线） | 45.7% – 53.7% | 49.3% |
| P1 后（仅补 `_`… 略） | 40.5% 最低 | 40.5% |
| P1 + 重器架势修复 | **46.3% – 53.8%** | 46.3% |
| 同上重跑 | **46.4% – 54.0%** | 47.1% |

32 人全部落在 45–55；同码两次跑的差约 ±1.0（战斗内 `Math.random` 未定种子），属运行间波动。


审计由多个子任务并行产出，汇总前对**高危/结论性判定**做了复核。以下记录复核结论，最终报告以复核后为准。

## 1. 「`sword_intent_tempering` 漏 `inherent`」（passives-a 提出）→ 依据不足，降级为「需裁定」

子任务的理由是"它引用的 buff 定义自带 `inherent`"。复核：

- `src/engine/entities/tag.ts:51`：`| 'inherent' // 特性（不可复制、不可禁用）` —— 落在 **buff** 上时语义是"不可复制/不可禁用"（同类只有 3 个 buff 这么标：`damage.ts:12`、`defense.ts:148`、`defense.ts:355`）；
- 落在**功法/奇物**上时语义是"血脉限定/特性，不进随机奖励池"（`src/game/roguelite/reward-pool.ts:89/97` 过滤的是 `PASSIVES`/`ARTIFACTS` 自身的 tags）；
- 因此"buff 标了 inherent"**不能推出**"该功法该标 inherent"。事实部分（`剑意淬体` 目前会进随机池）成立，但"是否应该"属于设计判断 → 归入「需裁定」。

## 2. 「`one_arm` / `momentum_mastery` 标 `debuff` 是错标」→ 口径已确认，**判定撤销**

原本按 RUBRIC 的「`debuff` = 只给对手」判为错标。**用户已确认：`debuff` 对对手或对自己都算**。

因此 `独臂`(one_arm) 的「无法双持」、`momentum_mastery` 的自身代价标 `debuff` **属正确**，这两条从 ⚠️ 改为 ✅（`momentum_mastery` 另有 `damage`/`buff` 归属问题，仍保留 ⚠️）。

## 3. 「`requiredTags` 是硬门槛、武器缺 tag 就永远拿不到招」→ 语义理解错误（两条 ❌ 都降级）

`requiredTags` 的判定是 **`.some()`**（"武器只要有其中**任意一个** tag 即可"），不是 `.all()`：

- `src/engine/combat/engine.ts:487`：`const hasTag = action.requiredTags.some((tag) => weaponTags.includes(tag))`
- `src/engine/calc/action-executor.ts:45`：同上（同一个语义）

据此复核：

| 子任务判定 | 复核结论 |
| --- | --- |
| weapons-a ❌「`玄铁重剑`/`素铁霸刀` 缺 `melee` → 8 个剑法招永久不可用」 | **不成立**：那些招的 `requiredTags` 是 `['pierce','melee']`，`玄铁重剑` 自带 `pierce`，`.some()` 已满足 → 可用。降级为 ⚠️「权重 4 的 `melee` 缺失会让奖励关联偏低」 |
| actions-a ❌「`玉箫剑法` `requiredTags:['melee']` → 钝器体系永远拿不到」 | **不成立**：任何带 `melee` 的武器（桃木剑、藏锋、黑云剑、千机…）都能用。真正的瑕疵是"tags 宣称 `blunt` 但门槛只要 `melee`"这种**语义不一致** → 降级为 ⚠️ |

**仍然成立的硬项（保留）**：
- `engine.ts:827` `on_melee` 由**招式自身**的 `tags.includes('melee')` 决定 → 约 20 个近战招缺 `melee` 时，被近身命中不会触发 `on_melee`（真实行为影响）；
- `polearm` 误标在 `玄铁重剑`/`素铁霸刀` 上会让 `on_polearm` 生效（真实行为影响）；
- `[...WEAPON_DB, ...STARTING_WEAPONS].filter((w) => !w.tags.includes('imperial'))`（`reward-pool.ts:112`）→ 8 把起始武器（含 `bare_hands`）确实会进随机池，与 `starting-weapons.ts:8` 的注释矛盾。

## 4. 「`polearm` 被三把非长柄武器占用（含 `黑云剑`）」（weapons 提出）→ 实际只有两把

逐把核对 `polearm` 持有者（`weapons.ts`）：`破狼竹枝`、`春翁`、`铁枪·破军`、`陨铁神珍`、`千机`、`引擎铁锤`、`镇北戟` 属真长柄；**误标的是 `玄铁重剑`(dark_iron_sword) 与 `素铁霸刀`(overlord_blade)** 两把（且两者都没有 `melee`）。

`黑云剑`(fei_jian) 的 tags 是 `['melee']`，**并未标 `polearm`** —— 子任务的这一条不成立，已剔除。


## 5. 四个 `on_*` 事件没有消费方（用户指出，已核实）→ 影响面修正

`on_melee` / `on_range` / `on_unarmed` / `on_polearm` 全项目只有**发射方与声明**，没有消费方：

- 发射：`src/engine/combat/engine.ts:827-830`
- 类型声明：`src/engine/entities/trigger.ts:42-45`
- 展示文案：`src/bridge/triggerDisplay.ts:42-45`、`78-81`
- 消费：**无** —— `src/data/` 下实体实际使用的 29 种触发条件里不含这 4 种（`grep -rn "on_melee\|on_range\|on_unarmed\|on_polearm" src/data/` 零命中）

**影响修正**：
1. 删除这 4 个事件是安全的（4 行 emit + 4 行 union + 8 行文案）。
2. 删掉后，`melee`/`polearm`/`range`/`unarmed` 的消费点只剩两个：`tagRelevance` 权重档（4）与招式 `requiredTags`。
3. 因此「招式缺 `melee` → `on_melee` 不触发」这条审计结论**失效**（该标题下的 ⚠️ 仅保留"奖励权重偏低"这一半）。

## 6. 「内部实现条目必须带 `internal`」→ 基准废止，改用 `_` 前缀（用户指出 + 胜率回归实测）

原审计基准是「`internal.ts` 里的条目必须带 `internal` 标签」，P0 照此给 13 条补标，结果把 AI 要用的招式一并剔出了主招候选（`ai/index.ts:76-80`）：

| 对手 | 基线 | 补 `internal` 后 | 回退后 |
| --- | --- | --- | --- |
| 博士·德克 | 48.9% | 31.4% | 48.6% |
| 一刀 | 55.8% | 16.9% | 55.6% |

两个挡池手段的效力并不相同：`_` 前缀只挡奖励池（全库唯一消费方是 `reward-pool.ts` 的 `_getActionPool`），`internal` 标签同时挡池**并**把招式剔出 AI 主招候选。故基准改为：

- 「AI/对手要用、玩家不该学」→ `_` 前缀；
- 「AI 与玩家都不该主动用」→ `internal`。

据此各明细报告里 ❌/⚠️ 的「补 `internal`」建议一律作废，改读为「未挡池」；实际只需 `iaijutsu_strike`、`resheath` 改名（`_iaijutsu_strike`、`_resheath`），其余 11 条本就带 `_` 前缀。执行细节见汇总文 §十二。


---

## 五、武器（24 + 8 起始）

# 武器 tag 审计（24 把 WEAPON_DB + 8 把起始武器）

> 只读审计，**未改动 `src/` 下任何文件**。判定口径见 [`RUBRIC.md`](RUBRIC.md)（本次唯一标准）。
> 数据源：`src/data/weapons/weapons.ts`（24）、`src/data/weapons/starting-weapons.ts`（8）；
> 判定依据补充：`src/engine/combat/engine.ts:487`（招式 `requiredTags` ∩ `getWeaponTags()` 是**实战硬门槛**，主副手并集）、
> `src/engine/combat/effects/damage.ts:322`（`parry` 是"能否招架"的唯一武器标签开关）、
> `src/game/roguelite/reward-pool.ts:109-117`（武器池只按 **`imperial`** 过滤，**不看 `inherent`**）、
> `src/game/tagRelevance.ts`（武器类型 tag 权重 4）、`src/data/actions/*.ts`（各招 `requiredTags`）。

## 结论摘要

- 实体数：**32**（`WEAPON_DB` 24 + `STARTING_WEAPONS` 8）
- **❌ 2 条 / ⚠️ 19 条 / ✅ 11 条**
- 问题归类：
  - **❌ 武器类型缺 `melee`（会造成实际错误）**：`dark_iron_sword`（玄铁重剑）、`overlord_blade`（素铁霸刀）。二者带 `slash`/`pierce` 却无 `melee`，而 `engine.ts:487` 要求招式的 `requiredTags` 与武器 tags 有交集——**全部 8 个剑法招（`quanzhen_sword`/`yunv_sword`/`yu_xiao_jian_fa`/`swift_thunder_sword`/`blowing_snow_sword`/`spring_bamboo_sword`/`cloud_hidden_sword`/`fall_to_azure_sword`，`requiredTags` 均含 `melee`）对这两把武器永久不可用**，且 `playerTags` 里 `melee`（权重 4）缺失导致这类招根本不出。`opponents.test.ts:51` 的"`melee` ∩ `polearm` 互斥"豁免名单里只有 `qianji`，说明这两把的设计意图本就存疑。
  - **语义漂移（`polearm` 泛标）**：`polearm` 在引擎里是长柄专属（`engine.ts:830` `on_polearm`、`_chuan_yun`/`_luo_yue`/`dao_ma_dan` 要求 `polearm`），但 `dark_iron_sword`（description「玄铁巨剑」）、`overlord_blade`（「巨刃」）不带 `melee` 反而带 `polearm`——等于"用长柄 tag 表达重剑的攻距与爆伤"。它们是全库唯二能触发 `on_polearm` 的刀剑。
  - **少标 `buff`（系统性，影响面 = 抽卡权重 + UI 语义，不改数值）**：武器触发的一批**真增益** buff 没有一个在武器上标 `buff`：`po_lang_zhu_zhi_buff`(+3 招架减免)、`po_jun_buff`(暴击+5%/暴伤+20%)、`xiu_dong_buff`(力道×10% 附伤)、`chun_lei_buff`(灵巧×8% 附伤)、`buer_sword`(暴击+15%)、`overlord_blade`(远程招架+40%)、`dark_iron_weight`(命中+10%+穿招架)、`dinghai_pressure`(近距增伤)、`engine_hammer_buff`(推演×0.1 附伤)、`iron_back_buff`(40% 转穿透)、`qianji_crit`(暴伤+30%)、`zhuixing`/`huixi`(叠层)、`you_shen`。**32 把武器里 27 把都有"真增益"（触发的 buff 或 `effects.stat_buff`），全部未标 `buff`**（无真增益的 5 把是 `three_section_spear`/`ciyuan_blade`/`peach_sword`/`qimei_staff`/`long_spear`）。
  - **少标功能 tag（影响抽卡权重与 UI 语义）**：`buff` 27 条、`damage` 12 条、`defense` 3 条、`qi` 6 条（`iron_back_hand`/`dinghai_shen_tie`/`hover_drone`/`floating_silk`/`tri_orb`/`fei_jian`，另有 `ganjiang_sword`/`moxie_sword` 待口径）、`frost` 1 条（`zhen_bei_ji` 的 `on_crit` 100% 冰封）、`burn` 1 条（`engine_hammer` 的 `on_hit` 80% 灼烧）、`debuff` 2 条（`heshan_sword` 窃洞察、`zhen_bei_ji` 冰封+麻痹）、`summon` 0 条（4 把御物均已标，仅 `hover_drone` 缺 `qi`）；**"代价类"无对应 tag 2 条**（`engine_hammer`/`zhen_bei_ji` 的 `energy_drain`，`self_damage` 语义不符，见需裁定 8）。
  - **可能的多标（存疑）**：`three_section_spear`（`slash`）`special_forces_dagger`（`unarmed`）`ninja_sword`（`unarmed`）`heshan_sword`（`unarmed`）——它们的 `unarmed`/第二个攻击 tag 有 description 依据（「甩出如鞭远斩」「匕首/短刀」），但会让**拳掌/剑法招（`requiredTags:['unarmed']` 共 15 个 / `['slash']`）落在一把兵器上**，属"多标或刻意"的边界，不判 ❌。
  - **边界情况**：`xiu_dong`（「三尺二寸」重剑却带 `one_handed`）、`qianji`（8 个 tag 全库最全，唯一被测试豁免 `melee`+`polearm` 同持的武器）——均属刻意设计，保留 ✅/⚠️。
  - **`inherent` 现状**：**32 把武器无一带 `inherent`**。御物（4 把）靠 `imperial` 被 `reward-pool.ts:112` 挡在池外（自洽）；但 `starting-weapons.ts:8` 的注释「这些武器不进奖励池」与代码不符——武器池只过滤 `imperial`，**8 把起始武器现全部可被随机抽到**（见需裁定 1）。
  - **`thrown` 现状**：32 把武器无一带 `thrown`。全库 `thrown` 只出现在**招式的 `tags`**（`player.ts:19/32/53/66/78/92/104/424` 等），而 `例无虚发`/`漫天花雨`/`练打秘诀`（`buffs.ts:187/254/289`）读的正是"招式 tags"而非武器 tags——无武器标 `thrown` **不是缺标**（没有"投掷武器"这一形态）。
- 高危项提醒（按 RUBRIC §归类与暴露）：
  - `melee` 缺失是本次唯一"实际让玩家拿不到/用不了内容"的项（8 个剑法招 + `playerTags` 抽取权重），列 ❌。
  - `imperial` 是御物进入/退出随机池的唯一开关（`reward-pool.ts:113`）——4 把御物全部标了 `imperial` 且**都只由 `xuanmen_n02_weapon` 事件发放**（`events/xuanmen.ts:26-34`），过滤正确；反过来说，任何未来新增御物漏 `imperial` 会直接进随机池。
  - `parry` 是 `damage.ts:322` 的招架硬开关：32 把中**唯一不带 `parry` 的是 `engine_hammer`**（description 无守势、`heavy_load` 6 层，无 `onParryChance` 类钩子），判定自洽。

### 补充：`buff` 判定依据（摘自 `src/data/buffs/`）

| 武器触发引用的 buff | 定义处 | 是否"真增益" |
| --- | --- | --- |
| `po_lang_zhu_zhi_buff` | `defense.ts:494` `onParryReduction: final-3` | 是 |
| `po_jun_buff` | `weapon.ts:125` 暴击+5%/暴伤+20% | 是 |
| `xiu_dong_buff` | `weapon.ts:113` 力道×10% 附伤 | 是 |
| `chun_lei_buff` | `weapon.ts:135` 灵巧×8% 附伤 | 是 |
| `buer_sword` | `weapon.ts:146` 暴击+15% | 是 |
| `overlord_blade` | `weapon.ts:55` 近战招架+20%/远程+40% | 是 |
| `dark_iron_weight` | `weapon.ts:69` 命中+10%、穿 30% 招架 | 是 |
| `dinghai_pressure` | `weapon.ts:82` 近距增伤、穿 30% 招架 | 是 |
| `engine_hammer_buff` | `weapon.ts:101` 推演×0.1 附伤 | 是 |
| `iron_back_buff` | `weapon.ts:154` `onDisarmChance:-1`＋40% 转穿透 | 是 |
| `broken_blade_lock` | `weapon.ts:169` `onDisarmChance:-1` | 是（能力型） |
| `qianji_crit` | `damage.ts:243` 暴伤+30% | 是 |
| `special_forces_dagger` | `buffs.ts:1577` 追加 1 电伤+1 穿透电伤 | 是（但耗 1 缠） |
| `zhuixing` / `huixi` | `buffs.ts:445/455` 追击叠层 / 回息叠层 | 是 |
| `you_shen` | `buffs.ts:1160` 游身叠层 | 是 |
| `heavy_load` | `weapon.ts:22` 力量不足扣身法 | **否**（纯代价） |
| `energy_drain` | `debuffs.ts:192` AP 回复 -0.1/层 | **否**（纯代价） |
| `yuwu_cost` | `debuffs.ts:210` AP 回复被扣（`tags:['imperial','debuff']`） | **否**（御物维持代价） |

> 说明：`buff` 属"其他"权重 1，标错不改战斗数值，但会污染抽卡权重与 UI 语义（与 `passives-a.md` 同口径）。

## 明细

| 实体 | 现 tags | 判定 | 理由（引用 effects/triggers/description） | 建议 |
| --- | --- | --- | --- | --- |
| 破狼竹枝（`po_lang_zhu_zhi`） | `parry` `polearm` `blunt` | ⚠️ | description「竹枝…招架后减免3点伤害」；`on_equip`→`po_lang_zhu_zhi_buff`（`defense.ts:499` `final-3`，真防御收益）→ `parry`/`blunt`/`polearm` 均成立（与 `qimei_staff` 同族同标）。缺 `buff`/`defense`（招架减伤是显性防御机制） | 补 `buff` `defense` |
| 春翁（`three_section_spear`） | `pierce` `parry` `polearm` `slash` | ⚠️ | description「三段式机关枪…近身可绕开招架，甩出如鞭远斩」；`grantsActions:['_chuan_yun','_luo_yue']`，两者 `requiredTags:['polearm']` → `polearm`/`pierce` 成立；`_luo_yue` 自带 `tags:['slash','range','polearm']`、`getRange:[3,5]`，「甩出如鞭远斩」与 `slash` 吻合。缺 `qi`（三节枪的招式走 `_luo_yue` 远程斩，但武器本体无炁机制，仅"机关"——低置信，见需裁定 3） | 无强建议（`qi` 见需裁定） |
| 素手无相（`iron_back_hand`） | `unarmed` `parry` | ✅ | description「以炁驱动时延展覆盖整条手臂，化作无形护甲。拳劲透体，伤人于无形」；`range:[0,2]`（贴身），`iron_back_buff` 给 40% 转穿透＋免缴械，`effects` 给 `agility+2`。拳/掌攻击形态 → `unarmed`（是 `requiredTags:['unarmed']` 的 15 个拳脚招、`血炁护体`/`归宗式` 的可用前提），无刃无柄 → 不标 `melee`/`slash`，正确 | 可补 `qi`（description 明写"以炁驱动"，但 `qi` 会触发 `qi_amplify`/`斗铠` 判定，需口径，见需裁定 4）、`buff` |
| 锁链断刀（`broken_blade`） | `slash` `parry` `melee` `one_handed` | ✅ | description「一把残损的断刀。加装锁链，免疫缴械」；`on_equip`→`broken_blade_lock`（`onDisarmChance:-1`）、`on_opponent_move_away`→`_shuai_ren`（`requiredTags:['slash']`，`getRange:[2,4]`，武器本体 `range:[0,2]` 但由锁链甩出）→ `slash`/`melee`/`one_handed`/`parry` 均自洽 | 可补 `buff`（免缴械）、`retrieve_weapon`/`range_up`（锁链甩刃，机制粒度见需裁定 6） |
| 特种兵匕首（`special_forces_dagger`） | `pierce` `unarmed` `parry` `slash` `melee` `one_handed` `electric` `chan` | ⚠️ | description「军方特制电击匕首。耗1缠劲，追加电伤并麻痹目标」；`special_forces_dagger`（`buffs.ts:1583` `spendChan(1)`＋追加 1 电伤 1 穿透电伤，`tags:['electric','damage']`）→ `electric`/`chan`/`pierce`/`one_handed`/`melee`/`parry` 均有依据。**`unarmed` 存疑**：匕首是握持兵器，"拳脚"语义仅靠"可配拳法"解释（对照 `unarmed.ts` 15 个 `requiredTags:['unarmed']` 的拳掌招）；`slash` 对匕首（描述只说"电击/刺"）偏弱 | `unarmed`/`slash` 二择一或保留（见需裁定 2）；可补 `buff`（附加电伤是真增益）、`damage` |
| 铁枪·破军（`iron_spear`） | `pierce` `parry` `polearm` `heavy` | ⚠️ | description「丈二铁枪，势大力沉。出枪迅猛，暴击更盛」；`heavy_load` 6 层＋`po_jun_buff`（暴击+5%/暴伤+20%）→ `polearm`/`heavy`/`pierce`/`parry` 成立。但 `heavy` 的 tag 注释是「巨型双手」，且**无 `melee`**——本武器本就没有 `slash`，8 个剑法招（`requiredTags` 含 `slash` 或 `melee`）差异不大（仅 `yu_xiao_jian_fa` 的 `requiredTags:['melee']` 纯门槛），影响小；缺 `buff`（`po_jun_buff` 真增益） | 补 `buff`；`heavy` 语义见需裁定 5 |
| 弗思剑（`fusi_sword`） | `pierce` `slash` `parry` `melee` `one_handed` | ⚠️ | description「最快的剑之一，闪避后身随意动，回复内息」；`on_dodge`→`restore_ap 0.5`（回内息，属防御/续航收益），`range:[1,3]`、单手剑 → 五个 tag 全成立。缺 `buff`（回 AP 是真收益）、`defense` | 补 `buff`（`defense` 可选） |
| 藏锋（`zantetsu`） | `slash` `pierce` `parry` `melee` `one_handed` | ⚠️ | description「锋藏于鞘，出鞘一瞬，无物不斩」；`on_stance`→`_cangfeng_mind_eye`→`add_buff('mind_eye')`（`buffs.ts:121` 暴击+25%）→ 武器类型四标成立；缺 `stance`（机制完全由 `on_stance` 驱动）与 `buff`（心眼真增益） | 补 `stance` `buff` |
| 次元刃（`ciyuan_blade`） | `slash` `parry` `qi` `melee` `one_handed` | ✅ | description「以炁凝成的无形之刃」；无 effects/triggers，`range:[1,4]`。`qi` 有描述依据（且 `qi_amplify`/`斗铠` 会按武器 `qi` 判定），`slash`/`melee`/`one_handed`/`parry` 自洽。**注**：`_spirit_sword`/`灵剑` 会在战斗中把 `qi` 动态贴到"任意武器"上（`handlers.ts:199`），说明 `qi` 是"炁化兵刃"的机制标签，`ciyuan_blade` 静态标 `qi` 正确 | 无 |
| 绣冬（`xiu_dong`） | `slash` `parry` `melee` `heavy` `one_handed` | ⚠️ | description「绣冬长三尺二寸，势沉力猛。力道化为锋芒，越重越利」；`heavy_load` 10 层＋`xiu_dong_buff`（力道×10% 附伤）→ `heavy`/`slash`/`melee`/`parry` 成立。**`one_handed` 与 `heavy` 同持存疑**：`one_handed` 在代码里是副手开关（`character-gen.ts:61`、`roguelite/engine.ts:560` 的 `flags.weapon_one_handed`），"越重越利"的重剑却能配副手；但美术 `WEAPON_POSES.xiu_dong`（`pixel-sprites/weapons.ts:905`）确为单手剑（`gripX:8`，无 `grip2`），且 `heavy` 此处表"力道驱动"而非"双手巨兵" → 判定为刻意设计 | 补 `buff`；`one_handed`+`heavy` 的合法性见需裁定 5 |
| 春雷（`chun_lei`） | `slash` `parry` `melee` `one_handed` | ⚠️ | description「轻灵迅捷，见血封喉。灵巧化为致命锋芒」；`chun_lei_buff`（灵巧×8% 附伤）、`range:[0,2]` 单手快剑 → 四标成立。缺 `buff`、`damage` | 补 `buff` `damage` |
| 素铁霸刀（`overlord_blade`） | `slash` `parry` `polearm` `heavy` | ❌ | description「与身同高的巨刃，离心力驱动，势不可挡」；`heavy_load` 14 层＋`overlord_blade`（`weapon.ts:57` 近战招架+20%/远程+40%、穿 30% 招架）。**`polearm` 与 `melee` 二选一是错的**：`engine.ts:487` 下 8 个剑法招（`requiredTags` 含 `melee`）全部不可用；`polearm` 又让 `_chuan_yun`/`_luo_yue`（三节枪专属招）与 `on_polearm`（`engine.ts:830`）对它生效。美术 `overlord_blade` 为单手巨剑姿态（`gripX:9`，无 `grip2`）。`polearm` 在此只承担"长攻距+爆伤"语义（`buffs.ts:174` `overlord_art_buff` 反而按 `heavy` 判定，与 `polearm` 无关） | 去 `polearm`、补 `melee`（保留 `slash` `heavy` `parry`），并补 `buff` `damage`；或若确实按长柄设计，需在 description 与 `grantsActions` 上给出长柄依据 |
| 玄铁重剑（`dark_iron_sword`） | `heavy` `blunt` `slash` `pierce` `parry` `polearm` | ❌ | description「与身同高的玄铁巨剑，重六十四斤，无锋无刃。大巧不工，以力破万法」；`heavy_load` 14 层＋`dark_iron_weight`（命中+10%、穿 30% 招架）。**同 `overlord_blade`**：无 `melee` → 8 个剑法招永久不可用；`polearm` 让长柄招与 `on_polearm` 生效。`blunt`（无锋无刃）有描述依据；`slash`/`pierce` 在有 `blunt` 时属"万能攻击方式"堆叠。**补充证据**：`passives.ts:480` 的 `dark_iron_sword_art`（玄剑秘册）给武器贴 `unarmed`，说明该武器原本就缺"手上功夫"可用性，设计上是靠被动补，而非靠武器 tags 自身 | 去 `polearm`、补 `melee`（保留 `heavy` `blunt` `parry`）；`slash`/`pierce` 是否保留见需裁定 2 |
| 阿赖耶识（`heshan_sword`） | `slash` `pierce` `unarmed` `parry` `melee` `one_handed` | ⚠️ | description「一把触及识海的唐刀，可同时使用拳掌功夫。命中后窃取对手 1 点洞察，持续 4 秒」；`on_hit`→`_alaya_insight`（`stat_transfer`，真增益）→ `melee`/`slash`/`pierce`/`one_handed`/`parry` 成立；**`unarmed` 有明确 description 依据**（"可同时使用拳掌功夫"），是本库唯一"刀+拳"双形态。缺 `buff`/`debuff`（窃取洞察＝自己 +1、对手 -1，两头都漏） | 补 `buff` `debuff` |
| 陨铁神珍（`dinghai_shen_tie`） | `parry` `polearm` `heavy` | ⚠️ | description「对传说中兵器的仿制品…由使用者的炁激活，伸缩自如」；`heavy_load` 16 层＋`dinghai_pressure`（`weapon.ts:85` `tags:['weapon','heavy']`，距离越近伤害越高、穿 30% 招架），`range:[1,6]`（全库次远）→ `polearm`/`heavy`/`parry` 成立。缺 `qi`（"由使用者的炁激活"）、`buff`、`damage`（`dinghai_pressure` 是显性增伤） | 补 `qi` `buff` `damage` |
| 惊鸿（`yanling_blade`） | `slash` `parry` `melee` `one_handed` | ⚠️ | description「薄刃轻刀，雁翎般轻灵」；`effects:[{stat_buff: agility+1/dexterity+2/strength+1}]`（构造期永久属性，真增益），`range:[0,2]` 单手轻刀 → 四标成立。缺 `buff`（明写加属性）、`damage`（轻刀+属性收益偏输出） | 补 `buff` `damage` |
| 千机（`qianji`） | `melee` `pierce` `parry` `slash` `blunt` `unarmed` `polearm` `one_handed` | ✅ | description「漆黑纳米长棍，可在相似尺寸的固态构造间快速切换——箫、笛、细剑、长短棍、手杖乃至遮阳伞」；`on_equip`→`qianji_crit`（暴伤+30%），`range:[0,3]`。八个武器类型 tag 全给且**有 description 逐项对应**（箫/笛/棍/杖=长柄+钝击/单手，细剑=劈砍戳刺/近战，遮阳伞=可招架），`opponents.test.ts:50` 明确豁免它 `melee`+`polearm` 同持。缺 `buff`（暴伤+30%） | 可补 `buff` |
| 引擎铁锤（`engine_hammer`） | `blunt` `electric` `qi` `craft` `polearm` | ⚠️ | description「天工锻造的电磁锤，以炁驱动，雷火交加」；`engine_hammer_buff`（推演×0.1 附伤）、`energy_drain` 0.6（代价）、`on_hit`→`add_debuff('burn', 0.8)`（真灼烧）→ `blunt`/`electric`/`qi`/`craft` 正确，`range:[0,2]`。`polearm`（锤=长柄）与 `_rod_*` 招配套；`melee` 缺失但本武器无 `slash`/`pierce`，实际影响仅 `yu_xiao_jian_fa`（`requiredTags:['melee']`）。缺 `burn`（0.8 概率施加灼烧是明确元素机制，`burn` 权重 2）、`buff`、`damage`；`energy_drain` 是自付代价但 `self_damage` 语义不符（见需裁定 8） | 补 `burn` `buff` `damage` |
| 无人环（`hover_drone`） | `imperial` `range` `blunt` `summon` | ⚠️ | description「以炁供能的浮空圆环，脑机操控。环身沉重，撞出钝击」；`yuwu_cost` 0.4（御物耗炁）、`summon: hover_drone`（`_huan_shot`：`tags:['range','blunt','summon']`，1 伤+1 穿透+30% 麻痹）；`range:[0,6]` → `imperial`/`range`/`blunt`/`summon` 成立（4 把御物的 `summon` 标注一致）。缺 `qi`（"以炁供能"）、`buff` | 补 `qi` `buff`；`bound:true` 与 `imperial` 的关系见需裁定 1 |
| 风切（`ninja_sword`） | `slash` `pierce` `parry` `melee` `unarmed` `one_handed` | ⚠️ | description「忍者短刀，轻如风，快过影。可藏于袖中，出手极速」；`effects:[{haste:120}]`（攻速，真输出增益），`range:[0,2]` 短刀 → `slash`/`pierce`/`melee`/`parry` 成立。**`unarmed` 依据弱**：描述只说"可藏于袖中"（藏匿≠拳脚）；这是全库第 4 把带 `unarmed` 的非拳套武器（另三把：`dagger`/`special_forces_dagger`/`heshan_sword`，后两者有明确"拳掌功夫"描述）。缺 `buff` `damage` | `unarmed` 依需裁定 2；补 `buff` `damage` |
| 镇北戟（`zhen_bei_ji`） | `polearm` `parry` `pierce` `blunt` `electric` `heavy` | ⚠️ | description「姬家世代相传的战戟…可将使用者的炁转化为冰电之力。暴击时冰封对手」；`heavy_load` 10＋`energy_drain` 1、`on_crit`→`add_debuff('frost',3)`（**真霜冻**）、`on_dodged`→`you_shen`、`on_parried`→`add_debuff('paralyze')` → `polearm`/`pierce`/`blunt`（戟=刺+砸）/`electric`/`heavy`/`parry` 成立。**漏 `frost`**（`buffs.ts` 的 `frost` 是 `on_crit` 100% 施加的冰封，`frost` 权重 2）、`debuff`（给对手霜冻+麻痹）、`buff`（游身）、`chan`/`qi`（"将炁转化为冰电之力"，但无缠劲消耗） | 补 `frost` `debuff` `buff`；`qi` 见需裁定 4 |
| 不二剑（`buer_sword`） | `pierce` `slash` `parry` `melee` `one_handed` | ⚠️ | description「最快的剑之一，起手暴击大增但身法略滞，逐回合恢复」；`on_equip`→`buer_sword`（`weapon.ts:148` 暴击+15%）→ 五标成立。**注**：该 buff 的 description（"身法略滞，逐回合恢复"）在当前 `effects` 里**没有实现**（只有 `onCritChance`，无 `attrMods`/恢复钩子）——属 content 遗留，不影响 tag 判定。缺 `buff` `damage` | 补 `buff` `damage` |
| 干将（`ganjiang_sword`） | `slash` `pierce` `parry` `melee` `one_handed` | ⚠️ | description「千星融两柄古剑所铸，注入现代科技，以炁驱动。雄剑追星，迅捷无匹」；`on_hit`→`zhuixing` 叠层（`buffs.ts:445`）→ 五标成立。缺 `qi`（"以炁驱动"、且与 `莫邪` 同批铸造，见需裁定 4）、`buff` `damage`（叠层追击） | 补 `buff` `damage`；`qi` 见需裁定 4 |
| 莫邪（`moxie_sword`） | `slash` `pierce` `parry` `melee` `one_handed` | ⚠️ | description「千星融两柄古剑所铸，注入现代科技，以炁驱动。雌剑回息，内息自生」；`on_hit`→`huixi` 叠层（`buffs.ts:455`）→ 五标成立。缺 `qi`、`buff`、`defense`（回息是续航） | 补 `buff`；`qi` 见需裁定 4、`defense` 可选 |
| 赤手空拳（`bare_hands`） | `unarmed` | ✅ | description「什么都没有，但什么都有可能」；`effects:[{stat_buff: agility+2}]`，`range:[0,2]`；无兵器 → 仅 `unarmed` 正确（`opponents.test.ts:55` 要求每把非御物武器至少一个类型 tag，满足）。`n2` 里它被当作"修炼点"选项而非武器（`events/layout.ts:49` `type:'points'`） | 可补 `buff`（低优先；空手基准武器） |
| 桃木剑（`peach_sword`） | `slash` `pierce` `parry` `melee` `one_handed` | ✅ | description「入门级单手剑，轻灵锐利」；`range:[1,3]`，无 effects/triggers → `slash`/`pierce`（剑法招两类都有）/`melee`/`one_handed`/`parry` 全自洽，是"刀剑系"基准武器 | 无 |
| 齐眉棍（`qimei_staff`） | `parry` `polearm` `blunt` | ✅ | description「长棍一根，攻守兼备」；`range:[1,4]`，美术 `WEAPON_POSES.qimei_staff`（`weapons.ts:1043` 有 `grip2X/grip2Y`）确为双手长杆 → `polearm`/`blunt`/`parry` 正确，与 `po_lang_zhu_zhi` 同族同标 | 无 |
| 长枪（`long_spear`） | `pierce` `parry` `polearm` | ✅ | description「长枪一杆，势大力沉」；`range:[1,4]`，美术 `long_spear`（`weapons.ts:1234` 有 `grip2`）为双手 → 三标自洽。**注**：`fei_jian`（黑云剑）的 tag 列表是它的超集，两把武器的 `polearm` 语义不同（见 `fei_jian` 行） | 无 |
| 七根丝（`floating_silk`） | `imperial` `range` `pierce` `summon` `parry` | ✅ | description「一缕以炁御动的柔丝，可远可近，可硬可软，变幻莫测」；`bound:true`、`yuwu_cost` 0.7、`summon: silk`（`_silk_shot`：`getRange:[0,7]`，距离越近越利，`pierce`）；`range:[0,6]` → `imperial`/`range`/`pierce`/`summon`/`parry`（丝可缠挡，且 `damage.ts:322` 只认武器 `parry` 标签）成立；仅由 `xuanmen_n02_weapon` 发放，`reward-pool.ts:113` 过滤正确 | 可补 `qi`（见需裁定 4） |
| 三相珠（`tri_orb`） | `imperial` `parry` `range` `summon` `blunt` | ✅ | description「三颗由炁劲驱动的法珠，环绕主人旋转」；`yuwu_cost` 0.4、`summon: orb`（`maxCount:()=>3`，`_orb_shot`：`tags:['range','summon']`、3 伤 1 穿透），美术 `tri_orb` 姿势（`weapons.ts:884`）为环绕体 → `imperial`/`range`/`blunt`/`summon`/`parry` 自洽 | 可补 `qi`（见需裁定 4） |
| 黑云剑（`fei_jian`） | `imperial` `parry` `slash` `pierce` `range` `heavy` `polearm` `summon` | ⚠️ | description「御剑飞行，剑随人走」；`yuwu_cost` 0.5、`summon: fei_jian`（`_fei_jian_shot`：`getRange:[0,7]`、`tags:['range','slash','pierce','summon']`、推演×0.5+5、长前后摇）→ `imperial`/`range`/`slash`/`pierce`/`summon`/`parry`/`heavy`（慢速重击）成立。**`polearm` 可疑**：黑云剑是飞剑，不是长柄；它使 `_luo_yue`/`on_polearm` 对一把飞剑生效（与 `overlord_blade` 同类漂移）。与 `long_spear` 对比可见 `polearm` 被重复用于表达"攻距/重击" | 去 `polearm`（或移入需裁定 5）；可补 `qi`、`damage` |
| 军用匕首（`dagger`） | `pierce` `unarmed` `parry` `slash` `melee` `one_handed` | ✅ | description「短小而致命的匕首」；`effects:[{stat_buff: agility+1}]`，`range:[0,2]`；`special_forces_dagger` 是它的电击衍生版，tag 列表为其子集 → `pierce`/`slash`/`melee`/`one_handed`/`parry` 自洽。`unarmed` 与 `special_forces_dagger` 同源（匕首可配拳法），与 `opponents.test.ts` 不冲突 | 可补 `buff` |

## 需裁定（拿不准的）

1. **`starting-weapons.ts` 的"不进奖励池"注释与代码不符**：`reward-pool.ts:109-117` 的武器池 `filter((w) => !w.tags.includes('imperial'))` **只排除 `imperial`**，`STARTING_WEAPONS` 被显式合入（`[...WEAPON_DB, ...STARTING_WEAPONS]`）。因此 8 把起始武器**当前全部可被随机抽到**（含 `bare_hands` 赤手空拳——它同时是 n2 的"修炼点"选项）。按 RUBRIC §归类与暴露，若"起始武器不进池"是既定规则，应给它们标 `inherent`；若"可被抽到"是有意（例如事件节点补给），则只需改注释。本报告按"代码与注释冲突"记录，未判 ❌。御物 4 把（`hover_drone`/`floating_silk`/`tri_orb`/`fei_jian`）另走 `xuanmen_n02_weapon` 事件发放，`imperial` 过滤正确；但 `inherent`（"不可复制、不可禁用"，见 `tag.ts:51`）与 `imperial` 的职责边界需确认。
2. **`unarmed`/第二个攻击 tag 在"兵器"上的口径**：`special_forces_dagger`、`ninja_sword`、`heshan_sword`、`dagger` 带 `unarmed`；`dark_iron_sword` 带 `blunt`/`slash`/`pierce`。现象是"握兵器也能吃拳脚招/多类斩击招"。若口径是"武器 tags 只描述形态"，则 `unarmed` 应只给拳套/空手（4 条要动）；若口径是"能解锁哪类招"，则现状成立（`heshan_sword` 的描述"可同时使用拳掌功夫"与 `passives.ts:484` 的 `weapon_tag: 'unarmed'` 都指向后者）。本报告按后者不判 ❌。
3. **`three_section_spear` 是否需要 `qi`**：description「三段式机关枪」（机关/机械），但 `_luo_yue` 是"如鞭般甩出"的物理斩击，无炁机制。标 `qi` 会激活 `qi_amplify`（`damage.ts:77` 武器 `qi` → 全招 ×(1.1+…)）与 `斗铠`（`defense.ts:421` 炁伤减伤 1/非炁 2），属**改数值**的决定，需明确口径。
4. **`qi` 在"以炁驱动"武器上的边界**：32 把里只有 2 把标了 `qi`（`ciyuan_blade`、`engine_hammer`），而 description 明写"以炁驱动/激活/供能"却未标的有 8 把：`iron_back_hand`（"以炁驱动"）、`dinghai_shen_tie`（"由使用者的炁激活"）、`ganjiang_sword`、`moxie_sword`（均"以炁驱动"）——4 把常规；御物 `hover_drone`/`floating_silk`/`tri_orb`/`fei_jian`（"以炁供能/以炁御动"）——4 把。若按 `passives-a.md` 需裁定 2 的"机制口径"（`qi` 只在真正参与炁伤害/资源时标），`ciyuan_blade`/`engine_hammer` 的现标也需要重新解释；若按"以炁驱动即标"，上述 8 把都要补。注意：武器 `qi` **会改战斗数值**（`qi_amplify` `damage.ts:77` → 全招 ×(1.1+…)；`斗铠` `defense.ts:421` → 炁伤减 1/非炁减 2），不是纯展示。
5. **`heavy` 的语义（"巨型双手" vs "力道驱动"）**：`tag.ts:29` 注释是「巨型双手」，但现状是 `iron_spear`（长枪）带 `heavy`、`xiu_dong`（三尺二寸单手剑，美术 `gripX:8` 无 `grip2`）带 `heavy`+`one_handed`、`fei_jian`（飞剑）带 `heavy`、`overlord_blade`（美术单手）带 `heavy`。引擎里 `heavy` 的武器侧读取点只有 `buffs.ts:178`（`overlord_art_buff`：`heavy` → 命中+10%/暴击+15%），即"重击流"而非"双手"；`heavy` 另出现在 `weapon.ts:104`（`engine_hammer_buff` 自身 tags）、`weapon.ts:85`（`dinghai_pressure` 自身 tags）等 buff 侧。若确认 `heavy` = 重击流，则 `overlord_blade`/`dark_iron_sword` 缺 `melee` 更可疑（它们显然该吃剑法招）；若确认 `heavy` = 巨型双手，则 `xiu_dong` 的 `one_handed`、`iron_spear` 的 `heavy` 需要复核。
6. **`polearm` 是否只给长柄**：直接相关的是 `overlord_blade`/`dark_iron_sword`/`fei_jian` 三把非长柄带 `polearm`。收益是 `_chuan_yun`/`_luo_yue`（三节枪专属招）、`rod_*` 棍系招、`dao_ma_dan`（刀马旦，描述"入戏…招式带炁"）、`on_polearm` 触发器；代价是 8 个剑法招不可用。`opponents.test.ts:51` 的豁免名单只写了 `qianji`，暗示作者并未把这些当"合法的 melee+polearm 同持"，但测试只检查了 `melee && polearm`，**漏了"既非 melee 也非 polearm"与"刀剑却只有 polearm"这两种情况**。建议明确：刀剑类是否必须带 `melee`。
7. **`range_up`/`retrieve_weapon` 这类机制 tag 在武器上的粒度**：`broken_blade`（锁链甩刃，`_shuai_ren` `getRange:[2,4]` 超出武器 `range:[0,2]`）与 `three_section_spear`（`_luo_yue` `getRange:[3,5]`）都是"武器本体够不到、靠招式延伸"；`weapons.ts` 里没有任何武器用 `range_up`（它只出现在 `passives.ts:62` 御剑诀）。若约定"武器 tags 描述武器自身"，则无需补；若约定"能查到就算"，这两把应补 `range_up`。
8. **代价类效果缺对应 tag**：`heavy_load`（`iron_spear`/`xiu_dong`/`overlord_blade`/`dark_iron_sword`/`dinghai_shen_tie`/`zhen_bei_ji`）、`energy_drain`（`engine_hammer`/`zhen_bei_ji`）、`yuwu_cost`（4 把御物）都是**给自己上的持续代价**。RUBRIC §二明确"给自己上的负面不算 `debuff`"，`self_damage` 又要求"自伤"（这些是 AP/身法损失，不是掉血）。是否需要一个新的"代价"表达（或统一不标）需口径。
9. **`buff` 是否算武器 tag**：现状是**全部 32 把武器都不带 `buff`/`damage`/`defense`**，而 27 把武器通过 `on_equip`/`on_hit`/`on_dodge`/`on_stance`/`effects.stat_buff` 带真增益（见上表）。同批审计的 `passives-a.md` 大量以"缺 `buff`"判 ⚠️，若武器沿用同一口径，本次会有 ~27 条要动；若武器 tags 只写"武器类型/形态"、行为收益由 buff 自身 tags 表达（`weapon` tag 已用于 buff 侧，见 `weapon.ts:25` 等），则现状成立。本报告按"统一口径"给出补 `buff` 建议，但以 ⚠️ 计。


---

## 六、功法 · 上半（前 55 个）

# 功法（被动）· 上半 tag 审计（前 55 个）

## 结论摘要

- 实体数：**55**（`src/data/passives/passives.ts` 中 `PASSIVES` 按数组顺序第 1–55 个：`forge`(id 行 8) … `sword_intent_tempering`(id 行 642)，第 56 个 `yu_du_shu`(行 651) 起不在本次范围）
- **❌ 3 条 / ⚠️ 40 条 / ✅ 12 条**（❌ = `frost_mastery`、`momentum_mastery`、`one_arm`；✅ = `sword_dominion`、`ordinary_training`、`tai_chi_mastery`、`zoldyck_art`、`hui_lei_qian`、`baihu_ding`、`yin_shi_li_dao`、`weapon_stance`、`stone_skin`、`qishier_bian`、`hua_gun`、`lingxi_finger`）
- 问题归类：
  - **多标**（`buff` 被当实现手段/条件载体用，按 RUBRIC §二「增益」应去掉）：`nei_xi_mian_chang`、`yue_nv_sword`、`wan_xiang_jian_yi`、`shenxing_baibian`、`extreme`、`spirit_resonance`、`yuxin_sword_mastery`（各条理由见明细）。
  - **错标**（❌）：`one_arm`、`momentum_mastery` 把**给自己**的负面（`agility -2` / 名字叫"受到伤害+5%"的自身代价）标成 `debuff`；`momentum_mastery` 同时把"给对手叠刃炁"的收益标成 `damage`（应为 `buff`/`debuff`）。
  - **少标**（占绝大多数，影响面 = 抽卡权重 + UI 语义）：系统性缺 `passive`（55 条里仅 20 条带，见下）、缺 `buff` 17 条、缺 `damage` 5 条、缺 `defense` 3 条、缺 `debuff` 3 条；元素/状态漏标：`frost`（`frost_mastery`）、`burn`（`zhu_huo_jue`）、`bleed`（`momentum_mastery`）、`paralyze`（`thunder_art`）。
  - **语义漂移**：`qi` 泛标（`iron_bone`、`extreme`、`zhou_liu_bu_xi`、`wan_xiang_jian_yi` 的描述/effects 与炁无关）；`damage` 泛标（`daily_grind`、`nei_xi_mian_chang`）；`low_hp` 漏标（`extreme` 条件为 `chan_overflow`，见需裁定）。
- 高危项提醒（按 RUBRIC §归类与暴露）：`inherent` 直接决定能否进随机奖励池（`reward-pool.ts:89`）。本次 55 条里带 `inherent` 的 4 条（`ordinary_training`、`daily_grind`、`zoldyck_art`、`one_arm`）与其 buff 定义（`ordinary_training`/`daily_grind` 为 `tags: ['damage','inherent']`、`zoldyck_art` 为血脉秘法、`one_arm` 为断臂）自洽，未发现 ❌ 级错标；反之 `yuxin_sword_mastery` 的 `buff` 定义 `yuxin_sword_mastery` 是"叠层上限翻倍"——见需裁定第 3 条。

### 补充：`passive` 标签的系统性缺口（跨条问题，计入各条 ⚠️）

`grep "'passive'" src --include=*.ts` 显示：引擎/游戏/UI 代码**不读取实体自身的 `passive` 标签**（只读 `weapon.tags`、buff `tags`），该标签目前只影响 tooltip 徽章与 `tagRelevance` 权重（权重 1）。因此缺 `passive` 是低影响，但文件内 55 条中仅 20 条带，属明显不一致。以下 35 条缺 `passive`：`forge`、`iron_bone`、`spirit_resonance`、`sword_dominion`、`last_sword`、`iaijutsu_mastery`、`human_radar`、`ice_heart`、`frost_mastery`、`nineteen_stops`、`extreme`、`zhou_liu_bu_xi`、`nei_xi_mian_chang`、`yu_yang_shi_ba_shi`、`yi_dian_po_xiao`、`inner_power`、`tai_chi_mastery`、`godspeed`、`thunder_art`、`hui_lei_qian`、`baihu_ding`、`qiti_source`、`stance_time`、`dark_room_catch`、`yue_nv_sword`、`one_arm`、`dark_iron_sword_art`、`tide_inner_power`、`shenxing_baibian`、`xuannv_sword`、`zhu_huo_jue`、`wan_xiang_jian_yi`、`stone_skin`、`qishier_bian`、`hua_gun`、`feng_mo_gong`、`frost_step`、`lingxi_finger`、`feng_wu_jiu_tian`、`beiming`、`golden_light`、`sword_intent_tempering`（共 42 项，含已在上文单列者）。建议：文件内统一（要么全带、要么全不带）。

### 补充：`buff` 判定依据（摘自 `src/data/buffs/`）

| 被动引用的 buff | 定义处 | 是否"真增益" |
| --- | --- | --- |
| `sangui_yuanqi` | buffs.ts:1304 `attrMods: 力/身/巧/洞察 +1` | 是 |
| `iron_defense` | defense.ts:211 `onTakeDamage: ×0.85` | 是 |
| `ji_lie_zhi_lie_buff` | damage.ts:160 叠层 `暴击+2%/层、暴伤+3%/层` | 是 |
| `spirit_resonance_buff` | buffs.ts:851 召唤物按段吃 `下取整(力道/3)` 增伤 | 是（构造期先付 `strength -2`） |
| `sword_dominion` | buffs.ts:1758 `buffEnhanceActionRange(+2)`＋`√apCost` 附加伤害 | 是 |
| `last_stand` | damage.ts:20 `onCritDamage: 缺血比例×1.0` | 是 |
| `shi_buff` | damage.ts:62 叠层 `暴伤+15%/层`（上限3） | 是 |
| `extreme` | damage.ts:31 `缠满时`给 `暴击+1%/缠、暴伤+3%/缠` | 是（条件性） |
| `zhou_liu_bu_xi` | buffs.ts:789 溢出叠层 `炁招命中+10%/层、伤害+10%/层` | 是 |
| `circle` | buffs.ts:163 `洞察+2`、4AP+ 招式 `命中+10%` | 是 |
| `elemental_immunity` | defense.ts:126 免疫霜冻、50% 免麻痹/灼烧 | 是 |
| `chill_blade` | buffs.ts:524 叠层 `伤害+8%/层` | 是 |
| `nineteen_stops` | damage.ts:138 叠层 `命中/暴击/暴伤 +1%/层` | 是（同时叠"越易失手"） |
| `ordinary_training` | defense.ts:145 `身法→闪避、灵巧→招架` | 是 |
| `daily_grind` | damage.ts:9 `洞察→命中、推演→闪避` | 是 |
| `momentum_mastery_buff` | buffs.ts:1772 只 `add_debuff('blade_qi')`，**自身无数值收益** | 否 |
| `inner_power_cost` | buffs.ts:296 只 `apRegenPerSec: -N×0.15`（纯代价） | 否 |
| `overlord_art_buff` | buffs.ts:173 `重器命中+10%` / 否则 `暴击+15%` | 是 |
| `yi_dian_po_xiao_buff` | damage.ts:458 刺击 50% 转穿透 | 是 |
| `tai_chi` | defense.ts:158 `招架率/招架减伤 +0.6%/灵巧`、空手可招架 | 是 |
| `thunder_swift` | buffs.ts:515 `灵巧+1、洞察+1`（上限2层） | 是 |
| `thunder_bonus` | damage.ts:106 附加 `2 雷伤（1 穿透）` | 是 |
| `paralyze_immunity` / `thunder_constitution` | defense.ts:178/189 免麻痹、雷伤-80%/其他-10% | 是 |
| `hui_lei_qian` | buffs.ts:190 雷系招式 `命中+8%` | 是 |
| `baihu_ding` | defense.ts:288 闪避回复 2 缠 | 是 |
| `qi_shield` | defense.ts:10 吸收伤害（炁招2/其他1） | 是 |
| `yin_shi_li_dao` | buffs.ts:112 下次出招 `暴击率+20%` | 是 |
| `stance_armor` | defense.ts:244 `减伤10%`＋免眩晕/击退/缴械/击倒 | 是 |
| `polearm_stance` / `melee_stance` / `fist_stance` | buffs.ts:139/147/155 `命中/招架/闪避 +10%` | 是 |
| `heavy_training` | buffs.ts:663 重器负担-2、`招式AP-0.1` | 是 |
| `tide_power` | buffs.ts:638 每2秒在力/身间挪移4点（`attrMods`） | 是 |
| `min_move_cost` | buffs.ts:481 **无任何数值钩子**（只作移动消耗下限旗标） | 否 |
| `zhu_huo_jue_buff` | buffs.ts:587 受灼烧减半＋施加灼烧层数+1 | 是 |
| `wan_xiang_jian_yi_buff` | buffs.ts:619 按"非永久增益层数"给 `暴伤+5%/层` | 是（条件载体） |
| `stone_skin` | defense.ts:219 `直伤-12%`、灼烧减半 | 是 |
| `qishier_bian` | buffs.ts:694 每6秒轮流 `某属性+6` | 是 |
| `hua_gun_parry` | defense.ts:232 `灵巧×1% 招架，远程加倍` | 是 |
| `feng_mo_gong` | damage.ts:490 叠层 `伤害+1%/层、AP回复+0.03/s/层` | 是 |
| `frost_step_speed` | buffs.ts:416 `移动效率+25%` | 是 |
| `yuxin_sword_mastery` | buffs.ts:741 叠层上限翻倍（`onBuffApply ×2`）但每次叠层耗2缠 | 见需裁定 |
| `lingxi_finger` | defense.ts:257 `力+1/巧+3`、空手格挡、招架25%缴械 | 是 |
| `beiming` 的 `stat_transfer` | buffs.ts:220 每次命中 `推演+1`（同时敌方 `推演-1`） | 是＋给对手负面 |
| `golden_light` | damage.ts:191 受击耗缠减2、攻击耗缠加2 | 是 |

## 明细

| 实体 | 现 tags | 判定 | 理由（引用 effects/triggers/description） | 建议 |
| --- | --- | --- | --- | --- |
| 三分归元气（`forge`） | `qi` `heal` `buff` `defense` `low_hp` | ⚠️ | 描述"全属性提升。濒危时触发「三分归元」，消耗元气大幅回血"；`battle_start` 给 `sangui_yuanqi`（`attrMods` 力/身/巧/洞察+1，真增益 → `buff` 成立），`hp_below <0.3` 触发 `_sangui_heal`（`{type:'heal', ratio:0.2}` → `heal`、`low_hp`、`defense` 成立）。缺 `passive`；`qi` 只在 id/名称层面（"归元气"），机制无炁 | 补 `passive`；`qi` 是否保留见需裁定 |
| 铁布衫（`iron_bone`） | `qi` `buff` `defense` | ⚠️ | 描述"所受直伤-15%"；`battle_start` 给 `iron_defense`（`onTakeDamage ×0.85`）→ `buff`/`defense` 成立。`qi` 无任何依据（描述/effects/triggers 全无炁） | 去掉 `qi`；补 `passive` |
| 极烈之烈（`ji_lie_zhi_lie`） | `passive` `damage` | ⚠️ | 描述"每次受到伤害叠1层「烈」，每层提升暴击率与暴击伤害"；`battle_start` 给 `ji_lie_zhi_lie_buff`（叠层暴击/暴伤，真增益）。`damage` 成立，缺 `buff`（且该 buff 自己的 `tags:['damage']` 也未标 `buff`） | 补 `buff` |
| 灵器共鸣（`spirit_resonance`） | `summon` | ⚠️ | 描述"将自身力道转化为召唤物的攻击力"；构造期 `stat_buff {strength:-2}`（自付代价）＋`battle_start` 给 `spirit_resonance_buff`（召唤招按 `下取整(力道/3)` 增伤）→ `summon` 成立、`buff` 亦成立；缺 `passive` | 补 `passive`、`buff` |
| 御剑诀（`sword_dominion`） | `imperial` `qi` `range_up` | ✅ | 描述"以炁御剑，剑随意动。延长攻击距离"；`sword_dominion` 的 `onRuntimeAction` 加攻距 2（→ `range_up`），`onDealDamage` 按 `√apCost` 附加伤害（→ `buff` 实质增益），御物体系（→ `imperial`）、以炁御剑（→ `qi`）自洽 | 可补 `passive` `buff`（非必需） |
| 绝剑诀（`last_sword`） | `qi` `damage` `low_hp` | ⚠️ | 描述"伤势越重，剑意越强"；`last_stand` 的 `onCritDamage` 用 `1-hp/maxHp` 线性加成 → `damage`/`low_hp` 成立。缺 `buff`、`passive`；`qi` 无描述依据 | 补 `buff` `passive`；`qi` 见需裁定 |
| 居合道（`iaijutsu_mastery`） | `qi` `stance` | ⚠️ | 描述"习得居合斩与纳刀"；`grantsActions:['iaijutsu_strike','resheath']`，`battle_start` 触发 `_iaijutsu_ready` → `add_buff('iaijutsu')`（`tags:['stance']`，且 `resheath` 自带 `stance`）→ `stance` 成立。缺 `passive`；`qi` 无依据（居合为拔刀术） | 补 `passive`；`qi` 见需裁定 |
| 一刀流（`yi_dao_liu`） | `passive` `counter` `slash` | ⚠️ | 描述"招架时顺势反击,斩出顺劈"；`on_parry` → `light_slash`（`requiredTags:['slash']`、`tags:['slash']`）→ `counter`、`slash` 成立。但 `on_parry` 用的槽类型显示为 `on_parried`/`on_parry`，且未标 `trigger`（本条机制完全由触发器实现）；无 `parry` 标签可另议 | 可补 `trigger`（低影响） |
| 龙宫院流（`dragon_palace_style`） | `passive` | ⚠️ | 描述"招架或闪避后蓄势，叠加势"；`on_parry`/`on_dodge` 叠 `shi_buff`（叠层 `暴伤+15%/层`，真增益）→ 缺 `buff`；机制全为 stance-adjacent 的蓄势但并非架势系统（`shi_buff.tags:['damage']`） | 补 `buff`（可选 `trigger`） |
| 极（`extreme`） | `passive` `buff` `chan` | ⚠️ | 描述"缠劲满时获得极状态…每层提升暴击率与暴击伤害"；`chan_overflow` → `add_buff('extreme')`（真增益）→ `chan` 成立、`buff` 可成立。但该 buff 是**溢出条件的载体**（`onCritChance` 里当场 `spendChan(全部)` 并在下一招消费），按 RUBRIC「仅条件载体不算」应去 `buff`；同时触发条件与"低血量"无关，`low_hp` 不适用 | 去 `buff`（或保留并注明为条件增益）；补 `damage` `passive`；`qi` 无依据 |
| 周流不息（`zhou_liu_bu_xi`） | `passive` `buff` `qi` `chan` | ⚠️ | 描述"缠劲满溢时自动凝聚"；`zhou_liu_bu_xi` 按 `onChanOverflow` 溢出量每10点叠1层，给 `炁招命中+10%/层、伤害+10%/层` → `buff`、`chan` 成立；另需 `damage`（增伤）。`qi` 仅出现于 buff 描述（"炁招"），被动本体无炁资源/炁伤，属泛标 | 补 `damage`；`qi` 见需裁定 |
| 人体雷达（`human_radar`） | `buff` | ⚠️ | 描述"获得居合时锁定目标，下次近距离攻击命中提升"；`on_stance` → `add_buff('circle')`（`洞察+2`、4AP+ 招式命中+10%，真增益）→ `buff` 成立。缺 `passive`；`requiredTags:['stance']` 与 buff 实际对"任意 4AP+ 招式"生效存在语义偏差（机制非仅近距离）；无 `stance` 标签（本体不是架势，仅消费 `on_stance`） | 补 `passive`；描述/标签择一修正（`stance` 是否补见需裁定） |
| 冰心诀（`ice_heart`） | `passive` `defense` | ⚠️ | 描述"免疫霜冻，对麻痹、灼烧有50%几率免疫"；`elemental_immunity` 的 `onReceiveDebuff` 分别对 `frost`/`paralyze`/`burn` 返回 0 或 50% 免疫 → `defense` 成立，缺 `buff`（这是真增益状态）；元素侧只"免疫"不施加，`frost` 标与不标两可 | 补 `buff`；`frost` 见需裁定 |
| 冰霜诀（`frost_mastery`） | `passive` `debuff` | ❌ | 描述"命中时概率叠加寒霜，暴击时剑意凝寒"；`on_hit` → `add_debuff('frost', chance 0.5)`（`frost` 定义 `attrMods: 身法-0.5/灵巧-0.5`，给对手负面 → `debuff` 成立），`on_crit` → `chill_blade`（叠层 `伤害+8%/层`，真增益 → 缺 `buff`）。**漏标 `frost`**：本条是全局唯一稳定施加"寒霜"的 passive，却拿到 2 分流派权重之外的标签，抽卡关联会漏 | 补 `frost` `buff`；可补 `damage` |
| 十九停（`nineteen_stops`） | `passive` `buff` `damage` | ⚠️ | 描述"层数越高越易失手。每层提升命中、暴击与暴伤，最多19层"；`nineteen_stops` 叠层给命中/暴击/暴伤（真增益）、`onAction` 里按 `(层/19)²` 概率不叠并每次出手耗1缠 → `buff`/`damage` 成立，缺 `chan`（每次出手消耗1缠劲是硬性资源循环） | 补 `chan` |
| 平平无奇的锻炼（`ordinary_training`） | `passive` `defense` `inherent` | ✅ | 描述"身法提升闪避，灵巧提升招架"；`ordinary_training`（`onDodgeChance/onParryChance` 属性挂钩）→ `defense`/`buff` 成立；`inherent` 与 buff 定义自洽（"日复一日的锻炼"是角色特性，不进随机池）。可补 `buff` | 可补 `buff` |
| 日复一日的训练（`daily_grind`） | `passive` `damage` `inherent` | ⚠️ | 描述"洞察提升命中，推演提升闪避"；`daily_grind` 一半是**防御侧**（`onDodgeChance: 推演×0.004`），标 `damage` 只覆盖了进攻侧；缺 `defense`、`buff`。`inherent` 自洽 | 补 `defense` `buff`；`damage` 保留但语义偏窄 |
| 刃炁精通（`momentum_mastery`） | `passive` `damage` `debuff` `slash` | ❌ | 描述"每层受到伤害+5%。受到治疗时减少一层"——**这是给自己的负面代价**；`momentum_mastery_buff` 的 `onDealDamage` 实际行为是"持刃攻击令**对手**叠 `blade_qi`"，自身无任何数值收益。按 RUBRIC：`debuff` 只给对手上负面才标 → 本条的 `debuff` 错；对对手叠刃炁的收益应是 `buff`（或按 `blade_qi` 的 `debuff` 语义标 `debuff` 但理由不同），且 `blade_qi` 属流血系见 `bleed` | 去 `debuff`（改为 `buff`）；补 `bleed`；`slash` 成立（`requiredTags:['slash']`＋仅持刃触发） |
| 炁蕴绵长（`nei_xi_mian_chang`） | `passive` `buff` | ⚠️ | 描述"每点推演使自身 buff 时长+5%"；`effects:[{type:'buff_duration_mult'...}]`——这是**对已有增益的时长增幅**，本体不施加任何增益状态，按 RUBRIC「仅把 buff 当实现手段/条件载体不算」应去 `buff`（其收益应归 `defense`/泛增益而非 `buff`） | 去 `buff`；可补 `defense`（收益偏防御/续航，需说明） |
| 轮舞月斩（`overlord_art`） | `passive` `damage` | ⚠️ | 描述"长兵轮转，如月之轮舞。每一刀都顺势回旋突进"；`battle_start` 给 `overlord_art_buff`（重器 `命中+10%`/否则 `暴击+15%`，真增益）、`actionEnhancer` 给所有 `slash` 招加 `short_dash`、`grantsActions:['retrieve_blade']`（`tags:['retrieve_weapon']`）→ 缺 `buff`、`polearm`、`retrieve_weapon`、`move` | 补 `buff` `polearm`；`retrieve_weapon`/`move` 可选 |
| 渔阳十八势（`yu_yang_shi_ba_shi`） | `passive` `buff` | ⚠️ | 描述"身法转化感知"；`attr_convert 敏捷→洞察 ×0.3`（构造期永久加洞察，显性正收益）→ `buff` 成立。缺 `defense`（洞察提升招架/命中，属泛收益，低置信） | 可补 `defense`（择一） |
| 一点破晓（`yi_dian_po_xiao`） | `passive` `buff` | ⚠️ | 描述"刺击以点破面，劲力透体"；`yi_dian_po_xiao_buff` 把**刺击招式**伤害 50% 转穿透（`tags:['damage','pierce']`）→ `buff` 成立，缺 `pierce`（效果只对 `pierce` 招式生效）、`damage`、`ignore_parry`（穿透部分无视招架） | 补 `pierce` `damage`；`ignore_parry` 见需裁定 |
| 归元劲（`inner_power`） | `passive` `buff` | ⚠️ | 描述"每点推演提升力道，根骨，身法，灵巧"；`attr_convert 推演→力/根/身/巧 ×0.1`（构造期永久加属性，真增益）→ `buff` 成立；同时 `battle_start` 给 `inner_power_cost`（`apRegenPerSec` 负值，**纯代价**，不算 buff）。缺 `qi`（"内力/归元劲"为炁体系） | 补 `qi` |
| 太极（`tai_chi_mastery`） | `passive` `defense` | ✅ | 描述"每点灵巧提升招架率与招架减伤。空手可招架"；`tai_chi`（`onParryChance`/`onParryReduction`/`onCanParry`）→ `defense` 成立。可补 `buff` `parry` | 可补 `buff` `parry` |
| 疾风迅雷（`godspeed`） | `passive` `buff` `electric` | ⚠️ | 描述"闪避后蓄势；被击中时雷闪反击"；`on_dodge` → `thunder_swift`（灵巧+1/洞察+1，真增益）、`on_was_hit` → `_godspeed_counter`（`tags:['electric','counter']`，`{type:'damage', scaling:{insight:0.2}, piercing:1}`）→ `buff`/`electric` 成立，缺 `damage` `counter`（反击伤害是独立的第二个来源） | 补 `damage` `counter` |
| 雷法（`thunder_art`） | `passive` `buff` `electric` | ⚠️ | 描述"攻击附带雷击伤害，并概率麻痹对手"；`thunder_bonus`（附加 2 雷伤/1 穿透）＋`actionEnhancer` 给空手伤害招追加 `add_debuff('paralyze', chance = min(0.8, apCost×0.05))` → `buff`/`electric` 成立；**给对手叠加麻痹 → 漏 `debuff`**（也应可标 `paralyze`），另有附加伤害可标 `damage` | 补 `debuff` `damage`；`paralyze` 见需裁定 |
| 周氏秘法（`zoldyck_art`） | `passive` `buff` `electric` `inherent` | ✅ | 描述"雷电锻体，免疫麻痹并减免雷系伤害"；`battle_start` 同时给 `paralyze_immunity`＋`thunder_constitution`（雷伤-80%、其他-10%，真增益/防御）→ 四标全部成立；`inherent` 与"周氏秘法"血脉限定自洽（不进随机池）。可补 `defense` | 可补 `defense` |
| 虺雷牵（`hui_lei_qian`） | `passive` `buff` `electric` | ✅ | 描述"所有雷系招式命中+8%"；`hui_lei_qian` 的 `onHitChance` 对 `tags.includes('electric')` 的招式 +8% → `buff`/`electric` 成立（该 buff 自身 `tags:['electric']`） | 无 |
| 白虎定（`baihu_ding`） | `passive` `buff` `defense` `chan` | ✅ | 描述"闪避时回复缠劲"；`baihu_ding` 的 `onDodge` 里 `target.addChan(2)` → `chan` 成立；闪避回资源的续航价值 → `defense` 成立；`buff` 为该增益状态本体 | 无 |
| 炁体源流（`qiti_source`） | `passive` `buff` `qi` `low_hp` | ⚠️ | 描述"濒危时炁体护体吸收炁伤害，并将炁转化为力量、身法和灵巧"；`hp_below <0.2` → `_qiti_awaken`：`cleanse allDebuffs`、`add_buff('qi_shield', stacks:10)`（吸收伤害，防御向真增益）、`add_buff('qiti_awaken_buff')`、`stat_buff` 六维+2 → `qi`/`low_hp` 成立；缺 `defense`（吸收/净化是明确防御机制）、`cleanse` | 补 `defense` `cleanse` |
| 因势利导（`yin_shi_li_dao`） | `passive` `buff` `stance` | ✅ | 描述"进架势时因势利导，下一次出招暴击率增加，暴击后消散"；`on_stance` → `yin_shi_li_dao`（`onCritChance +0.2`，消费于 `on_crit`）→ `buff`/`stance` 成立；与 `requiredTags:['stance']` 自洽 | 无 |
| 转换时刻（`stance_time`） | `buff` `defense` | ⚠️ | 描述"进入架势时罡气护体，5秒内免疫眩晕、击退、打断、缴械、击倒，并减伤10%"；`on_stance` → `stance_armor`（`tags:['super_armor','defense']`，`减伤10%`＋`onReceiveDebuff` 免疫硬控）→ `buff`/`defense` 成立；缺 `super_armor`（buff 定义自带该 tag）、`stance`（完全由 `on_stance` 驱动，与同组条目 `yin_shi_li_dao` 不一致） | 补 `super_armor` `stance` `passive` |
| 行云流水（`weapon_stance`） | `passive` `buff` `stance` | ✅ | 描述"每次切换武器自动进入对应架势"；`on_weapon_change` 按武器 `tags`（`polearm`/`melee`/`unarmed`）切 `polearm_stance`/`melee_stance`/`fist_stance`（各自 `命中/招架/闪避 +10%`，真增益且在 `stance` 系统内）→ 三标成立 | 无 |
| 暗室抓雀功（`dark_room_catch`） | `passive` `defense` | ⚠️ | 描述"身法+2，灵巧+2，洞察降低效果减半"；`stat_buff {agility:2, dexterity:2}`（构造期永久加属性，真增益）＋`insightReductionHalf()` → `defense` 成立（闪避/招架收益），缺 `buff`（明写加属性） | 补 `buff` |
| 越女剑法（`yue_nv_sword`） | `buff` `passive` | ⚠️ | 描述"出剑极快，身随剑走"；`yue_nv_buff` 的 `battle_start` 触发器已被注释（第448行"short dash太op，暂时注释"），当前唯一实际效果是 `actionEnhancer` 给所有含 `damage` 的招加 `short_dash`（位移）。**本体不施加任何增益状态 → `buff` 是空标**（引用已注释） | 去 `buff`；补 `move` `damage` `passive`（`passive` 已有） |
| 不滞于物（`bu_zhi_yu_wu`） | `passive` `buff` | ⚠️ | 描述"按推演附加伤害"；`bu_zhi_yu_wu`（`onDealDamage final + 推演×0.05`，真增益）、`actionEnhancer` 给所有伤害招追加 `pierce` 标记 → `buff` 成立，缺 `damage`、`pierce`（该标记是为"越女剑意"类判定服务，同时也是 `pierce` 流相关系） | 补 `damage` `pierce` |
| 独臂（`one_arm`） | `passive` `debuff` `inherent` | ❌ | 描述"无法双持。运劲更凝练，招式消耗降低1AP（最低1）"；`one_arm_buff` 是 `attrMods:{agility:-2}`＋`onActionCost: -1`——**负面与收益都发生在本体身上**，不是给对手的负面。按 RUBRIC「`debuff`：给对手施加负面状态…给自己上的负面（如自伤代价）不算 `debuff`」→ `debuff` 错标。`inherent` 与"断臂"特性自洽（不进随机池） | 去 `debuff`；可补 `buff`（AP 消耗-1 是净收益，与 `agility -2` 并存）|
| 玄剑秘册（`dark_iron_sword_art`） | `passive` `buff` `heavy` | ⚠️ | 描述"虽无玄门血脉，亦可以炁御物…可减少重器的身法负担，并以剑意施展手上功夫"；`weapon_tag 'unarmed'`（让手上功夫可用）＋`heavy_training`（`重器负担-2`、`招式AP-0.1`，真增益）→ `buff`/`heavy` 成立；**缺 `heavy_reduce`**（`heavy_training.tags:['heavy_reduce']`，本条与 `tide_inner_power` 同为此用途）；描述中的"以炁御物"未给 `qi`/`imperial` | 补 `heavy_reduce`；`qi`/`imperial` 见需裁定 |
| 潮汐炁功（`tide_inner_power`） | `passive` `buff` `qi` | ⚠️ | 描述"每回合交替以力道或身法驱动招式。可化解重器的身法负担（固定-2）"；`tide_power` 的 `attrMods {strength:4, agility:0}` ＋每2秒在力/身间挪移 → `buff`/`qi` 成立（内力潮汐）；**缺 `heavy_reduce`**（`tide_power.tags:['heavy_reduce']`，与描述"化解重器身法负担"直接对应），`effects: []` 为空数组但 triggers 挂载 buff | 补 `heavy_reduce` |
| 神行百变（`shenxing_baibian`） | `passive` `buff` `defense` | ⚠️ | 描述"身法灵动百变，极难捉摸"；构造期 `dodge_mod +0.04`＋`haste: 推演×10`（真增益、防御向）→ `defense` 成立；`battle_start` 的 `min_move_cost`（buffs.ts:481）**没有任何数值钩子**，只是"移动消耗下限"旗标，按 RUBRIC 属实现手段 → `buff` 无对应实体增益 | 去 `buff`（保留 `defense`）；`move` 可选 |
| 玄女剑法（`xuannv_sword`） | `passive` `buff` | ⚠️ | 描述"以巧借力、以奇制胜，灵巧化为力道"；`attr_convert 灵巧→力道 ×0.3（floor）`（构造期永久加力道，真增益）→ `buff` 成立；缺 `damage`（力道提升直接转化为输出，且是"借力制胜"的卖点） | 补 `damage` |
| 铸火诀（`zhu_huo_jue`） | `passive` `buff` `qi` | ⚠️ | 描述"聚炁化火，火中淬炼不伤"；`zhu_huo_jue_buff`：受灼烧伤害减半＋**自己施加的灼烧层数+1** → `buff` 成立、`defense`（减伤向）成立；**缺 `burn`**（`requiredTags:['burn']` 已表明面向火系，"施加灼烧层数+1"是灼烧流核心增益，却拿不到 2 分 `burn` 权重） | 补 `burn` `defense` |
| 万象剑意（`wan_xiang_jian_yi`） | `passive` `buff` `qi` | ⚠️ | 描述"自身每有1层增益buff（不含debuff与永久buff），暴击伤害+5%"；`wan_xiang_jian_yi_buff` 的存在是**计数条件载体**（真正的收益是"按他 buff 层数加暴伤"），按 RUBRIC「仅把 buff 当条件载体不算」→ `buff` 应去；`qi` 无依据（描述/effects 全无炁） | 去 `buff`；补 `damage`；去 `qi` |
| 石肤功（`stone_skin`） | `passive` `defense` `buff` | ✅ | 描述"所受直伤-10%，灼烧伤害减半"；`stone_skin`（`onTakeDamage ×0.88`、`onDebuffTick` 灼烧减半）→ `buff`/`defense` 成立。可补 `burn`（明确针对灼烧） | 可补 `burn` |
| 七十二变（`qishier_bian`） | `passive` `buff` | ✅ | 描述"每6秒轮流使力道、体质、身法、灵巧、洞察、推演提升"；`qishier_bian` 每6秒给某属性 +6（真增益）→ `buff` 成立 | 无 |
| 舞花棍（`hua_gun`） | `passive` `defense` | ✅ | 描述"棍花如屏，可格挡远程攻击。灵巧越高招架远程越强"；`hua_gun_parry` 的 `onParryChance`（普通 `灵巧×1%`、远程 `×2%`）→ `defense` 成立。可补 `buff` `polearm`（`棍` 属长柄） | 可补 `buff` `polearm` |
| 疯魔功（`feng_mo_gong`） | `passive` `buff` | ⚠️ | 描述"招式命中叠1层「疯魔」…每层自身伤害+1%、受到伤害+2%、AP回复+0.03/秒"；`feng_mo_gong` 叠层给增伤/AP回复（真增益）但**同时提高自身受伤**；缺 `damage`、`self_damage`（受击伤害放大属"伤换伤"的负面代价，虽非直接自伤但语义接近） | 补 `damage`；`self_damage` 见需裁定 |
| 踏雪（`frost_step`） | `passive` `buff` | ⚠️ | 描述"踏雪如履平地，身法轻灵"；`frost_step_speed` 只有 `onMoveEfficiency +25%`（真增益）→ `buff` 成立，缺 `move`。**注意**：名称含"雪"但机制与霜冻无关（无 `frost` 状态/冰伤）→ 不应标 `frost`（本条正确未标） | 补 `move` |
| 真假无用心经（`yuxin_sword_mastery`） | `qi` `passive` `buff` `chan` | ⚠️ | 描述"所有可叠层 buff 上限翻倍，但每次叠层消耗缠劲"；`yuxin_sword_mastery` 的 `onBuffApply ×2`＋`onStackGain` 每次消耗 `2缠`（`char.spendChan(cost)`）→ `chan` 成立；但该 buff 是"抬高其他 buff 上限"的**机制载体**，本身不施加增益状态（且有硬代价）→ `buff` 应按 RUBRIC 去掉；`qi` 无依据 | 去 `buff`；去 `qi`（或按需裁定） |
| 灵犀一指（`lingxi_finger`） | `passive` `buff` `defense` | ✅ | 描述"空手入白刃，招架时缴械"；`lingxi_finger`（`力+1/巧+3`、`onCanParry`、`onParry` 25% `disarm`）→ `buff`/`defense` 成立。可补 `unarmed` `parry` | 可补 `unarmed` `parry` |
| 凤舞九天（`feng_wu_jiu_tian`） | `passive` `buff` | ⚠️ | 描述"凤舞九天，翩若惊鸿，来去如风"；`effects: []`、无 triggers，只有 `grantsActions:['feng_hui','feng_fan']`（两个 `tags:['move','pre_action'(,'post_action')]` 的位移招）。**本体不施加任何增益状态 → `buff` 无实物**；机制是位移，漏 `move` | 去 `buff`；补 `move` |
| 北冥神功（`beiming`） | `passive` `buff` `qi` | ⚠️ | 描述"命中时汲取敌方推演 1 点，持续 5 秒"；`on_hit` → `stat_transfer`：`先 enemy.attrs.modify(-1)` 再 `self.attrs.modify(+actual)`（buffs.ts:220 `tags:['buff']`，真增益）→ `buff` 成立；**给对手减推演 → 漏 `debuff`**；`qi` 仅 id/名称依据（北冥为道家炁功），机制本身不涉及炁资源 | 补 `debuff`；`qi` 见需裁定 |
| 金光咒（`golden_light`） | `passive` `buff` `defense` `qi` | ⚠️ | 描述"金光护体，AP上限-1"；`battle_start` 给 `max_ap_mod -1`＋`golden_light`（受击耗缠减2伤、攻击耗缠加2伤，真增益向）→ `buff`/`defense`/`qi`（缠劲/炁体系，`golden_light.tags:['qi','defense','damage']`）成立；缺 `damage`（`onAfterDealDamage` 附加 2 点） | 补 `damage` |
| 剑意淬体（`sword_intent_tempering`） | `passive` `buff` `defense` | ⚠️ | 描述"减免 slash/pierce 伤害，且单次受伤不超过最大生命的一定比例"；`sword_intent_tempering`（`onTakeDamage`：`slash`/`pierce` ×0.9、单次伤害上限 `maxHp×0.3`）→ `buff`/`defense` 成立；**该 buff 自身 `tags:['defense','inherent']`，是血脉特性却未在被动上标 `inherent`（会进随机池）**；可补 `slash` `pierce`（只对这两类减伤） | 补 `inherent`；`slash`/`pierce` 可选 |

## 需裁定（拿不准的）

1. **`debuff` 是否包含"给自己上的中性/收束型负面"**：`one_arm`（`agility -2`）、`momentum_mastery`（"每层受到伤害+5%"）按 RUBRIC §二字面（"给自己上的负面不算 `debuff`"）都是错标，但两者描述文本本身就把这段代价写在"代价"位置，UI 上标 `debuff` 是否属于团队既定约定，需要口径确认。本报告按 RUBRIC 判 ❌。
2. **`qi` 的边界**：`iron_bone`（铁布衫）、`extreme`、`zhou_liu_bu_xi`、`wan_xiang_jian_yi`、`yue_nv_sword`/`xuannv_sword` 等一批武侠类功法的 `qi` 只来自命名/世界观（"内力/元气/剑意"），代码里既无炁资源也无炁伤。若 `qi` 是"炁/内功体系"的宽口径世界观标签则应保留；若按 RUBRIC「与炁相关（炁资源、炁伤害、炁体、以炁驱动）」的机制口径则应大面积删除。本报告按机制口径给 ⚠️，未直接判 ❌。
3. **`yuxin_sword_mastery`（真假无用）的 `buff` 与 `yuxin_sword_mastery` buff 定义**："叠层上限翻倍"对玩家是长期正收益（可堆更高层数），但它同时是"每次叠层耗2缠"的闸门。按 RUBRIC 的"仅条件载体不算"倾向去 `buff`；若判定为"能力上的正收益"则应保留。两边证据都在 `buffs.ts:741-757`。
4. **`nei_xi_mian_chang`（炁蕴绵长）去掉 `buff` 后归哪个 tag**：它只放大已有增益时长（`buff_duration_mult`），既不是 `heal` 也不是 `defense`。若非要给一个“非空”标签，是补 `defense` 还是允许只有 `passive`，需裁定。
5. **`extreme`（极）是否算真增益**：`extreme` buff 由 `chan_overflow` 施加，效果是"缠满时消费全部缠给下次≥5AP招 暴击+1%/缠、暴伤+3%/缠"。属条件性正收益还是条件载体，取决于 RUBRIC §二第 1 条中"叠层增益（层数本身带来数值收益）"是否要求持续存在。本报告倾向"算"，因此未从 `buff` 判 ❌。
6. **`ignore_parry` 的适用范围**：`yi_dian_po_xiao`（50% 伤害转穿透）与 `sword_dominion`（御剑附加伤）都通过 `piercing` 输出绕过招架减免，但都不是"招式无视招架"。是否给 `ignore_parry` 需口径确认。
7. **`parry` / `stance` 是否需要与 `requiredTags` 联动补齐**：`human_radar`、`yin_shi_li_dao`、`stance_time` 都有 `requiredTags:['stance']` 却只有部分带 `stance`；`yi_dao_liu`/`lingxi_finger` 以招架为核心却不带 `parry`。这属于"标签仅用于展示/AI 权重"还是"要求与 requiredTags 一致"，需裁定。
8. **`retrieve_weapon` / `move` / `counter` 这类具体机制标签在功法上的粒度**：`overlord_art` 授予 `retrieve_blade`（含 `retrieve_weapon`）、`godspeed` 带 `_godspeed_counter`（含 `counter`）、`yue_nv_sword`/`feng_wu_jiu_tian` 带位移招。若约定"功法标签描述被动自身效果"则不必补"授予招式的机制标签"；若约定"能查到就算"则应补。本报告按前者低置信标注。


---

## 七、功法 · 下半（后 55 个）

# 功法（被动）后 55 个 tag 审计（passives-b）

> 范围：`src/data/passives/passives.ts` 的 `PASSIVES` 按文件顺序第 56 个（`yi_ma_xin_yuan`）到第 110 个（`ku_chan_shen_gong`）。
> 口径：`docs/_tag-audit/RUBRIC.md`（唯一标准）。判定中引用的 buff 定义见 `src/data/buffs/{buffs,damage,defense}.ts`，触发招式见 `src/data/actions/{internal,support}.ts`。
> 只读审计，未改动 `src/` 任何文件。

## 结论摘要

- 实体数：55
- ❌ 6 条 / ⚠️ 34 条 / ✅ 15 条
- 判定口径补充（本次为保持轻重一致而固定）：**❌** = tag 与机制直接矛盾（标了不存在的机制、机制方向反了、或 `inherent` 造成奖励池过滤错）；**⚠️** = 少标/多标/语义漂移，主要影响 `tagRelevance` 权重与 UI 展示。
- 问题归类：
    - **假 `buff`（本次重点）**：把「给对手上负面」「触发招式」「回血」的实现当成自身增益 —— `yi_ma_xin_yuan`、`tongtian`、`chou_dao_duan_shui`、`tai_shang_yu_fa`、`ling_ao_bu` 共 5 条；其中前 3 条同时漏 `debuff`，`tai_shang_yu_fa` 漏 `heal`。
    - **元素 tag 与机制不符**：`qi_electric_conversion`（`electric` 假、`qi` 漏标）。
    - **漏标「自己施加给对手的负面」**：`dian_xue_passive`（麻痹）、`sword_capture`（缴械）。
    - **漏标反伤/受击反制 `counter`**：`hun_yuan_gong`、`qian_kun_da_nuo_yi`、`ling_ao_bu`。
    - **漏标输出类 `damage`（含暴击/爆伤/连击/穿透）**：`yun_long_san_xian`、`dan_dao_fa_xuan`、`bai_ju_guo_xi`、`jing_luo_chu_jian`、`sword_focus`、`ru_yi_jin`、`karate`、`fei_hua_shou`、`lian_da_mi_jue`、`wolf_hunting`、`no_way_win`、`ling_long_xin_qiao`、`luo_ying_shen_jian`、`rui_qi_jue` 共 14 条。
    - **漏标武器类型（`tagRelevance` 权重 4，直接影响抽卡相关性）**：`slash`（`yun_long_san_xian`）、`unarmed`（`zui_quan`、`karate`）、`thrown`（`li_wu_xu_fa`、`fei_hua_shou`、`lian_da_mi_jue`）。
    - **漏标防御价值 `defense`**：`insight_awareness`、`mingjing_zhishui`、`no_light_wisdom`、`ku_chan_shen_gong`。
    - **`qi` 语义漂移**：多标 7 条（`tongtian`、`no_parry_style`、`yun_long_san_xian`、`bai_ju_guo_xi`、`chou_dao_duan_shui`、`ru_shen_zuo_zhao`、`chan_xin_hui_yan`），漏标 2 条（`qi_electric_conversion`、`autumn_water`）。
    - **其他**：`passive` 标记缺失 7 条；`buff` 借用/缺失 3 条（`gear_shift`、`combat_instinct`、`ningqi_jue`）；`move`/`trigger`/`ignore_parry` 少标若按口径应补，但全文件 110 条功法对这三个 tag 均为 0 处使用（可能属约定性省略，见「需裁定」）。
    - `stance` / `dot` / `summon` / `talent` 轴：本 55 条中 `stance`、`dot`、`talent` 无应标未标或误标（`talent` 由独立文件 `src/data/passives/talents.ts` 承担，本文件不带是对的）；`summon` 仅 `tai_shang_yu_fa` 一条存疑。

## 明细

| 实体 | 现 tags | 判定 | 理由（引用 effects/triggers/description） | 建议 |
| --- | --- | --- | --- | --- |
| 意马心猿（yi_ma_xin_yuan） | `passive` `buff` | ❌ | 引用 buff `yi_ma_xin_yuan`（buffs.ts:975）：`onHitChance: () => 0.05` 已被注释掉（buffs.ts:981），唯一生效钩子是 `onDealDamage → add_debuff 'confuse' 15%`，对自身无任何数值/能力收益，`buff` 是「给对手上负面的实现载体」；description 的「凝神聚气提升命中」在实现里已不存在 | 去 `buff`，补 `debuff` |
| 通天录（tongtian） | `passive` `buff` `qi` | ❌ | buff `tongtian`（damage.ts:174）全部效果是 `add_debuff 'bu_xing'`（80% 概率，降敌命中/闪避/招架/暴击，debuffs.ts:369），对自身零收益 → `buff` 假；缺 `debuff`；description 与 buff（tags 仅 `damage`）均无炁机制 | 去 `buff`·`qi`，补 `debuff` |
| 流风回雪（no_parry_style） | `qi` `buff` `defense` | ⚠️ | buff `no_parry_buff`（buffs.ts:1105）给出「招架率的22%转化为闪避率」，`buff`/`defense` 与实现一致；但 description 与 buff 均无炁（buff tags 为空），`qi` 无依据；本条是功法却缺 `passive` | 去 `qi`，补 `passive` |
| 云龙三现（yun_long_san_xian） | `qi` `buff` | ⚠️ | buff `draw_sword_combo_buff`（buffs.ts:1118）自带 `slash`，且 `onAction`/`onDealDamage` 都先判 `source.tags.includes('slash')`、交替斩击叠增伤并附加（身法+灵巧）伤害 → 核心武器类型是斩击、机制是增伤，`slash`/`damage` 均未标；`qi` 无依据（buff 无 qi） | 去 `qi`，补 `slash`·`damage` |
| 单刀法选（dan_dao_fa_xuan） | `passive` `buff` | ⚠️ | trigger `on_dodge → add_buff 'jing_ji'`（buffs.ts:130，下一击暴击率+25%）确为真实增益；按口径「暴击」属 `damage` 输出提升，未标 | 补 `damage` |
| 太上御法（tai_shang_yu_fa） | `passive` `buff` `qi` | ❌ | 全条无任何 `add_buff`：唯一 trigger 是 `on_summon_hit → actionId '_tai_shang_heal'`，该 action（internal.ts:499）唯一效果是 `{ type:'heal', value:1 }`，自带 tags `trigger`/`heal`/`internal` → 这是回血不是增益，`buff` 假且 `heal` 漏标 | 去 `buff`，补 `heal`（`summon`/`imperial` 见需裁定） |
| 白驹过隙（bai_ju_guo_xi） | `qi` `buff` | ⚠️ | buff `bai_ju_guo_xi_buff`（damage.ts:346）在 3 米内按身法加 3% 爆伤，是 `damage` 机制却未标；`qi` 无依据（buff tags 为 `buff`/`damage`）；另缺 `passive` | 去 `qi`，补 `damage`·`passive` |
| 抽刀断水（chou_dao_duan_shui） | `qi` `buff` | ❌ | buff `chou_dao_duan_shui_buff`（damage.ts:358）唯一效果是 `onCritical → target.reduceAp(1)` 且「回复重新起算」，收益全部由对手承担（负面）；自身无收益 → `buff` 假，缺 `debuff`；`qi` 无依据 | 去 `buff`·`qi`，补 `debuff` |
| 经络初鉴（jing_luo_chu_jian） | `passive` `buff` | ⚠️ | buff `jing_luo_chu_jian`（buffs.ts:1295）每点洞察+1%暴击，是真实增益；但暴击属 `damage` 输出提升，未标 | 补 `damage` |
| 灵枢真解（dian_xue_passive） | `passive` `debuff` | ⚠️ | buff `ling_xu_zhen_jie`（buffs.ts:1405）「招式30%概率造成2层麻痹」，`debuff` 方向正确、也没有误标 `buff`；但具体控制效果 `paralyze` 未标（description「点穴封脉」即指此） | 补 `paralyze` |
| 例无虚发（li_wu_xu_fa） | `passive` `buff` | ⚠️ | buff `li_wu_xu_fa`（buffs.ts:182）只在 `source.tags.includes('thrown')` 时给命中+50%，核心形态是暗器，`thrown` 未标 | 补 `thrown`（全文件功法 0 处使用，见需裁定） |
| 醉拳（zui_quan） | `passive` `buff` `jiu` | ⚠️ | `buff`（`zui_quan_dodge`，defense.ts:367：身法×0.6%闪避、有酒劲时×1.2）与 `jiu` 均成立；但 `actionEnhancer` 只对 `def.tags.includes('unarmed')` 的招式前置 `short_dash`，即空手+冲刺机制，`unarmed`/`move` 未标 | 补 `unarmed`·`move` |
| 九阳神功（jiu_yang_shen_gong） | `passive` `buff` | ✅ | battle_start → buff `nei_xi_peng_pai` 2.5 层（buffs.ts:1471：每层 AP 恢复速度+10%），是持续数值正收益，`buff` 成立 | 无需调整 |
| 混元功（hun_yuan_gong） | `passive` `qi` `defense` | ⚠️ | buff `hun_yuan_gong_buff`（defense.ts:615）近身受>8点或炁伤时「反伤所受一半 + 击退」，并 `spendChan` 消耗缠劲；description 明确写「反伤并击退对手」，但 `counter`/`knockback`/`chan` 均未标（`qi` 可保留：条件里明确含炁伤害） | 补 `counter`·`knockback`·`chan` |
| 醉里乾坤（qian_kun_da_nuo_yi） | `passive` `defense` `jiu` | ⚠️ | buff `qian_kun_fan_tan`（defense.ts:380）受击 10% 概率消耗等量缠劲反弹（上限 4+醉酒层）→ 反伤即 `counter`，且以缠劲为消耗资源；`defense`/`jiu` 成立 | 补 `counter`·`chan` |
| 怒炁充盈（sword_focus） | `passive` `buff` | ⚠️ | buff `sword_focus`（buffs.ts:1169）落空叠层、`onCritDamage` 每层+50% 爆伤、暴击后清空，是真实叠层增益；爆伤属 `damage`，未标 | 补 `damage` |
| 醉仙望月步（drunken_step） | `passive` `defense` `buff` `jiu` | ✅ | buff `drunken_step`（defense.ts:427）按醉酒层数给 6%闪避/层，`defense`/`buff`/`jiu` 与实现一致 | 无需调整 |
| 凝炁诀（ningqi_jue） | `passive` `qi` `inherent` | ⚠️ | `effects` 是 `stat_buff` 全属性+1、`actionEnhancer` 令全招带炁，确为数值正收益却未标 `buff`；`qi`（「以炁劲贯通全身」）与 `inherent`（description 明写「血脉限定」、reward-pool.ts:89 过滤）均正确 | 补 `buff` |
| 锐炁诀（rui_qi_jue） | `passive` `buff` `qi` | ⚠️ | buff `rui_qi_jue`（damage.ts:475，自带 `damage`/`qi`）把带炁招式 30% 伤害转穿透；`buff`/`qi` 成立，但 description 明说「无视招架与减伤」而 `ignore_parry` 未标，且缺 `damage` | 补 `damage`·`ignore_parry` |
| 无刀取（sword_capture） | `buff` `defense` | ⚠️ | `effects` 给 +1 触发槽；buff `sword_capture`（defense.ts:520）招架率+10%、招架成功 25% 概率缴械对手 → `buff`/`defense` 成立；缴械是给对手的负面（`debuff` 未标），且本条缺 `passive` | 补 `debuff`·`passive` |
| 如意劲（ru_yi_jin） | `passive` `buff` `chan` | ⚠️ | buff `ru_yi_jin`（damage.ts:374）暴击时耗 3 缠把灵巧×3% 转爆伤，`buff`/`chan` 成立；爆伤属 `damage` 未标 | 补 `damage` |
| 血战到底（blood_rage） | `passive` `buff` `low_hp` | ✅ | buff `blood_rage`（buffs.ts:1219）按血量 <60%/<25% 分档加力/身/巧，越残越强，`low_hp`+`buff` 与实现一致 | 无需调整 |
| 挂挡（gear_shift） | `passive` `buff` `chan` | ⚠️ | 本条自身无 `effects`/`triggers`，只有 `grantsActions:['gear_hang']`；真正的增益 `gear_shift_buff`（buffs.ts:1482，每层 AP 恢复+0.1/s）由所授招式「挂」施加，不是本条施加 | `buff` 见需裁定；`chan`（招式 chanCost 20，support.ts:100）正确 |
| 神照经（shen_zhao_jing） | `passive` `buff` `low_hp` | ✅ | buff `shen_zhao_jing`（buffs.ts:1249）AP 回复随血量下降而升高（封顶+0.4/s），`low_hp`+`buff` 一致（description 写 +0.5/s 与实现 0.4 有出入，属数值文案问题，非 tag） | 无需调整 |
| 空手道（karate） | `passive` `buff` | ⚠️ | buff `karate`（buffs.ts:265）只在 `source.tags.includes('unarmed')` 时生效（伤害×1.08、AP-0.2），即空手专属增伤，`unarmed`/`damage` 均未标（description 写 +10%/-0.5AP 与 buff 的 +8%/-0.2 也不一致） | 补 `unarmed`·`damage` |
| 漫天花雨（fei_hua_shou） | `buff` | ⚠️ | buff `fei_hua_shou`（buffs.ts:248）只在 `thrown` 招式上 `getExtraAttack:2` 并 AP-30%，属暗器连击增伤，`thrown`/`damage` 未标，亦缺 `passive` | 补 `thrown`·`damage`·`passive` |
| 练打秘诀（lian_da_mi_jue） | `buff` `chan` | ⚠️ | buff `lian_da_mi_jue`（buffs.ts:283）只对 `thrown` 招式附加灵巧×0.04（耗 1 缠后 ×0.08）伤害，`chan` 成立；`thrown`/`damage` 未标、缺 `passive` | 补 `thrown`·`damage`·`passive` |
| 毒药大师（du_yao_da_shi） | `passive` `inherent` `poison` | ✅ | buff `du_yao_da_shi`（buffs.ts:1437）只放大「施毒」（按自身暴击率多叠 1 层毒），不给自己增益，故不带 `buff` 是对的；`poison` 与 `inherent`（唐门世家＝血脉限定）与过滤逻辑一致 | 无需调整 |
| 舍得心法（sekai_heroism） | `passive` `buff` | ✅ | `effects` 为 `stat_buff`：根骨-2 换力道/身法/灵巧/洞察各+2，净收益为正，`buff` 成立；自减属性按口径不属 `debuff` | 无需调整 |
| 本能特训（combat_instinct） | `passive` `buff` | ⚠️ | 全条无任何 buff 施加，`effects` 是 `trigger_slot_mod`（每 5 洞察+1 触发槽）——增益来自触发器槽而非状态，`trigger` 未标 | 补 `trigger`；`buff` 见需裁定 |
| 先觉功（insight_awareness） | `passive` `buff` | ⚠️ | buff `insight_awareness`（defense.ts:538）按洞察给招架率+0.6%/点、闪避率+0.3%/点，是防御数值却未标 `defense` | 补 `defense` |
| 苍狼劲（wolf_hunting） | `passive` `buff` `chan` | ⚠️ | buff `wolf_hunting_buff`（damage.ts:308，自带 `damage`）耗 2 缠附加（力道+根骨+身法+灵巧）×5% 伤害，`chan` 正确；`damage` 未标 | 补 `damage` |
| 无招胜有招（no_way_win） | `passive` `buff` | ⚠️ | buff `no_way_win_buff`（damage.ts:439，自带 `damage`）只在 `triggered` 时伤害×1.25，是触发招式增伤：`damage`/`trigger` 均未标 | 补 `damage`·`trigger` |
| 玲珑心窍（ling_long_xin_qiao） | `passive` `buff` `inherent` | ⚠️ | buff `ling_long_xin_qiao_buff`（damage.ts:449，自带 `damage`）每点推演+1.5%暴击，`buff` 成立；`damage` 未标；`inherent` 依据见需裁定 | 补 `damage` |
| 秋水论（autumn_water） | `passive` `buff` | ⚠️ | buff `autumn_water_tide`（buffs.ts:325）在灵巧/洞察间每 2 秒挪移 1 点并+10% 移动效率，`buff` 成立；buff 自带 `qi` 而本条未标 | 补 `qi` |
| 不动明王（bu_dong_ming_wang） | `passive` `defense` `chan` | ✅ | buff `bu_dong_ming_wang_buff`（defense.ts:502）招架成功时耗 1 缠额外减免 3 点，`defense`/`chan` 与 description 一致 | 无需调整 |
| 移经易脉（ni_zhuan_jing_mai） | `passive` `defense` `counter` | ✅ | buff `ni_zhuan_jing_mai`（defense.ts:547）70% 概率抗麻痹、被暴击减伤 30%；另有 trigger `on_was_crit → '_generic_counter'`（internal.ts:104，自带 tags 含 `counter`），`defense`/`counter` 均与实现一致 | 无需调整 |
| 灵鳌步（ling_ao_bu） | `passive` `buff` `unarmed` | ❌ | 全条无 `add_buff`：trigger `on_dodge → '_ling_ao_chong'`，该 action（internal.ts:462）tags 为 `trigger`/`internal`/`unarmed`/`blunt`/`melee`，效果 `short_dash` 冲撞+伤害+60% 概率麻痹 → `buff` 假（`unarmed` 正确）；缺 `paralyze`、`counter`（闪避后反制）、`move`（冲刺） | 去 `buff`，补 `paralyze`·`counter`·`move` |
| 落英神剑（luo_ying_shen_jian） | `passive` `buff` `qi` | ⚠️ | buff `luo_ying_shen_jian_buff`（damage.ts:253，自带 `buff`/`qi`）寄存 20% 伤害、暴击双倍引爆，`buff`/`qi` 成立；这是纯伤害机制却缺 `damage` | 补 `damage` |
| 超强感知（enhanced_vision） | `passive` `buff` `defense` | ✅ | `effects` 为 `stat_buff` 洞察+4，buff `enhanced_vision_buff`（defense.ts:561）招架时按洞察减伤，`buff`/`defense` 与实现一致 | 无需调整 |
| 炁电转换（qi_electric_conversion） | `passive` `buff` `electric` `craft` | ❌ | buff `qi_electric_buff`（buffs.ts:1550）只按身上 `craft`/`implant` 装备数与推演给力道/身法/灵巧，没有任何电系伤害或麻痹/感电状态（description 也只说属性提升）→ `electric` 与机制不符、会把电系 build 的抽卡权重错误拉高；反之 description「以炁驱动装备」的 `qi` 未标 | 去 `electric`，补 `qi` |
| 千锤百炼（qian_chui_bai_lian） | `passive` `buff` `defense` `inherent` | ✅ | buff `qian_chui_bai_lian_buff`（buffs.ts:605）自身受灼烧-30% 属减伤，`defense`/`buff` 成立；`effects` 的 `attr_convert` 根骨化力道是数值正收益；`inherent`（天工特性 + 事件授予 branch.ts:551）与 `reward-pool.ts:89` 过滤一致 | 无需调整 |
| 无明之明（no_light_wisdom） | `passive` `buff` | ⚠️ | `effects` 洞察-4，但 buff `no_light_buff`（buffs.ts:1612）以推演换命中/闪避/招架/暴击并免疫迷眼，净收益为正，`buff` 成立；闪避/招架/免疫属防御价值，`defense` 未标 | 补 `defense` |
| 入神坐照（ru_shen_zuo_zhao） | `passive` `buff` `qi` | ⚠️ | buff `shen_zhao`（buffs.ts:1628）累计消耗 AP 分档+洞察（最多+6）、满档后免疫洞察减益，`buff` 成立；但 description 与 buff（tags 仅 `buff`）均无炁，`qi` 无依据 | 去 `qi`（免疫减益可否算 `defense` 见需裁定） |
| 听劲（hearing_power） | `passive` `buff` | ⚠️ | trigger 是无过滤的 `on_hit`（engine.ts:821 对所有命中发射），buff `hearing_insight`（buffs.ts:1673，洞察+2、1.5 秒）因此在任何武器命中都生效，与 description「每次徒手击中」不符；`buff` 本身成立 | 见需裁定（补 `unarmed` 或改文案） |
| 明镜止水（mingjing_zhishui） | `passive` `buff` | ⚠️ | buff `mingjing_zhishui_buff`（buffs.ts:1694）60% 概率抵抗失心/迷惑并令招式 AP 消耗-15%，`buff` 成立；「免疫负面」属防御价值，`defense` 未标 | 补 `defense` |
| 残影步（can_ying_bu） | `passive` `buff` | ⚠️ | buff `can_ying_bu_speed`（buffs.ts:435，移动效率+15%）与 `xu_ying`（buffs.ts:1714，每层+5%闪避）均为真实增益，`buff` 成立；本条完全由 `on_move_away`/`on_move_closer` 驱动，`move` 未标 | 补 `move` |
| 奇门八卦（ba_gua_gun_fa） | `passive` `buff` | ⚠️ | buff `ba_gua_bu`（buffs.ts:1723）每层+3%闪避/+5%暴击，`buff` 成立；层数只由移动事件叠加而 `move` 未标 | 补 `move` |
| 观自在眼（guan_zi_zai_yan） | `passive` `buff` `low_hp` | ✅ | buff `guan_zi_zai_yan`（buffs.ts:1258）按血量 <70%/<30% 分档加洞察/推演，越残越强，`low_hp`+`buff` 与 description 一致 | 无需调整 |
| 易筋经（yi_jin_jing） | `passive` `buff` | ✅ | `effects` 为 `stat_buff` 根骨+2、推演+2，`buff` 与实现一致 | 无需调整 |
| 玄武定（chanzi_chan_regen） | `passive` `buff` `chan` | ✅ | buff `chanzi_chan_regen`（buffs.ts:1814）每秒回 0.5 缠，资源持续回复属正收益，`buff`/`chan` 成立（description 写「每秒1点」与实现 0.5 有出入，属数值文案问题） | 无需调整 |
| 朱雀定（chan_ding） | `passive` `buff` `defense` `chan` | ✅ | buff `chan_ding_buff`（defense.ts:747）受击回复 2 点缠劲，`chan`/`buff` 与 description 一致 | 无需调整 |
| 青龙定（qing_long_ding） | `passive` `buff` `chan` | ✅ | buff `qing_long_ding_buff`（defense.ts:766）暴击时回复 5 点缠劲，`chan`/`buff` 与 description 一致 | 无需调整 |
| 禅心慧眼（chan_xin_hui_yan） | `passive` `buff` `qi` | ⚠️ | buff `chan_xin_hui_yan_buff`（buffs.ts:1824）按推演加命中/暴击，`buff` 成立；`qi` 在 description 与 buff（tags 仅 `buff`）中均无依据 | 去 `qi` |
| 枯蝉神功（ku_chan_shen_gong） | `passive` `buff` `chan` `low_hp` | ⚠️ | buff `ku_chan`（buffs.ts:1835）致死后无效该次伤害并耗尽缠劲，蜕壳 `ku_chan_tuo_ke`（buffs.ts:1867）免疫一切 DOT；`buff`/`chan`/`low_hp` 均成立，但「无效致死伤害+免疫 DOT」是防御价值，`defense` 未标 | 补 `defense` |

## 需裁定（拿不准的）

1. **`inherent` 的边界**：`tai_shang_yu_fa` 的 description 是「玄门祖传御法」，与已标 `inherent` 的 `ningqi_jue`（「药屋家传呼吸法，血脉限定」）同构，但当前未标 `inherent`，会进随机奖励池（`reward-pool.ts:89`）。同类还有只在单一对手处授予的 `zui_quan`（无志）、`ku_chan_shen_gong`（阿九）、`guan_zi_zai_yan`（姬然/拉月）、`ling_ao_bu`、`luo_ying_shen_jian` 等 —— 但这些功法同时出现在对手的 `rewards` 里（如 `wuzui.ts:21`、`ajiu.ts:24`），说明「可经击败对手获得」是既定设计，是否还要排除随机池需设计确认。
2. **`ling_long_xin_qiao` 的 `inherent`**：其 buff 是一次性数值增益（每点推演+1.5%暴击），却被标记 `inherent` 永久排除随机池；它同时授予 `xunxiang.ts:22` 与 `haoran.ts:25` 两名角色，「特性/血脉限定」的依据需确认。
3. **`gear_shift` 的 `buff`**：本条不施加任何状态，增益 `gear_shift_buff` 由所授招式「挂」产生。若按「本条自身是否给角色增益」严格判，应去掉 `buff`；若按「功法带来的收益链」判则保留。同类：`combat_instinct` 的 `buff` 只由 `trigger_slot_mod` 实现（无 buff 参与），口径需统一。
4. **`thrown` 的系统性缺失**：全文件 110 个功法 0 处使用 `thrown`，但 `li_wu_xu_fa`、`fei_hua_shou`、`lian_da_mi_jue` 只对 `thrown` 招式生效；若 `thrown` 是刻意留给武器/招式的约定，则这三条属约定性省略。
5. **`move` / `trigger` / `ignore_parry` 的系统性缺失**：这三个 tag 在 110 个功法中同样 0 处使用。本次按 RUBRIC 逐条建议补标（`zui_quan`/`can_ying_bu`/`ba_gua_gun_fa`/`ling_ao_bu` 的 `move`；`no_way_win`/`combat_instinct` 的 `trigger`；`rui_qi_jue` 的 `ignore_parry`），若属约定性省略可整体忽略。
6. **`hearing_power` 的触发范围**：description 写「每次徒手击中」，实现是无过滤的 `on_hit`（`engine.ts:821` 对任何命中发射，含召唤物），文案与实现不一致；应补 `unarmed` 还是修文案待定。
7. **`bai_ju_guo_xi` 的形态 tag**：buff 要求「距对手 3 米内」（damage.ts:353），是否应视为 `melee` 类形态 tag（功法中 `melee` 仅 1 处使用）。
8. **`ru_shen_zuo_zhao` 的 `defense`**：满 3 档后免疫一切洞察减益，是否按「免疫」补 `defense`。
9. **「缺 `damage`」的覆盖面**：按 RUBRIC「暴击」也计入 `damage`，本次共 14 条被列为漏标；但全文件 110 个功法仅 10 处使用 `damage`，是否属约定性省略（即 `buff` 已足够表达）需确认。
10. **`tai_shang_yu_fa` 是否属 `summon`/`imperial`**：其 trigger 条件为 `on_summon_hit`（只对召唤物命中生效，engine.ts:823），收益为自身回血；补 `summon` 还是 `imperial` 需确认。


---

## 八、招式 · 近战/炁/空手

# 招式（动作）tag 审计 · A 组：melee / qi / unarmed

## 结论摘要

- 实体数：**56**（`src/data/actions/melee.ts` 24 + `src/data/actions/qi.ts` 8 + `src/data/actions/unarmed.ts` 24）
- ❌ 3 条 / ⚠️ 39 条 / ✅ 14 条
- 问题归类：
  - **少标 `melee`（系统性，约 20 招）**：`engine.ts:827` 按 **招式自身的 `melee` tag** 决定是否发 `on_melee`，缺标 → 被近身命中时「被近身命中时」触发器不响应（`triggerDisplay.ts:42` 暴露该触发条件）；同时 `melee` 是权重 4 的核心武器类型 tag（`tagRelevance.ts`），缺标也会让这些招在近战 build 的奖励权重里被低估。
  - **控制类标签漏标（12 处）**：`stun`（手刀、叁炁弹）、`paralyze`（点穴、侧踢、玉箫剑法）、`knockdown`（无影拳、无影脚、扫腿、裸绞）、`knockback`（推掌）。
  - **元素/流派漏标（1 处）**：`frost`（吹雪剑法，效果 `add_debuff frost` 明写）。
  - **显式效果对应标签漏标**：`ignore_parry`（炁刃、贰炁弹、碧落剑法、顺水推舟）、`dot`（裸绞，窒息每秒伤害）、`debuff`/`buff` 泛类（迅雷剑法·迷眼、六阳掌·迷惑、黯然销魂掌·失心、折梅手·汲取消减、春竹剑法·回春、云隐剑法·云隐）。
  - **形态标签与机制矛盾（1 处）**：燎天裂地势同时带 `melee` + `range`，但 `self_disarm dropAt:'opponent'` 是脱手投掷，缺 `thrown`。
  - **requiredTags 自洽问题（1 处）**：玉箫剑法 tags 宣称 `blunt`（权重 4），requiredTags 却只有 `['melee']`，钝器/长兵体系（齐眉棍、玄铁重剑、引擎铁锤、陨铁神珍均无 `melee` tag）永远拿不到，属错误关联 + 错误过滤。
- 正面对照（本次重点核对无误）：
  - **`buff` 方向全部正确**：范围内所有 `add_buff` 引用的 buff 都去 `src/data/buffs/` 核对过，均为真实正收益（`gentle_stance`/`vigor_stance` attrMods、`thunder_swift` attrMods、`chill_blade` 增伤、`bamboo_regen` 回血、`yun_yin` 闪避、`you_shen` attrMods、`stat_multiply` 属性倍增），**没有「只当实现手段/标记却标了 buff」的条目**。
  - 迅雷剑法名字带「雷」、只挂 `sand_blind`+`thunder_swift`（属性增益），无电伤/麻痹，**未误标 `electric`**，正确。
  - `self_damage` 仅铁山靠（`self_damage ratio:0.01`）标注，正确；`low_hp` 仅黯然销魂掌（`self_missing_hp_damage`，己方越残越强）标注，正确。
  - `chan` 与 `chanCost` 一一对应（heavy_slash 10 / sky_burner 22 / yi_hui 30 / follow_the_current 20 / crushing_blow 20 / desolate_palm 20 / eighteen_palms 18 / spinning_kick 25 / three_inch_light 20 / ru_lai_shen_zhang 20 / qi_gather 无但属前置），无误标漏标。
  - `pre_action` 分类正确：范围内只有聚炁带 `pre_action`，与 `support.ts` 中「自身增益前置招」口径一致（`#executeSupport` 要求 `pre_action`/`post_action` 才可作为辅助招执行，`engine.ts:851`）；普通伤害招均未误带 `pre_action`/`post_action`。

> 机制依据：`engine.ts:827-828`（action.tags 决定 `on_melee`/`on_range`）、`engine.ts:851`（辅助招必须带 pre/post）、`support-planner.ts:71-79`（招式 tag 参与 AI 辅助优先级）、`tagRelevance.ts`（权重 4/2/0）、`buffs.ts:1781`（`qi_action` 的带刃判定只认 `slash`/`pierce`）。

## 明细

| 实体 | 现 tags | 判定 | 理由（引用 effects/description） | 建议 |
| --- | --- | --- | --- | --- |
| 寸芒（cun_mang） | `pierce` | ⚠️ | 只有 `damage`（str/dex 0.2，piercingRatio 0.1），`pierce` 正确；description「顺势反击」但**无 counter 类效果**，故不标 `counter` 正确，属文案问题。 | 补 `melee`；文案去掉「反击」或补反击机制 |
| 九死剑法（nine_deaths_strike） | `pierce` | ⚠️ | 纯 `damage`（str/agi 0.6），`pierce` 正确；description「以身为剑，不避锋芒」无自伤/卖血机制，**不标 `self_damage` 正确**。 | 补 `melee` |
| 无假剑法（quanzhen_sword） | `pierce` `melee` `buff` | ✅ | `add_buff gentle_stance`（柔劲：敏捷+4/力道-2，20s，叠 2 层）是真实增益，`buff` 正确；pierce+melee 与武器一致。 | 无需调整（description「以力破巧」却给「柔劲」，文案待修） |
| 流萤剑法（yunv_sword） | `pierce` `melee` `buff` | ✅ | `add_buff vigor_stance`（刚劲：力道+4/身法-2）真实增益；pierce+melee 一致。 | 无需调整（description「灵动如烟」却给「刚劲」，文案待修） |
| 玉箫剑法（yu_xiao_jian_fa） | `melee` `blunt` `pierce` `debuff` | ❌ | 效果 `add_debuff paralyze` + `duan_qi`，`debuff` 正确；但 tags 宣称 `blunt`（权重 4，齐眉棍/玄铁重剑/引擎铁锤体系会把它算作同源），requiredTags 却只有 `['melee']`，而这些钝器均无 `melee` tag → **永远抽不到/用不了**，属错误关联+错误过滤；另漏 `paralyze`（「点穴封脉」）。 | requiredTags 改 `['pierce','blunt']`（或至少补 `blunt`）；补 `paralyze` |
| 迅雷剑法（swift_thunder_sword） | `pierce` `melee` `buff` | ⚠️ | `add_buff thunder_swift`（灵巧+1 洞察+1）真实增益，`buff` 正确；但 `add_debuff sand_blind 0.5`（迷眼）**漏 `sand_blind`/`debuff`**；名字带雷但无电伤，未标 `electric` 正确。 | 补 `sand_blind`（或至少 `debuff`） |
| 吹雪剑法（blowing_snow_sword） | `pierce` `melee` `buff` | ❌ | 效果 `add_debuff frost stacks:2`（霜冻：身法/灵巧-0.5）是明确的霜冻流派效果，**漏 `frost`**（权重 2 流派，影响奖励关联与 UI 关联），同时漏 `debuff`；`chill_blade`（每层伤害+8%）为真实增益，`buff` 正确。 | 补 `frost`、`debuff` |
| 春竹剑法（spring_bamboo_sword） | `pierce` `heal` `melee` | ⚠️ | `add_buff bamboo_regen`（每 2s 回血，30s）是真实持续回复，`heal` 正确；但漏 `buff`（同族其它剑法均标 `buff`），且该 buff 本身在 `buffs.ts` 即带 `heal`,`buff`。 | 补 `buff` |
| 云隐剑法（cloud_hidden_sword） | `pierce` `melee` | ⚠️ | `add_buff yun_yin`（每层闪避+5%，叠 2 层）是真实增益，**漏 `buff`**。 | 补 `buff` |
| 碧落剑法（fall_to_azure_sword） | `pierce` `range` `chan` | ⚠️ | `chanCost MAX_CHAN`→`chan` 正确；`getRange [0,10]` + 必中→`range` 正确；但效果列表首个即 `{type:'ignore_parry'}`，**漏 `ignore_parry`**（UI「破招」与关联缺失）。 | 补 `ignore_parry` |
| 螺旋刺击（pursuit_thrust） | `bleed` `pierce` | ⚠️ | `add_debuff bleed 0.2`→`bleed` 正确；缺 `melee`（武器射程内近战刺）。 | 补 `melee` |
| 暴烈刺击（thrust） | `bleed` `pierce` | ⚠️ | 同上，`add_debuff bleed 0.3`→`bleed` 正确；缺 `melee`。 | 补 `melee` |
| 一辉（yi_hui） | `pierce` `qi` `melee` `chan` | ✅ | `short_dash`+高倍率穿透伤害；description「以自身炁感知对手炁」→`qi` 成立；chanCost 30→`chan`；range[0,3]+melee 自洽。 | 无需调整（`hookNotes.hitChance` 写「低于 30% 时暴击+30%」，代码实为 <50% 必中且暴击固定 +20%，文案待修） |
| 顺劈（light_slash） | `slash` | ⚠️ | 纯 `damage`，`slash` 正确；武器射程近战但缺 `melee` → 不发 `on_melee`、近战权重被低估。 | 补 `melee` |
| 蓄力斩（heavy_slash） | `slash` `chan` | ⚠️ | `chanCost 10`→`chan` 正确；缺 `melee`。 | 补 `melee` |
| 切割（gash） | `bleed` `debuff` | ⚠️ | `add_debuff bleed 0.3`→`bleed` 正确；但 requiredTags 为 `['slash']` 而 tags 里**既无 `slash` 也无 `melee`**（description「匕首划过」），标签与自身武器体系不自洽。 | 补 `slash`、`melee` |
| 旋斩（spinning_slash） | `slash` | ⚠️ | 纯 `damage`（fixed 2），`slash` 正确；缺 `melee`。 | 补 `melee` |
| 旋风斩（cyclone_slash） | `slash` | ⚠️ | `independentHits: 2` 两段独立伤害，`slash` 正确；缺 `melee`。是否补 `damage`（显著提升输出）见「需裁定」。 | 补 `melee` |
| 燎天裂地势（sky_burner） | `slash` `melee` `range` `chan` | ❌ | 机制是「顺势脱手」：`self_disarm {dropAt:'opponent'}` 把兵器掷向对手所在位置，本质是投掷攻击，却同时挂 `melee`+`range`，会**对同一次投掷同时发 `on_melee` 与 `on_range`**，且漏 `thrown`（对照 `internal.ts` 暴雨梨花 `['pierce','range','thrown','chan']`）。 | 去 `melee`，补 `thrown`（保留 `range`/`slash`/`chan`） |
| 炁斩（qi_slash） | `slash` `qi` | ⚠️ | `getRange: wr[1]+1`（武器范围+1）+wisdom 0.2 缩放，`qi` 正确（wisdom=炁效果属性）；缺 `melee`。 | 补 `melee` |
| 烈火（blaze_strike） | `slash` `pierce` `burn` | ⚠️ | `add_debuff burn stacks:2`→`burn` 正确；缺 `melee`（射程+1 的隔空斩）。 | 补 `melee` |
| 横斩（horizontal_slash） | `slash` | ⚠️ | 纯 `damage` + 命中+10%，`slash` 正确；缺 `melee`。 | 补 `melee` |
| 挑斩（rising_slash） | `slash` | ⚠️ | 纯 `damage` + 暴击+10%，`slash` 正确；缺 `melee`。 | 补 `melee` |
| 顺水推舟（follow_the_current） | `slash` `chan` | ⚠️ | `chanCost 20`→`chan` 正确；效果含 `{type:'ignore_parry'}`，**漏 `ignore_parry`**；range[0,2] 近身却缺 `melee`。 | 补 `ignore_parry`、`melee` |
| 聚炁（qi_gather） | `buff` `pre_action` | ✅ | `target:'self'` + `stat_multiply strength×2`（handler 会建 `stat_multiply` 层，时长按推演×150ms），是真实属性增益→`buff` 正确；自增益前置招标 `pre_action` 与 `support.ts` 全部前置招口径一致，`#executeSupport` 才可执行。 | 无需调整 |
| 元炁弹（qi_bolt） | `qi` `range` `qi_action` | ✅ | wisdom 0.4 缩放 + `getRange [2,6]`；`qi_action` 正确（纯炁凝聚、无刃故不带 slash/pierce）。 | 无需调整 |
| 贰炁弹（qi_bolt_2） | `qi` `range` `qi_action` | ⚠️ | `damage + ignore_parry`，但 **漏 `ignore_parry`**；qi/range/qi_action 正确。 | 补 `ignore_parry` |
| 叁炁弹（qi_bolt_3） | `qi` `range` `qi_action` `blunt` | ⚠️ | `add_debuff stun 0.6` 明确眩晕，**漏 `stun`**；`blunt` 作为无刃炁弹的伤害类型可接受。 | 补 `stun` |
| 肆炁弹（qi_bolt_4） | `qi` `range` `qi_action` | ⚠️ | `piercing:1, piercingRatio:0.4` 具穿透，但是否算「带刃」会影响 `momentum_mastery_buff`（`buffs.ts:1781` 只认 `slash`/`pierce`）→ 见「需裁定」；qi/range/qi_action 本身正确。 | 待裁定后再定是否补 `pierce` |
| 炁刃（qi_blade） | `qi` `melee` `slash` `pierce` `qi_action` | ⚠️ | `ignore_parry` + 近身斩击，melee/slash/pierce/qi_action 全对；但效果含 `{type:'ignore_parry'}`，**漏 `ignore_parry`**。 | 补 `ignore_parry` |
| 回炁（restore_ap） | `qi` | ✅ | `target:'self'` + `restore_ap 1`；`qi` 与内息/炁资源口径一致（`duan_qi` 亦标 `qi`）；`engine.ts` 注释明确把 restore_ap 归为「0 成本招式」主招，不带 `pre_action` 合理。 | 无需调整（AI 主招候选可能不选它，属 AI 口径问题，非 tag） |
| 擒龙功（qinlong_gong） | `qi` `debuff` `range` | ⚠️ | `disarm 0.3`（夺兵刃＝禁招）→`debuff` 正确，wisdom 缩放+`[1,3]`→`qi`/`range` 正确；requiredTags `['unarmed']` 与「隔空擒拿」自洽，但 **tags 漏 `unarmed`**（权重 4，且不发 `on_unarmed`）。 | 补 `unarmed` |
| 虚实拳（straight_punch） | `unarmed` `melee` | ✅ | `damage`（str/agi 0.2），range[0,2]，unarmed+melee 与武器标签体系一致。 | 无需调整 |
| 流云手（push_palm） | `unarmed` `stun` | ⚠️ | `add_debuff stun 0.2`→`stun` 正确；range[0,2] 近身但缺 `melee`。 | 补 `melee`（可补 `debuff`） |
| 六阳掌（liu_yang_zhang） | `unarmed` `melee` | ⚠️ | `add_debuff confuse 0.15`（迷惑：推演-1）是给对手的负面状态，**漏 `debuff`**；description「击中目标短暂混乱」与效果一致。 | 补 `debuff` |
| 无影拳（shadow_fist） | `unarmed` `debuff` | ⚠️ | `add_debuff knockdown 0.3`（倒地）**漏 `knockdown`**；`short_dash` 未标 `move`（口径见「需裁定」）；`debuff` 正确。 | 补 `knockdown` |
| 无影脚（shadow_kick） | `unarmed` `debuff` | ⚠️ | `add_debuff knockdown 0.4` **漏 `knockdown`**；requiredTags 为 `[]`，与同族拳脚招（均 `['unarmed']`）不一致，任何武器都能拿到这记腿法→见「需裁定」；description「先近身再出腿」但**无 dash/short_dash 效果**。 | 补 `knockdown`；确认 requiredTags 是否应 `['unarmed']` |
| 点腕（wrist_strike） | `unarmed` `melee` `debuff` | ✅ | `disarm 0.6`（打落兵器＝禁招）→`debuff` 正确，description「打落兵器」一致。 | 无需调整 |
| 点穴（dian_xue） | `unarmed` `debuff` | ⚠️ | `add_debuff paralyze stacks:7`（麻痹）**漏 `paralyze`**；range[0,2] 缺 `melee`。 | 补 `paralyze`、`melee` |
| 推掌（push_hand） | `unarmed` `melee` | ⚠️ | `knockback distance:1` + `step_back 1`（description「推开对手并后撤」）**漏 `knockback`**；位移效果未标 `move`（见「需裁定」）。 | 补 `knockback` |
| 手刀（hand_blade） | `unarmed` `slash` | ⚠️ | `add_debuff stun 0.3` **漏 `stun`**；range[0,2] 缺 `melee`；`slash`（兼具刀势）可接受。 | 补 `stun`、`melee` |
| 折梅手（zhemei_shou） | `unarmed` `melee` | ⚠️ | `stat_transfer dexterity 1, 3000ms` 实为「**敌方灵巧-1 / 自身+1**」双向（`handlers.ts:380-415`），对敌是负面→漏 `debuff`，对己是真实增益（`stat_transfer` buff 定义 tags 含 `buff`）→漏 `buff`。 | 补 `debuff`、`buff` |
| 八卦游身掌（ba_gua_you_shen_zhang） | `unarmed` `melee` `buff` | ✅ | `add_buff you_shen`（身法+1 灵巧+1）真实增益，`buff` 正确；description 与层数说明一致。 | 无需调整 |
| 石破天惊拳（crushing_blow） | `unarmed` `melee` `chan` | ✅ | `chanCost 20`→`chan` 正确；`missing_hp_damage 0.2` 打的是**对手已失血量**（`handlers.ts:290`），与 `low_hp`（己方残血/卖血）语义不同，**未标 `low_hp` 正确**。 | 无需调整（是否补 `damage` 见「需裁定」） |
| 黯然销魂掌（desolate_palm） | `unarmed` `melee` `chan` `low_hp` | ⚠️ | `self_missing_hp_damage 0.18`（己方越残越强）→`low_hp` 正确，`chanCost 20`→`chan` 正确；但 `add_debuff fumble_chance_temp stacks:2`（失心，description「令对手心神不宁」）**漏 `debuff`**。 | 补 `debuff` |
| 寸劲（cun_jin） | `unarmed` `melee` | ✅ | `damage str×1.2` + `requireAttrsMin 力道14`，range[0,1]；unarmed/melee 自洽。 | 无需调整 |
| 铁山靠（iron_charge） | `stun` `self_damage` `unarmed` | ⚠️ | `add_debuff stun 1.0`→`stun`、`self_damage 0.01`→`self_damage` 均正确；`short_dash 1` 近身撞击却缺 `melee`。 | 补 `melee` |
| 狮吼功（lion_roar） | `stun` `debuff` | ✅ | `add_debuff stun 0.5` + `fumble_chance_temp 0.8`，`stun`/`debuff` 正确；非兵器声波招（range[0,4]）不带 `melee`/`range` 可避免误发 `on_range`，可接受。 | 无需调整 |
| 飞龙在天（eighteen_palms） | `unarmed` `qi` `chan` | ⚠️ | str/agi/wisdom 0.6 缩放（wisdom＝炁效果属性，`qi` 成立）+`chanCost 18`；但 `getRange [0,4]` 却既无 `melee` 也无 `range`，不触发任何命中形态事件。 | 按实际形态补 `melee`（或 `range`） |
| 侧踢（side_kick） | `unarmed` `melee` | ⚠️ | `add_debuff paralyze stacks:3, 0.8`（麻痹）**漏 `paralyze`**。 | 补 `paralyze` |
| 扫腿（sweep_kick） | `unarmed` `melee` | ⚠️ | `add_debuff knockdown 0.4`（倒地）**漏 `knockdown`**。 | 补 `knockdown` |
| 回旋踢（spinning_kick） | `unarmed` `melee` `chan` | ✅ | `chanCost 25`→`chan` 正确；唯一效果是 dash+damage，unarmed/melee 自洽。 | 无需调整（short_dash 是否补 `move` 见「需裁定」） |
| 三寸光（three_inch_light） | `unarmed` `qi` `pierce` `chan` | ⚠️ | `piercingRatio 0.5`→`pierce` 正确；description「炁凝指尖」→`qi` 正确；`chanCost 20`→`chan` 正确；但 `short_dash 2` 后无 `melee`，且是否为 `qi_action`（影响刃炁判定）见「需裁定」。 | 补 `melee`；`qi_action` 待裁定 |
| 裸绞（rear_naked_choke） | `unarmed` `melee` `debuff` | ⚠️ | `add_debuff choke`（窒息每秒绞杀伤害，`debuffs.ts:316 onTickDamage`）→`debuff` 正确，但**漏 `dot`**（持续伤害，tag.ts 有此 tag）与 `knockdown`（0.5）；choke 内部刷新 stun 属实现手段，不必标 `stun`。 | 补 `dot`、`knockdown` |
| 如来神掌（ru_lai_shen_zhang） | `unarmed` `qi` `range` `chan` | ⚠️ | str/vit/wisdom 0.6（wisdom→`qi`）与 `chanCost 20` 正确；但 `getRange [0,2]` 是近身，`range` 只因 `short_dash 5` 才达 0-7，会对一记掌击发 `on_range`。description「距离极远」支持 `range`，但基础射程文案与 getRange 需统一。 | 见「需裁定」：统一为 melee+dash 或改 getRange |
| 端杯手（duan_bei_shou） | `unarmed` `melee` `jiu` | ✅ | `onActionHitChance` 用 `countDrunkLayers`（`drunk.ts` 按 `jiu` tag buff 层数），description「每层醉酒提升命中」→`jiu` 正确。 | 无需调整 |

## requiredTags 专项核对

- 范围内 requiredTags 只用了 `pierce` / `slash` / `melee` / `unarmed`，**均存在于武器体系**：
  - `pierce`：长枪、七根丝、军用匕首、桃木剑等；`slash`：桃木剑、锁链断刀、黑云剑、素铁霸刀等；`melee`：桃木剑、军用匕首、弗思剑、藏锋、次元刃、千绣冬、春雷、阿赖耶识、惊鸿、千机、不二剑等；`unarmed`：赤手空拳（`starting-weapons.ts`）、素手无相、军用匕首、特种兵匕首、千机。
  - 多标签 requiredTags 用 `.some()` 交集判定（`actions/index.ts:50-55`、`reward-pool.ts:47-50`），故 `['pierce','melee']`、`['slash','pierce']` 均可命中重剑/长兵等缺 `melee` 的武器，不存在取不到的问题。
- **唯一失效项**：`yu_xiao_jian_fa` 的 requiredTags `['melee']`（单标签）——齐眉棍/玄铁重剑/引擎铁锤/陨铁神珍/铁枪·破军/三节枪/镇北戟均无 `melee` tag，与其 tags 中的 `blunt`/`pierce` 宣称冲突。
- 拳脚招一律 `['unarmed']`；`shadow_kick`、`lion_roar`、全部炁技（含 `qi_gather`/`restore_ap`/四发炁弹）为 `[]`（任意武器可用）。炁技 `[]` 与其「锻体解锁的辅招」定位一致；`shadow_kick`/`lion_roar` 的 `[]` 见「需裁定」。

## 需裁定（拿不准的）

1. **肆炁弹（qi_bolt_4）是否补 `pierce`**：效果 `piercing:1, piercingRatio:0.4`。`buffs.ts:1781` 中炁招的「带刃」判定 = `tags.includes('slash') || tags.includes('pierce')`；补 `pierce` 会让它叠「刃炁」，不补则纯穿透弹不叠。穿透是否等于带刃，需设计口径。
2. **三寸光（three_inch_light）是否补 `qi_action`**：description「炁凝指尖」属纯炁凝聚；不标 `qi_action` 时刃炁判定回落到武器 tags（unarmed 武器无 slash → 不叠）。同类 `qi_blade` 标了 `qi_action`。
3. **`move` 标签口径不统一**：带 `short_dash` 的攻击招（shadow_fist、iron_charge、yi_hui、spinning_kick、duan_bei_shou、three_inch_light、ru_lai_shen_zhang）与 `step_back`（push_hand）均未标 `move`；而 `internal.ts` 居合斩（`['move','slash']`）、`support.ts` 全部位移招都标 `move`。`move` 会影响触发器护栏（`useBuildCharacter.ts:141`、`engine.ts:440`）与日志归类（`engine.ts:877`），需统一「攻击带位移算不算 move」。
4. **`shadow_kick` 的 requiredTags 是否应为 `['unarmed']`**：它 `[]`，持械也能用；同族拳脚招全部 `['unarmed']`，且 description 是腿法。若「持械也能踢」是设计意图，需在文案/口径上写明。
5. **`ru_lai_shen_zhang` 的 `range` vs `getRange [0,2]`**：`range` tag 会发 `on_range`（被远程命中触发器），但基础射程是贴脸，实际距离靠 `short_dash 5` 拉开。是「远程掌」还是「突进近身掌」，决定该保留 `range` 还是改 `melee`。
6. **`damage` 标签口径**：本范围 56 招**无一**标 `damage`，而全库仅 `player.ts` 两招与若干 buff 标了它（`tagRelevance` 中权重 1；AI 辅助优先级里 `damage`=50）。若口径是「显著提升输出/破防」，`cyclone_slash`（两段独立伤害）、`fall_to_azure_sword`（必中+无视招架）、`crushing_blow`（失血追加伤害）等可考虑补；若口径是「专门的增伤类招式标记」，则现状正确。需先定口径。
7. **`lion_roar` / 飞龙在天 的形态标签**：二者（range[0,4]）不标 `melee`/`range`。不标可避免误发 `on_range`，但也就完全不参与命中形态触发器与权重；是否为有意为之需确认。
8. **描述与机制不符（不涉 tag，供文案/数据同步）**：
   - 寸芒「顺势反击」——无 `counter` 类效果；
   - 九死剑法「以身为剑，不避锋芒」——无自伤/卖血；
   - 无假剑法「以力破巧」却叠「柔劲」（敏捷）、流萤剑法「灵动如烟」却叠「刚劲」（力道）——两者疑似互换；
   - 无影脚「先近身再出腿」——无 dash/short_dash；
   - 一辉 `hookNotes.hitChance`「目标气血低于 30% 时暴击+30%」——代码实为「低于 50% 必中」+暴击固定 +20%；
   - 如来神掌「距离极远」与 `getRange [0,2]`。
9. **`buff` 是否等同于「施加了增益」**（口径确认）：`gentle_stance`/`vigor_stance` 是一增一减的属性交换（柔劲：敏捷+4/力道-2）。本报告按 RUBRIC「属性提升算 buff」判为真实增益；若设计视其为「架势/交换」而非纯增益，quanzhen_sword / yunv_sword 的 `buff` 需复议。


---

## 九、招式 · 玩家/支援/内部

# 招式 · 玩家/支援/内部 tag 审计

> 只读审计，**未改动 `src/` 下任何文件**。判定口径见 [`RUBRIC.md`](RUBRIC.md)。
> 范围：`src/data/actions/player.ts`（28）、`support.ts`（33）、`internal.ts`（38）；`index.ts` 无内联 `ActionDefinition`（只有 import/合并/`getActionsByWeapon`），不计入。

## 结论摘要

- 实体数：**99**（player 28 + support 33 + internal 38；`grep -c "id: '"` 与逐条解析一致）
- **❌ 19 条 / ⚠️ 39 条 / ✅ 41 条**（player 4/15/9，support 2/18/13，internal 13/6/19）
- **实现型招式未挡奖励池（最高危）**：`internal.ts` 38 条中 23 条带 `internal` 且同时带 `_` 前缀；余下 15 条里 12 条本就带 `_` 前缀（池层早已挡住），真正漏网的只有 `iaijutsu_strike`、`resheath`（外加按裁定允许进池的 `tempest`）。当时按「内部条目必须带 `internal`」判 ❌/⚠️，**该基准已废止**：`internal` 会同时把招式剔出 AI 主招候选（`ai/index.ts:76-80`），给 AI 要用的招式补 `internal` 会让对手崩盘（实测见汇总文 §十二）。正确的挡池手段是 `_` 前缀。
- 问题归类：
  - **`internal` 漏标（最高危，13 条判 ❌，另有 2 条 ⚠️；全在 `internal.ts`）**：`internal.ts` 是「被动/天赋触发专用」文件（38 条里 23 条带 `internal`）。漏标的 15 条会被 `reward-pool` 当作普通招式。**（审计当时）**`src/game/roguelite/reward-pool.ts` 的 `_getActionPool()` 直接 `allMainActions`（含 `INTERNAL_ACTIONS`）且**不过滤 `internal`**，`engine.ts:413` `_itemCandidates` 的 `passAll` 也只查 `exclude/ids/excludeTags/ap/requireTags/requiredTags`；过滤只发生在 UI 层（`RewardPicker.tsx:50`、`CharacterPanel.tsx:279`、`useBuildCharacter.ts:63`）—— 池层两道闸已于本次补上。典型受害：`_orb_shot`(`internal.ts:160`)、`_fei_jian_shot`(:216)、`_silk_shot`(:187)、`_fen_shen_shot`(:229) 连 `trigger` 都没有 → **会作为「学招式」奖励直接发给玩家，学了也不可出现/触发，纯死奖励**。`_arm_explosion`(:144) 有明确注释说明为何不标（AI 需经 `conditionId` 主动选用），属有意豁免。**修法见汇总文 §十二：一律改用 `_` 前缀挡池，不补 `internal`。**
  - **`buff` 方向反标（6 条）**：`electric_yoyo`、`flash`、`bi_hai_chao_sheng_qu`、`shi_qi` 等把「给对手上异常」标成 `buff`。对照：`yufeng_needle` 只有 `add_debuff`（标 `debuff`+`paralyze`），而 `_huan_shot`/`_flying_lion_roar`/`_golden_bell_swing` 同类却不带 `buff` —— 文件内无统一口径。
  - **`buff` 少标（15 条）**：`wan_liu_gui_zong`、`jin_zhong_zhao`、`chanzi_stance`、`cang_niao_jian_fa`、`gear_hang`、`summon_haste`、`condense_shield`、`agility_steal`、`drone_paralyze`、`_resheath`、`_iaijutsu_ready`、`_cangfeng_mind_eye`、`_alaya_insight`、`_qiti_awaken`、`_tai_shang_heal` 等只写 `defense`/`summon`/`trigger` 而不写 `buff`（若团队口径是「只标功能类」，这批应判 ✅，见「需裁定」2）。
  - **`chan` 口径不一致**：`chanCost > 0` 却无 `chan` 标签的有 8 条（`gear_hang` 20、`big_leap` 3、`lightning_speed` 4、`jindou` 5、`santou_liubi` 27、`chanzi_heal` 10、`chanzi_stance` 10、`deng_ping_du_shui` 2）；而 `wind_hear` 无 `chanCost` 却带 `chan`（其 buff `wind_hear_buff` 不回复缠劲，只有闪避+前移）。
  - **`damage` tag 语义漂移（3 条）**：`ru_long`、`wan_fa_gui_yi`、`tempest` 带 `damage`。`grep "'damage'" src/data/actions/*.ts` 显示 `melee/unarmed/qi` 三个文件**没有任何一条招式带 `damage`**，该 tag 在数据层只用于 buff/功法（`damage.ts` 11 处）表达「增伤」。这 3 条是「造成伤害」而非「提升输出」，按 RUBRIC §输出/防御应去掉。
  - **`requiredTags` 自洽**：全部 99 条的 `requiredTags` 并集 = `blunt imperial parry pierce polearm slash summon unarmed`，全部命中武器 tag 并集（`weapons.ts`+`starting-weapons.ts`），**无孤立 requiredTags**；`getActionsByWeapon`/`ai/index.ts:85` 的交集判定也不会出现为空。
  - **`self_damage` 判定依据**：`unarmed.ts:205` 的「铁山靠」用 `type:'self_damage'` 并标 `self_damage`；`blood_droplet`/`blood_qi_protection` 用的是 `self_hp_cost`（`handlers.ts:276` 走 `spendHp`，不广播 `self_damage` 事件，`handlers.ts:273` 只给 `self_damage` 效果打该 tag）。故二者未标 `self_damage` 与现有实现口径一致，**不计为 ❌**。

---

## 一、`player.ts`（28）

现 tags 与判定：

| 实体 | 现 tags | 判定 | 理由（引用自身 effects/description/requiredTags） | 建议 |
| --- | --- | --- | --- | --- |
| 弹指（flick） | `thrown` `stun` `qi` `range` `blunt` | ✅ | `add_debuff: stun` 与 `stun` 一致；`damage{strength .2, dexterity .1}` + `getRange 0-6` + 描述「指间弹出炁劲」支持 `thrown`/`range`/`qi` | 保持 |
| 血滴子（blood_droplet） | `qi` `unarmed` `range` `thrown` `low_hp` | ❌ | 描述「**消耗10%当前气血**」且 `effects` 首条即 `self_hp_cost{ratio:0.1}`；`functional_damage: self.hp/9` 明示伤害随残血下降（越残越弱）→ 给「自伤代价」的 `self_damage` 缺失，`low_hp` 语义相反 | 去掉 `low_hp`；补 `self_damage`（若坚持 `self_hp_cost` 不算 `self_damage`，则至少去掉 `low_hp`） |
| 银针（yin_zhen） | `pierce` `range` `thrown` | ✅ | `ignore_parry` + `piercingRatio 0.5` 与描述「精准刺穴」自洽；无元素/状态标签需求 | 保持（可补 `ignore_parry`） |
| 五芒镖（dart_throw） | `slash` `range` `thrown` | ✅ | `damage{strength .3, dexterity .1}`，`onActionHitChance +3%`，无元素 | 保持 |
| 玉蜂针（yufeng_needle） | `range` `thrown` `paralyze` `debuff` `pierce` | ✅ | `add_debuff: paralyze` + `add_debuff: poison`，描述「附寒毒麻痹」；同文件 `electric_yoyo` 的同类麻痹却不写 `paralyze`（见该条） | 保持（并以此条为口径统一 `electric_yoyo`/`drone_paralyze`） |
| 飞刀（throwing_knife） | `range` `pierce` `slash` `thrown` | ✅ | `onActionCritChance +10%` 对应描述「易出暴击」；`pierce`+`slash` 覆盖刀刃 | 保持 |
| 生死符（sheng_si_fu） | `range` `thrown` `qi` | ⚠️ | `damage{scaling:{wisdom:.5}, piercing:10}` 是穿透伤害，描述「穿透防御直击经脉」，但无 `pierce` | 补 `pierce`（可选，参考 `yin_zhen` 的 `ignore_parry` 手法） |
| 电力溜溜球（electric_yoyo） | `electric` `debuff` `qi` | ⚠️ | 描述「电力灌注」`damage{wisdom .3}` + `add_debuff: paralyze`；**给对手上麻痹是 `debuff` 不是 `buff`**（`electric` 已覆盖元素）；同文件 `yufeng_needle` 同效果标 `paralyze` 而非 `buff` | 去掉 `buff`；补 `paralyze` |
| 雷蛇（thunder_storm） | `electric` `stun` `chan` | ⚠️ | 描述「**以炁化雷**」，`chanCost: 15`，`effects` 含 `ignore_parry`（未标 `ignore_parry`）、`add_debuff: stun`（描述写「麻痹」但实际给 `stun`）；无 `qi` | 补 `qi`、`ignore_parry`；stun 是否改 paralyze 见「需裁定」 |
| 棍戳（rod_thrust） | `blunt` `polearm` | ✅ | `requiredTags ['blunt','polearm']` 与 `tags` 完全一致，`damage{strength .25, dexterity .1}` | 保持 |
| 棍劈（rod_cleave） | `blunt` `polearm` | ⚠️ | `description`「高举过顶，一棍劈下，势不可挡」动作是劈砸，收尾是钝击面，`blunt` 为借标；`requiredTags ['polearm']` 已够 | 可保留（钝击面）；若要严格按动作归类则去 `blunt`——见「需裁定」 |
| 棍挑（rod_lift） | `blunt` `polearm` | ⚠️ | 描述「破敌防势，**降低对手闪避**」，但 `effects` 只有 `damage{strength .2, dexterity .2}` + `onActionCritDamage +20%`，**没有任何降闪避/破防 debuff**——`hookNotes.critDamage` 是唯一输出点 | 描述与 effects 不一致，`debuff` 少标或描述该改；至少不因此增删 tag（见「需裁定」） |
| 横扫（rod_sweep） | `knockdown` `polearm` | ⚠️ | `add_debuff: knockdown` ✓；但同为棍系钝击（`requiredTags ['polearm']`，齐眉棍带 `blunt`），`rod_thrust`/`rod_cleave`/`stand_rod_kick` 都带 `blunt`，此条缺——同一武器族内不一致 | 补 `blunt`（与 `rod_cleave` 同口径） |
| 裂地击（fissure） | `paralyze` `ignore_parry` `unarmed` | ❌ | 描述「猛砸地面，造成冲击波」，`requiredTags: ['polearm']`（棍系），`effects = damage{strength .6} + add_debuff:paralyze + ignore_parry`，**没有任何拳脚机制**；`unarmed` 是把长柄招错挂到空手 build 方向（权重 4），会污染 `tagRelevance` 关联与构筑建议 | 去 `unarmed`；补 `blunt`/`polearm`（与同族一致） |
| 回马枪（return_spear） | `polearm` `pierce` `chan` | ⚠️ | `getRange 3-4`，描述「佯装撤退，回首一枪」，`requiredTags ['polearm']`；该招是远程投枪式但无 `range`（`range` 权重 4），会漏掉远程 build 关联 | 补 `range`——见「需裁定」 |
| 立棍踢（stand_rod_kick） | `blunt` `polearm` | ⚠️ | 描述「以棍撑地，凌空一脚」`damage{strength .2, agility .1}` + `add_debuff: knockout`，`requiredTags ['polearm']`；此条**有** `blunt`，与 `rod_sweep` 缺 `blunt` 形成同族不一致（可保留） | 保持，或与 `rod_sweep` 统一 |
| 破狼棍法（po_lang_gun_fa） | `blunt` `polearm` | ✅ | `damage{strength .4, agility .1, vitality .1, dexterity .4}` + `onActionCritChance +50%`（对应「势不可挡」），4 维缩放 | 保持 |
| 一点寒芒（yi_dian_han_mang） | `polearm` `pierce` `buff` `frost` | ✅ | `add_buff: chill_blade`（`buffs.ts:524` 叠层「伤害+8%/层」= 真增益）+ `add_debuff: frost` + `damage{strength .1, wisdom .2}`，与描述「附加寒锋与霜冻」完全对应 | 保持 |
| 如龙（ru_long） | `polearm` `pierce` `damage` `chan` | ⚠️ | `functional_damage` 按**自身非永久 BUFF 总层数**增伤（`forEachBuffOf` 计层 × wis×0.2），这是「条件增伤」而非 `add_buff`；`grep "'damage'"` 显示 `melee/unarmed/qi` 的招式无一使用 `damage`，该 tag 只用于 buff/功法 | 去掉 `damage`（或全库统一新口径） |
| 焰拳（yan_quan） | `pre_action` `buff` `chan` `burn` | ⚠️ | `target: 'self'` + `add_buff: yan_qi`（`damage.ts:328` 任何伤害 40% 概率叠 2 层灼烧）→ `buff`/`burn`/`chan`(16) 均正确；但同类自施 buff 的 `cang_niao_jian_fa`/`dao_ma_dan` 都带 `qi`，此条描述「**凝炁为焰**」却无 `qi` | 补 `qi` |
| 挥击（hammer_swing） | `blunt` `melee` | ✅ | `damage{strength .4}` + `onActionCritChance +10%`，`requiredTags ['blunt']` | 保持 |
| 雷霆一击（thunder_strike） | `blunt` `electric` | ✅ | `damage{strength .6, wisdom .4, fixed 2}` + `add_debuff: paralyze`，描述「雷霆万钧砸下，电光四溢」；无 `chanCost`（`engine_hammer` 自带 `engine_hammer_buff`/`energy_drain`） | 保持 |
| 一夜鱼龙舞（one_night_dance） | `range` `summon` `chan` | ❌ | `damage{...wisdom .28, independentHits: 5}` 是**同一武器多次独立命中**，不生成/强化召唤物；描述「御物万法」定位属御物系但缺 `imperial`（同族 `wan_fa_gui_yi` 有），`summon` 在 `tagRelevance` 是权重 2 的流派 | 补 `imperial`；`summon` 按「是否召唤机制」再定——见「需裁定」 |
| 万法归一（wan_fa_gui_yi） | `imperial` `range` `damage` `chan` | ⚠️ | `functional_damage` 按 `self.weaponDef.summon.maxCount` 与召唤物招式 `fixed + wis×scaling` 结算，`imperial`/`range`/`chan`(33) 均正确；`damage` 同上条漂移 | 去掉 `damage` |
| 碧海潮生曲（bi_hai_chao_sheng_qu） | `qi` `range` `debuff` | ⚠️ | `ignore_parry` + `damage{dexterity .2, wisdom .3}` + `add_debuff: fumble_chance_temp`；描述「**无视招架闪避**」但 effects 只有 `ignore_parry`，未标 `ignore_parry`；`debuff` 已正确（同类 `_sonic_wave` 反标成 `buff`） | 补 `ignore_parry`；描述「闪避」需与实现核对 |
| 毒素引爆（poison_detonate） | `poison` `qi` `chan` | ✅ | `functional_damage` 读 `poison::{enemy}` 层 `remainingTicks`，`totalRemaining * DMG_PER_POISON_TICK * 3.5` 并 `delete` 毒层，与描述「引爆剩余跳数并清除所有毒层」精确对应 | 保持 |
| 探云手（steal_artifact） | （无） | ⚠️ | `effects: [{type:'steal_artifact'}]`，`target:'enemy'`，`canUse` 要求对方有非 `inherent` 奇物；`target` 与判定一致，**无 tag 是合理的**（不可伤害、不可防御、不可位移） | 保持（若统一口径可标 `debuff`，但会误导） |
| 天外飞仙（tian_wai_fei_xian） | `qi` `thrown` `range` `chan` `pierce` | ⚠️ | `effects = short_dash{maxDistance:5} + damage{strength/agility/dexterity/vitality .4, wisdom .8, piercingRatio .5}`；`short_dash` 是冲近位移（`tagDisplay` 的 `move`），描述「以身为剑」却有远程 `range` + `thrown` | 补 `move`；`thrown`/`range` 与实际「冲到脸上砍」冲突——见「需裁定」 |

---

## 二、`support.ts`（33）

| 实体 | 现 tags | 判定 | 理由（引用自身 effects/description/requiredTags） | 建议 |
| --- | --- | --- | --- | --- |
| 听潮式（guard） | `buff` `defense` `post_action` `stance` | ✅ | `add_buff: guard_up`（`defense.ts:46` `onParryChance: 0.5`），描述「大幅提升招架率」；`requiredTags ['parry']` 与 buff `tags: ['defense','stance']` 自洽 | 保持（可补 `parry`） |
| 听风式（wind_hear） | `buff` `defense` `post_action` `chan` `stance` | ⚠️ | `add_buff: wind_hear_buff`（`onDodgeChance: 0.15` + 闪避后 `short_dash` 前移）= 真增益；**但 `chanCost` 未设（0），buff 也不回复缠劲**，`chan` 无对应机制（对比 `gear_hang` `chanCost: 20` 反而无 `chan`） | 去掉 `chan`；`post_action` 建议改 `pre_action`（见「需裁定」） |
| 归宗式（wan_liu_gui_zong） | `defense` `unarmed` `post_action` | ⚠️ | `add_buff: wan_liu_gui_zong`（`defense.ts:71` 完全招架远程 + 未招架则叠 `wan_liu_insight`（`dexterity +1`/层，上限 4））→ 明显是真增益却缺 `buff` | 补 `buff` |
| 无想剑（wu_xiang_jian） | `pre_action` `buff` `chan` | ✅ | `add_buff: wu_xiang`（`buffs.ts:832` 下一招暴击 +10%、暴伤 +70%），描述「一击便可定胜负」；`chanCost: 3` | 保持 |
| 血炁护体（blood_qi_protection） | `pre_action` `buff` | ❌ | `description`「**释放15%当前气血**」→ `functional_damage` 内 `self.spendHp(cost)`（注释「卖血触发 onHpChange（血战到底联动）」）；`add_buff: blood_qi_protection`（`onTakeDamage ×0.9` + `onTickHeal(=restoreValue/10)` 10 秒回复）→ 同时是 `defense`+`heal` 机制，tags 只有 `buff` | 补 `self_damage`、`defense`、`heal`——见「需裁定」 |
| 挂（gear_hang） | `buff` `pre_action` `chan` | ⚠️ | 描述「凝缠劲为内息，**消耗20缠劲**，叠一层「挡」」，`chanCost: 20`；`add_buff: gear_shift_buff`（`buffs.ts:1482` `apRegenPerSec +0.1/层`，上限 5）= 真增益 | `chan`/`buff` 正确（同条口径下 `chan` 反成漏标重灾区，见 `santou_liubi`） |
| 苍鸟诀（cang_niao_jian_fa） | `buff` `pre_action` `qi` `chan` | ⚠️ | `add_buff: cang_niao_buff`（`buffs.ts:1805` 10 秒 AP 回复 +0.4/s，buff 自身 `tags: ['buff','qi']`）；`chanCost: 10`，描述「提高内息回复速度」；**该 buff 明确是持续回复（heal 类收益）却无 `heal`/`defense`** | 补 `heal`（或 `defense`）——见「需裁定」 |
| 闪光（flash） | `debuff` `pre_action` `electric` | ⚠️ | `add_debuff: sand_blind`（`debuffs.ts:60`），描述「以炁激发强光**致盲对手**」；方向上 `debuff` 正确，但描述「以炁激发」+ `electric` 用于「强光」——`electric` 是权重 2 流派，机制上无雷伤/麻痹 | 去 `electric`（或改 `qi`）——见「需裁定」 |
| 刀马旦（dao_ma_dan） | `buff` `pre_action` `qi` `chan` | ✅ | `add_buff: dao_ma_dan`（`buffs.ts:1742` 力/身/巧 +1、AP+10%、每 2 秒回 2 血、`onRuntimeAction` 给招式加 `qi`），描述「招式带炁，回复内息与气血」逐条对应；`chanCost: 30`、`requiredTags ['polearm']` | 保持 |
| 扫描分析（scan_analysis） | `pre_action` `buff` `summon` | ⚠️ | `add_buff: scan_analysis`（`buffs.ts:1526` 每层命中 +5%、暴击 +5%，上限 5），`maxUses: 3`；`requiredTags ['imperial']` 已有 `imperial` 体系归属，但自身无 `imperial`——同族 `ling_qi_guan_zhu`/`summon_haste` 都带 | 补 `imperial`（可选） |
| 魅影步（swift_step） | `move` `pre_action` | ✅ | `dash{maxRange:3, targetDist:0}` + `add_buff: phantom_step`，描述「身随心动」 | 保持 |
| 虎跃（big_leap） | `move` `pre_action` `chan` | ⚠️ | `dash{minRange:2, maxRange:5, targetDist:0}` + `canUse 要求 strength>=10`，描述「需力道≥10」；`chanCost: 3` 且描述未提缠劲，`chan` 只有数值依据 | 保持或统一 `chan` 口径 |
| 电光石火（lightning_speed） | `move` `pre_action` `chan` | ✅ | `dash{maxRange:4, targetDist:0}`，`chanCost: 4`，描述「瞬息即至」；无元素机制，未标 `electric` 正确 | 保持 |
| 筋斗（jindou） | `move` `pre_action` `chan` | ✅ | `dash{minRange:1, maxRange:8, targetDist:1}` + `canUse agility>=10`，`chanCost: 5` | 保持 |
| 凤迴（feng_hui） | `move` `pre_action` | ✅ | `dash{maxRange:8, targetDist:0}`，描述「瞬移至对手身后」，`useAp: false` | 保持 |
| 凤反（feng_fan） | `move` `pre_action` `post_action` | ✅（已复核改判） | 同时带 `pre_action` 与 `post_action`，但**不构成重复释放**：`ai/index.ts:151` 把前摇指令的 id 作为 blacklist 传给收招阶段（`support-planner.ts:24` 直接跳过）；且 `effects` 只有 `dash{maxRange:8, targetDist:-1}`（纯后撤），`support-planner.ts:41` 对位移招**不分阶段**一律跳过，实际只由 `planMove` 使用 | 保持（双标无害；若想收窄可去 `pre_action`，行为不变） |
| 云步（yun_bu） | `move` `pre_action` | ⚠️ | `dash{maxRange:4, targetDist:-1}` + `add_buff: yun_bu_foresight`（`onHitChance +0.08`，描述「下次攻击更难招架闪避」）= 真增益却无 `buff` | 补 `buff` |
| 瞬步（dian_bu） | `move` `pre_action` | ✅ | `dash{maxRange:2, targetDist:2, useAp:false}`，描述「回到最佳攻击距离」 | 保持 |
| 滚地拾刀（retrieve_blade） | `pre_action` `retrieve_weapon` | ⚠️ | `short_dash{maxDistance:3}` + `retrieve_weapon`，`canUse` 要求 `disarmed`；同文件带 `short_dash` 的触发招（`_iaijutsu_strike`、`_ling_ao_chong`）都标 `move` | 补 `move` |
| 拾起兵器（pickup_weapon） | `pre_action` `retrieve_weapon` | ✅ | `retrieve_weapon` + `canUse` 判定 `dropPosition` 距离 ≤1 | 保持 |
| 三头六臂（santou_liubi） | `buff` `pre_action` `chan` | ⚠️ | `add_buff: santou_liubi`（`buffs.ts:671` 回合结束 AP 回满，`stacks: 2`），`chanCost: 27`；描述写「消耗**30**层缠劲…后续**3**个回合」与 `chanCost:27`/`stacks:2` 不一致（描述与实现漂移，tag 本身没问题） | 保持 tag；描述需修（见「需裁定」） |
| 抛沙（sand_throw） | `debuff` `pre_action` | ✅ | `add_debuff: sand_blind{stacks:2, chance:0.8}`，描述「扬沙迷眼，中距离干扰」，`getRange [1,3]`；`canUse` 防重复 | 保持 |
| 蚀炁（shi_qi） | `debuff` `post_action` `qi` `range` `chan` | ✅ | `add_debuff: weakness{stacks:3}`，描述「削弱对手气力与推演」，`chanCost: 12`、`getRange [1,5]` | 保持 |
| 灵剑（spirit_sword） | `buff` `pre_action` `qi` | ✅ | `ciyuan_init` + `add_buff: ciyuan_blade`（`onParryPenetration` 穿透 30%），描述「凝炁为刃，剑炁可穿透防御」 | 保持 |
| 御物加速（summon_haste） | `imperial` `summon` `pre_action` | ⚠️ | `add_buff: summon_haste`（`buffs.ts:315` `onSummonInterval` 缩短开火间隔，上限 4），描述「召唤物开火更快（叠1层，上限4层）」；`buff` 漏标（同族 `dao_ma_dan` 等都有） | 补 `buff` |
| 凝炁成盾（condense_shield） | `post_action` `defense` | ⚠️ | `add_buff: qi_shield{stacks:2}`（`defense.ts:10` 吸收伤害，炁招 2/其他 1）；描述「凝聚炁息化为护盾」→ `defense` 对，但 `buff` 漏标；同时「凝炁」无 `qi` | 补 `buff`（可选补 `qi`） |
| 汲灵（agility_steal） | `imperial` `summon` `pre_action` | ⚠️ | `stat_transfer{stat:'agility', value:1}`，描述「本体命中时吸取身法 1 点」；`buff`/`defense` 皆缺（属性增益），`onActionHitChance: () => 1` 已写 `hookNotes` | 补 `buff` |
| 御物麻痹（drone_paralyze） | `imperial` `summon` | ⚠️ | `add_debuff: paralyze{chance:0.35}`，描述「350%概率附加1层麻痹」；**缺 `debuff`、`paralyze`**（同文件 `yufeng_needle` 标了 `debuff`+`paralyze`，`electric_yoyo` 标了 `debuff`） | 补 `debuff`、`paralyze` |
| 灵炁灌注（ling_qi_guan_zhu） | `buff` `pre_action` `imperial` | ✅ | `add_buff: sword_enhance_buff`（`buffs.ts:1188` 4 秒伤害 +10%、命中 +5%），描述「增加命中和暴击」（buff 实际是伤害+命中，暴击少标为描述问题） | 保持 |
| 甘露（chanzi_heal） | `heal` `qi` `pre_action` `chan` | ⚠️ | `functional_heal: Math.round(self.hp*0.03)`，描述「回气疗伤」，`chanCost: 10`；`heal`/`qi`/`chan` 正确 | 保持（`chan` 口径一致性见摘要） |
| 金刚不坏（chanzi_stance） | `buff` `qi` `pre_action` `chan` | ⚠️ | `add_buff: chanzi_stance`（`defense.ts:676` `onTakeDamage` 反伤 15%），描述「受到伤害时反伤10%」（描述 10% vs 实现 15%）；机制上是**反击/反伤 + 防御**，无 `counter`/`defense` | 补 `defense`、`counter`；描述需修 |
| 金钟罩（jin_zhong_zhao） | `defense` `buff` `pre_action` | ⚠️ | `add_buff: jin_zhong_zhao`（`defense.ts:704` 吸收 45 点、免疫 `stun/knockdown/disarmed`、每 5 秒修 1），`maxUses: 1`，描述「罡气护身」；buff 自身 `tags: ['super_armor','defense']`，金钟罩是**罡体免疫硬控**，却无 `super_armor` | 补 `super_armor` |
| 登萍度水（deng_ping_du_shui） | `move` `pre_action` `chan` | ✅ | `dash{maxRange:4, targetDist:0}` + `getRange [0,12]`，描述「位移至对手身前」，`chanCost: 2` | 保持 |

---

## 三、`internal.ts`（38）

> 该文件头注释为「内部招式（被动/天赋触发专用，不直接装备）」。**判定基准（已按 §十二 修正）= 内部实现条目必须挡住「学招式」候选池**；挡池有两个手段且**不等价** —— `internal` 标签会同时把招式剔出 AI 主招候选（`ai/index.ts:76-80`），`_` 前缀只挡池子（全库只有 `reward-pool.ts` 读它）。故本表「判定」列保留审计原判（基准为「必须带 `internal`」），「建议」列的「补 `internal`」一律以 §十二 的 `_` 前缀方案为准。

| 实体 | 现 tags | 判定 | 理由（引用自身 effects/description/canUse/来源） | 建议 |
| --- | --- | --- | --- | --- |
| 居合斩（_iaijutsu_strike） | `move` `slash` | ❌→已修 | `canUse` 要求 `pendingBuffs.has('iaijutsu::')`，`effects = short_dash{1} + damage{strength 1.9} + remove_buff: iaijutsu`；**是 `_resheath` 的姿态收招专用招，不可装备**（有 `move`/`slash` 说明位移/武器面已标注） | 已改 id 为 `_iaijutsu_strike`（挡池但不挡 AI）；`move` 待裁定 E |
| 纳刀（_resheath） | `buff` `post_action` `stance` | ⚠️→已修 | `add_buff: iaijutsu`（`buffs.ts:86` `tags:['stance']`，无 `expiry`）→ `buff`/`stance` 正确；`post_action` **也正确**：本招的功能是「居合斩消耗架势后补回架势」，且 `canUse: hasNoStance` 只在主招之后才成立 —— `support-planner.ts:55` 只对 pre 阶段做 `canUse` 校验、收招阶段跳过（注释明写「条件在主招执行后才满足」），改 `pre_action` 反而会被自身 `canUse` 挡掉 | 已改 id 为 `_resheath`；保留 `post_action`（复审撤销原「改 pre_action」建议）；补 `slash` |
| 三分归元（_sangui_heal） | `trigger` `heal` `internal` `low_hp` | ✅ | `effects = heal{ratio:0.2} + remove_buff: sangui_yuanqi`；触发源 `passives.ts:11-22`（`hp_below < 0.3` 触发 `_sangui_heal`）；`internal`、`trigger`、`heal`、`low_hp` 全对 | 保持 |
| 炁体源流·觉醒（_qiti_awaken） | `trigger` `internal` `low_hp` | ⚠️ | 触发源 `passives.ts:346-355`（`hp_below < 0.2`）；`effects = cleanse{allDebuffs} + add_buff: qi_shield{10} + add_buff: qiti_awaken_buff + stat_buff{六维+2}` → `buff`/`defense`/`cleanse` 皆缺 | 补 `buff`、`cleanse`（可选 `defense`） |
| 居合（_iaijutsu_ready） | `trigger` `internal` | ⚠️ | `add_buff: iaijutsu`（`stance` 类），`maxUses: 1`；`trigger`/`internal` 正确但缺 `buff`/`stance` | 补 `buff`、`stance` |
| 藏锋·心眼（_cangfeng_mind_eye） | `trigger` `internal` | ⚠️ | `add_buff: mind_eye`（`buffs.ts:121` 暴击 +25%，消耗型）；缺 `buff` | 补 `buff` |
| 疾风·雷闪（_godspeed_counter） | `trigger` `electric` `counter` `internal` | ✅ | `damage{insight 0.2, piercing 1}`，`target:'enemy'`，是被动反击触发招；`counter`/`trigger`/`internal` 正确 | 保持 |
| 顺势反击（_generic_counter） | `trigger` `counter` `internal` | ✅ | 注释「通用反击（无 tag，任何武器可用）」，`damage{strength .1, dexterity .2}` | 保持 |
| 虎彻·看破（_tiger_eye_foresight） | `trigger` `internal` | ✅ | `add_buff: foresight`（招架 +30%）+ `kanchuan`（闪避 +10%），触发源 `artifacts.ts:254` `on_stance`；`trigger`/`internal` 到位（严格说可补 `buff`） | 保持 |
| 解毒（_detox） | `trigger` `internal` | ⚠️ | `effects = cleanse{buffIds:['poison']}`，`maxUses: 999`；`cleanse` tag 存在（`tag.ts:14`）却未标（同族 `_detox_shot`/`_field_dressing` 同样漏） | 补 `cleanse` |
| 自爆（_arm_explosion） | `burn` | ⚠️ | 注释 `internal.ts:144`：「**不用 internal：AI 需能通过 conditionId 主动选用（绝境招），也允许 UI 展示**」，`_arm_explosion` 经 `artifacts.ts:13` `grantsActions` + `opponents/ajiu.ts:33` `conditionId: 'hp_below_50'` 使用——**不标 `internal` 是有意为之，不应改**；但 `damage{fixed:5}` 输出面缺 `damage`/`range`（`getRange [0,5]`） | 保持 `internal` 缺失（有意豁免）；补 `damage`/`range`（可选） |
| 法珠冲击（_orb_shot） | `range` `summon` | ❌ | 来源 `starting-weapons.ts:78` `summon.actionId: '_orb_shot'`（召唤物招式），`damage{fixed:3, piercing:1}`、`getRange = 1+wis/2`；**无 `internal`、无 `trigger`，会被奖励池当普通招式发给玩家——学了也不会被推演命中（不在角色 actionConfigs 触发/装备链）** | 池层已挡（`_` 前缀），不必补 `internal` |
| 无人环撞击（_huan_shot） | `range` `blunt` `summon` | ❌ | 来源 `weapons.ts:234`（`hover_drone.summon.actionId`），`add_debuff: paralyze{0.3}`；无 `internal`，同类高危 | 池层已挡（`_` 前缀），不必补 `internal` |
| 浮游丝（_silk_shot） | `range` `pierce` `summon` | ❌ | 来源 `starting-weapons.ts:60`（御物浮游丝），`functional_damage` 按距离收紧；无 `internal` | 池层已挡（`_` 前缀），不必补 `internal` |
| 一剑西来（_fei_jian_shot） | `range` `slash` `pierce` `summon` | ❌ | 来源 `starting-weapons.ts:96`（御物飞剑），`damage{wisdom .5, fixed 5}`；无 `internal` | 池层已挡（`_` 前缀），不必补 `internal` |
| 分身攻击（_fen_shen_shot） | `summon` | ❌ | 来源 `artifacts.ts:188`（分身召唤物 `actionId`），描述「分身的攻击」，`damage{strength .1, dexterity .1}`；无 `internal`（连 `summon` 都有却漏 `internal`） | 池层已挡（`_` 前缀），不必补 `internal` |
| 飞狮吼（_flying_lion_roar） | `range` `summon` | ❌ | 来源 `artifacts.ts:175`（召唤物招式），`damage{wisdom .3}` + `add_debuff: stun{0.6}`；无 `internal` | 池层已挡（`_` 前缀），不必补 `internal` |
| 凌波微步（_lingbo_insight_step） | `trigger` `buff` `internal` | ✅ | `stat_buff{dodgeChance: 0.02, durationMs: 3000}`，触发招；`buff`/`trigger`/`internal` 齐全 | 保持 |
| 金玲索（_golden_bell_swing） | `blunt` `range` | ❌ | 来源 `artifacts.ts:418` `grantsActions: ['_golden_bell_swing']`，`damage{dexterity .4}` + `add_debuff: paralyze{1}`，`getRange [2,5]`；无 `internal`（artifact 授予但注释说「以炁御之」）且缺 `paralyze`/`debuff` | 池层已挡（`_` 前缀）；补 `debuff`、`paralyze` |
| 嚼茴香豆（_eat_beans） | `pre_action` `buff` | ❌ | 来源 `artifacts.ts:479` `grantsActions`，`add_buff: bean_buff`（`buffs.ts:1151` 全属性 +1，10 秒）；**与同样由 artifact 授予的 `_jiu_*` 五条（都带 `internal`）不一致** | 池层已挡（`_` 前缀），不必补 `internal` |
| 女儿红（_jiu_nv_er_hong） | `pre_action` `buff` `jiu` `internal` | ✅ | `add_buff: nv_er_hong`（每秒回 1.5 血，9 秒），`jiu` 对应酒系 artifact | 保持 |
| 霸王醉（_jiu_ba_wang_zui） | `pre_action` `buff` `jiu` `internal` | ✅ | `add_buff: ba_wang_zui`（每层每秒回 1 缠，9 秒） | 保持 |
| 竹叶青（_zhu_ye_qing） | `pre_action` `buff` `jiu` `internal` | ✅ | `add_buff: zhu_ye_qing`（每层 AP +0.3/s，9 秒） | 保持 |
| 烧刀子（_shao_dao_zi） | `pre_action` `buff` `jiu` `internal` | ✅ | `add_buff: shao_dao_zi`（每层暴击 +7%，9 秒） | 保持 |
| 不老泉（_bu_lao_quan） | `pre_action` `buff` `jiu` `internal` | ✅ | `add_buff: bu_lao_quan`（每 3 秒回 3 血，9 秒） | 保持 |
| 甩刃（_shuai_ren） | `slash` `internal` `trigger` | ✅ | 描述「断刀锁链甩出，如灵蛇出洞」，`requiredTags ['slash']`，`getRange [2,4]`；`internal`/`trigger` 到位 | 保持 |
| 发辫刃（_braid_blade） | `trigger` `slash` `pierce` `internal` | ✅ | 描述「辫中藏刃，回旋飞出」，`damage{strength .1, agility .1, dexterity .1}` | 保持 |
| 止血针（_field_dressing） | `trigger` `heal` `internal` | ⚠️ | `effects = cleanse{buffIds:['bleed'], perDebuffStacks:2}`，`maxUses: 1`；**效果是净化流血，`heal` 反而是空的**（没有 `heal` 效果），且缺 `cleanse` | 去 `heal`；补 `cleanse`（或让 `heal` 描述对应） |
| 解毒针（_detox_shot） | `trigger` `internal` | ❌ | `effects = cleanse{buffIds:['poison'], perDebuffStacks:2}`（注释明确「只解 2 层毒」），是标准净化；`tag.ts:14` 有 `cleanse`，全库却**无一条招式使用 `cleanse`**（`grep cleanse src/data/actions/*` 仅 internal.ts 命中） | 补 `cleanse`（并考虑补 `heal` 与 `_field_dressing` 统一） |
| 肾上腺素针（_adrenaline_shot） | `trigger` `buff` `internal` | ✅ | `add_buff: adrenaline_rush`（`buffs.ts:1199` AP 恢复翻倍 20 秒），`maxUses: 1` | 保持 |
| 暴雨梨花（tempest） | `pierce` `range` `thrown` `chan` | ✅（裁定 J） | 来源 `artifacts.ts:622`（artifact `id:'tempest'`，`tags:['inherent']`，`grantsActions:['tempest']`），`damage{wisdom .2, fixed 3, independentHits:27, piercing:2}`，`chanCost: MAX_CHAN`、`maxUses: 1`；action 自身无 `inherent`/`internal`（artifact 的 `inherent` 只挡 artifact 池，不挡 action 池） | 保持进池（裁定 J）；无需补 `inherent`/`internal` |
| 穿云（_chuan_yun） | `pierce` `polearm` `slash` | ❌ | 描述「三节枪近身缠卷，**绕过盾牌与招架**」，`effects = ignore_parry + damage`，`requiredTags ['polearm']`；**无 `internal`**（同族 `_luo_yue` 也无），且缺 `ignore_parry` | 池层已挡（`_` 前缀）；补 `ignore_parry` |
| 落月（_luo_yue） | `slash` `range` `polearm` | ❌ | 描述「三节枪如鞭般甩出，凌空斩下」，`getRange [3,5]`，`requiredTags ['polearm']`；无 `internal` | 池层已挡（`_` 前缀），不必补 `internal` |
| 阿赖耶识（_alaya_insight） | `trigger` `internal` | ⚠️ | `stat_transfer{stat:'insight', value:1, duration:4000}` 是属性增益，缺 `buff` | 补 `buff` |
| 泼油（_oil_splash） | `debuff` `pre_action` `internal` | ✅ | `add_debuff: oil_coating`（`debuffs.ts:245` 灼烧翻倍、身法 -2），`canUse` 防目标已浸油；`debuff`/`internal` 正确 | 保持 |
| 灵鳌冲（_ling_ao_chong） | `trigger` `internal` `unarmed` `blunt` `melee` | ✅ | 描述「闪避后借势冲向对手，撞出钝击并麻痹」，`short_dash{3}` + `damage{strength .1, agility .1, vitality .1}` + `add_debuff: paralyze{0.6}`，触发源 `passives.ts:995` `on_dodge` | 保持 |
| 音波（_sonic_wave） | `qi` `range` `debuff` | ❌ | 来源 `artifacts.ts:725` `grantsActions: ['_sonic_wave']`（人造发生器），`effects = ignore_parry + damage{wisdom .2} + add_debuff: fumble_chance_temp{2}`；描述与「炁」无关却标 `qi` | 池层已挡（`_` 前缀），不补 `internal`；`qi` 去掉——见「需裁定」 |
| 太上御法·回炁（_tai_shang_heal） | `trigger` `heal` `internal` | ✅ | `heal{value:1}`，注释「召唤物命中时微量回血」；`trigger`/`heal`/`internal` 齐全 | 保持 |

---

## 需裁定（拿不准的）

1. **`pre_action` / `post_action` 的语义边界** —— **已复核，无需改动**（原三条疑问全部不成立）。引擎只用「是否带其中之一」分流（`engine.ts:851` 放行 support 路径、`ai/index.ts:76` 从主招剔除），`ai/support-planner.ts` 再把 `pre_action` 排在主招前、`post_action` 排在主招后。逐条复核：
   - `feng_fan` 同带两者**不会重复释放**：前摇选完后其 id 作为 blacklist 传入收招阶段（`ai/index.ts:151`、`support-planner.ts:24`）；且它是纯位移招，位移招一律不走 support 通道（`support-planner.ts:41`，与阶段无关），实际只由 `planMove` 使用；
   - `wind_hear`、`_resheath` 的 `post_action` **正确**：二者都是「收招补架势」，`_resheath` 的 `canUse: hasNoStance` 更只在主招后才成立（pre 阶段会先被 `canUse` 校验挡掉，见 `support-planner.ts:55`）；
   - `_adrenaline_shot`（`internal.ts`）无 `pre_action`，靠战术腰包的 `trigger` 触发消费，不需要相位标记；
   - 附注（有意设计，非缺陷）：pre/post 招式不算「主招」——`buffs.ts`/`damage.ts` 的 `isMainMove`（天机、疯魔）、血祭 `onAction` 均显式排除 `pre/post/summon`；`character.ts:370` 的 `getMaxActionRange` 同样排除它们。
2. **`buff` 标注到哪一层**。RUBRIC 只要求「真的给角色施加了增益状态」。同文件内有三种现成口径：
   - 只标 buff 机制（`guard`/`dao_ma_dan`/`spirit_sword`/`_eat_beans`）；
   - 只标功能类（`condense_shield` 标 `defense`、`summon_haste` 标 `summon`、`wan_liu_gui_zong` 标 `defense`、`_tai_shang_heal` 标 `heal`）；
   - 两者都标（`jin_zhong_zhao` 标 `buff`+`defense`）。
   我按「两者都标」判了 ⚠️（少标），但如果团队口径是「只标功能类」，则 `wan_liu_gui_zong`、`summon_haste`、`condense_shield`、`agility_steal`、`drone_paralyze`、`jin_zhong_zhao`、`_iaijutsu_ready`、`_cangfeng_mind_eye`、`_alaya_insight`、`_qiti_awaken` 这 10 条应改判 ✅。
3. **`chan` 到底是「消耗缠劲」还是「缠劲奖励」**。`thunder_storm`/`return_spear`/`ru_long`/`yan_quan`/`poison_detonate`/`tian_wai_fei_xian`/`shi_qi`/`big_leap`/`jindou`/`lightning_speed`/`deng_ping_du_shui` 是「消耗」；`wind_hear`（`chanCost` 0，buff 不回缠）像「奖励」；`gear_hang`/`santou_liubi`/`chanzi_heal`/`chanzi_stance` 有 `chanCost` 却无 `chan`。`tag.ts:59` 注释「缠劲（消耗缠/回复缠的奖励标签）」两种都算 → 需统一（我按「消耗即标」判了 ⚠️）。
4. **`tempest` 该不该从奖励池消失** —— 已裁定（J）：**保留在池内**，action 不补 `inherent`/`internal`。原问题：artifact `tempest`（`artifacts.ts:622`）是 `inherent`，但 action `tempest` 无 `inherent`/`internal`，而 `_getActionPool` 不查 `inherent`，所以它会进「学招式」池（唐柔的专属奇物招式可被玩家随机学到）。
5. **`thunder_storm` 的控制类型**：描述写「麻痹」但 `add_debuff: buffId:'stun'`（`stun`=眩晕、控制更硬）。tag `stun` 与实现一致、与描述不一致——是改描述还是改 buffId？
6. **`_sonic_wave` 的 `qi`**：来源是「人造发生器」（`artifacts.ts:725`），`requiredTags: []`、无 `chanCost`、`damage{wisdom .2}`，与炁无关；但同效果的 `bi_hai_chao_sheng_qu` 标 `qi`（描述「以炁御音」）。是否按「以炁驱动」统一保留，还是去掉。
7. **`one_night_dance` 的 `summon`**：`tagRelevance.ts:19` 把 `summon` 定为权重 2 流派；本条 `effects` 无召唤机制（`independentHits: 5`），但 `requiredTags ['imperial']` 的玩家自带 `summon` 武器 tag（`hover_drone` `tags: [..., 'summon']`），标了反而与「御物 build」关联一致——保留 or 去掉？
8. **`blood_droplet` 的 `low_hp`**：`functional_damage: self.hp/9` 是在**扣除 10% 当前血后**取残血，越残伤害越低；`low_hp` 注释为「血量越低越强 / 用血换效果的奖励标签」。「用血换效果」可直接成立 → 是否保留 `low_hp`（我判 ❌ 按「越残越强」字面）。
9. **`血炁护体`/`血滴子` 的 `self_damage`**：二者用 `self_hp_cost`，而 `handlers.ts:273` 只为 `self_damage` 效果广播 `tags:['self_damage']`；`unarmed.ts:205` 的同类自伤因此标了 `self_damage`。若「卖血=自伤」应统一标注，则二者补标；若严格按效果类型，则维持现状（我按后者未计入 ❌）。


---

## 十、奇物（76）

# 奇物（ARTIFACTS）tag 审计

> 口径：`docs/_tag-audit/RUBRIC.md`。数据源：`src/data/artifacts.ts`（76 件）、`src/data/buffs/*.ts`、`src/data/actions/internal.ts`、`src/engine/entities/tag.ts`、`src/game/roguelite/reward-pool.ts`、`src/game/tagRelevance.ts`。
> 本审计为只读，未修改 `src/` 下任何文件。

## 结论摘要

- 实体数：76
- ❌ 6 条 / ⚠️ 46 条 / ✅ 24 条
- 问题归类：
  - **`inherent` 误标（硬错误）**：`inherent` 被 `reward-pool.ts:97` 用于把奇物排除出随机奖励池，标注口径为「义体 / 血脉限定」（`reward-pool.ts:96` 注释）。3 件**通用防具**（乌铠 `iron_will`、冰蚕衣 `frost_silk_robe`、斗铠 `combat_armor`）被标 `inherent`，玩家永远抽不到；1 件**义体**（人造发声器 `sonic_generator`）漏标 `inherent`，会进随机池（其余 14 件 implant 全部带 `inherent`）。
  - **元素 / 状态漏标**：`frost`（冰蚕衣招架后叠霜冻）、`paralyze`（金玲索/磁暴线圈）、`burn`（钛合金臂自爆）、`bleed`（软猬甲）、`stun`（飞狮吼）、`cleanse`（蜂草鱼囊 / 青囊三宝 / 战术腰包 / 自动净化背心）。
  - **`buff` 少标（方向无错）**：本次未发现「把 buff 当实现手段/内部标记却标了 `buff`」的假阳性；问题全在漏标——义体 stat_buff 真增益 9 件、酒类正面状态 4 件、血祭护腕、浮游眼等。义体体系统一不标 `buff`（与血脉/craft 同类奇物口径分歧）。
  - **`damage` 系统性缺标**：76 件奇物**无一**带 `damage`；而 `passives.ts` 有 6 处 `damage`。明确增伤的奇物（凝炁玉、守宫砂、血祭护腕、七心海棠、磁暴线圈、武学宝典上）均未标。
  - **`craft` 语义漂移**：`tag.ts` 定义 craft =「锻造品（天工出品，无副作用的人造装备）」，但药心石（药屋传家宝 + 持续耗炁）、玄门法衣（聚缠法衣）、忍者工具包（忍者随身油囊）、自动净化背心（秘制背心）、人造发声器（义体研究部特制）的描述均非「天工出品」。
  - **语义漂移 / 误关联**：浮游眼 `summon`（无 `summon` 定义）、凝炁玉缺 `qi`（增益仅对 qi 招式生效）、九阴真经 `qi`、聚缠法衣 `qi`、两件架势奇物缺 `stance`、液压腿缺 `move`。
  - **`debuff` 方向全部正确**：3 件带 `debuff` 的奇物（十香软筋散、西域奇毒、忍者工具包）均把负面状态施加给对手；自罚（义体 `ap_drain`/`overload`/`muscle_degradation`、斗铠身法-2、血祭护腕耗血）未被误标为 `debuff`，符合口径。
  - **`dot` 标签全库死标签**：`src/data/` 下无任何实体使用 `dot`（毒/流血类奇物也未标），见「需裁定」。

## 明细

| 实体 | 现 tags | 判定 | 理由（引用 effects/triggers/description） | 建议 |
| --- | --- | --- | --- | --- |
| 钛合金臂（titanium_arm） | `implant` `inherent` | ⚠️ | 义体身份正确（`implant`+`inherent`，`description`「重型钛合金义肢…可飞向对手自爆」）；`grantsActions: ['_arm_explosion']`，该招式 `tags: ['burn']`，对敌 `add_debuff burn stacks:8`、并对自身 `add_buff blood_loss`/`one_arm_buff`。自爆的灼烧与自伤代价未反映 | 可补 `burn`；按口径 `self_damage`（自伤代价）可补 |
| 液压腿（hydraulic_leg） | `implant` `inherent` | ⚠️ | `actionEnhancer` 对含 `damage` 的招式前置 `{ type:'short_dash', maxDistance:1 }`（冲刺/位移），`on_equip` 叠 `hydraulic_leg_speed`（移动效率+10%）。位移机制明确但未标 | 补 `move` |
| 机械眼球（mechanical_eye） | `implant` `inherent` | ⚠️ | `stat_buff {insight:4}` 为真增益，`insightReductionHalf()`＝洞察降低减半（防御性抗减益，`insightGuard.ts:24`）。`ap_drain` 为自罚，不计 `debuff`（正确） | 可补 `buff`、`defense` |
| 肌肉强化针（muscle_boost） | `implant` `inherent` | ⚠️ | `stat_buff {strength:5, agility:5}` 真增益；`muscle_degradation`（体/巧-2）为自罚不标 `debuff`（正确） | 可补 `buff`（口径分歧见需裁定） |
| 纳米金属心脏（nano_metal_heart） | `implant` `inherent` | ⚠️ | `stat_buff {strength:2, agility:2, dexterity:1}` 真增益；`ap_drain` 自罚 | 可补 `buff` |
| 合成肺叶（synthetic_lung） | `implant` `inherent` | ⚠️ | `stat_buff {vitality:2, strength:1, agility:1}` 真增益，无触发 | 可补 `buff` |
| 人造神经网络（neural_net） | `implant` `inherent` | ⚠️ | `stat_buff {agility:1, dexterity:4, insight:1}` 真增益；`fumble_chance`（永久失心，动作失败率）为自罚不标 `debuff`（正确） | 可补 `buff` |
| 战斗芯片（combat_chip） | `implant` `inherent` | ⚠️ | `stat_buff {wisdom:5}` 真增益；`fumble_chance` 自罚 | 可补 `buff` |
| 便携式核动力炉（power_furnace） | `implant` `inherent` | ⚠️ | `description`「输出炁态能量供炼炁士使用，加速炁的恢复」；`battle_start` 叠 `nei_xi_peng_pai`（`buffs.ts:1471` 每层 AP 恢复+10%）＝真增益，另叠 `permanent_burn`（过热，自身每 3 秒 1% 最大气血，自罚） | 按描述补 `qi`；可补 `buff`（注：奇物 `qi` 只影响关联权重，无战斗数值副作用） |
| 毒腺（venom_gland） | `implant` `inherent` `poison` | ⚠️ | `description`「每10秒消耗3层自身毒素，获得1点洞察」；`venom_gland` buff（`buffs.ts:993`）确实 `insight+1` 30 秒＝真增益；`poison` 与自身毒层机制绑定（正确） | 可补 `buff` |
| 髓泵（marrow_pump） | `implant` `inherent` | ⚠️ | `effects: max_hp_mod +60` 真增益；`ap_drain` 自罚（`description`「装置耗能」） | 可补 `buff` |
| 人造耳蜗（cochlear_implant） | `implant` `inherent` | ⚠️ | `stat_buff {insight:4, wisdom:1}` 真增益，无触发 | 可补 `buff` |
| 战斗芯片·改（doctor_chip） | `implant` `inherent` | ⚠️ | `stat_buff {wisdom:4}` + `combat_chip` buff（命中/暴击各+3%/层，`buffs.ts:1537`）真增益；`fumble_chance` 自罚 | 可补 `buff` |
| 浮游眼（floating_eye） | `imperial` `summon` | ❌ | 奇物**无 `summon` 字段**（对比 `flying_lion`/`fen_shen_qiu` 均有 `summon`），`effects` 只是 `add_buff floating_eye_buff`（`buffs.ts:1208` 洞察+4、暴击+10%） | 去掉 `summon`；补 `buff`；`imperial` 见需裁定 |
| 飞狮（flying_lion） | `summon` `imperial` | ⚠️ | `summon` 定义存在（`_flying_lion_roar`），`imperial`（御物）成立；但狮吼 `add_debuff stun stacks:1 chance:0.6`（`internal.ts:249`）未标 | 补 `stun` |
| 分身球（fen_shen_qiu） | `summon` | ⚠️ | `summon` 定义存在（`_fen_shen_shot`）正确；`description`「以炁维持分身」、`fen_shen_cost`（`debuffs.ts:223`「以炁维持分身」）→ 炁/御物关联未标；`on_equip max_ap_mod -1` 与耗炁为自罚，不计 `debuff`（正确） | 见需裁定（是否补 `qi`/`imperial`） |
| 菩提头环（pu_ti_tou_huan） | `buff` `defense` | ✅ | `stat_buff {wisdom:4}` 真增益；`stat_restriction` 50% 抵抗推演降低＝防御价值（`description`「推演+4，50%抵抗推演降低」） | 无需调整 |
| 血棘戒（blood_thorn_ring） | `trigger` `bleed` | ⚠️ | `blood_thorn_suppress`（`damage.ts:404`）暴击额外伤害按 14:1 转 `bleed`，对敌叠流血：`bleed`/`trigger` 正确；但「暴击的额外伤害转为流血层数」本质是输出增益，未标 `damage` | 见需裁定（`damage` 口径） |
| 血棘耳环（blood_thorn_earring） | `trigger` `bleed` `pierce` | ✅ | `requiredTags: ['pierce']` 与 `description`「持枪（刺）攻击」自洽；`blood_thorn_earring_buff`（`damage.ts:425`）刺击暴击+7%、对流血目标再+8% | 无需调整 |
| 通明符（wisdom_talisman） | `trigger` `buff` | ✅ | `stat_buff {insight:1}`＋`trigger_slot_mod +1`（额外承载一道触发），`trigger`/`buff` 均命中 | 无需调整 |
| 天生道种（innate_seed） | `inherent` | ✅ | 无 effects/triggers；功能在 `character-gen.ts:22`（持有时 +8 修炼点）与 `stories/sect.ts:12` 授予，属血脉特性，`inherent` 正确 | 无需调整 |
| 虎彻之眼（tiger_eye） | `trigger` `buff` | ⚠️ | `on_stance` → `_tiger_eye_foresight` 给 `foresight`（招架+30%）+`kanchuan`（闪避+10%），真增益、`trigger` 正确；`requiredTags: ['stance']` 且「进入居合时」＝架势收益 | 可补 `stance` |
| 定心香氛（calming_talisman） | `buff` | ⚠️ | `calming_fragrance`（洞察+2推演+2）+`calming_aftertaste` 真增益；但由 `on_stance` 驱动、`requiredTags: ['stance']` | 可补 `stance`、`trigger` |
| 吞炁囊（qi_guard） | `trigger` `defense` `qi` | ✅ | `battle_start` 叠 `qi_shield` 30 层（`defense.ts:10` 炁伤吸收2/非炁1），`description`「开局凝聚30层炁盾」 | 无需调整 |
| 乌铠（iron_will） | `trigger` `defense` `inherent` | ❌ | `description`「受到超过5点的拳脚/斩/刺/钝伤害时，消耗1AP减少4点」为通用护甲，既非义体也非血脉/先天特性，却因 `inherent` 被 `reward-pool.ts:97` 永久排除随机池。另：`dmg_reduce`（`defense.ts:28`）实际消耗**缠劲**（1缠-4点）并限 20 次，与描述「1AP」不符 | 去掉 `inherent`；按引擎补 `chan`；描述需与引擎对齐 |
| 凝炁玉（qi_amplifier） | `trigger` `buff` `craft` | ❌ | `description`「天工锻造的炁能增幅器，增幅炁系武器的锋芒」；`qi_amplify`（`damage.ts:71`）在 `onDealDamage` 里先判 `source.tags.includes('qi') || attacker.weaponDef.tags.includes('qi')`，非炁 build 完全无效。奇物缺 `qi` 会被非炁 build 抽到（错误关联） | 补 `qi` |
| 青竹斗笠（bamboo_hat） | `defense` | ⚠️ | `ranged_dodge` 闪避加成＝防御价值（正确）；但 `description`「距离≥5 额外 +15% 闪避」与 buff（`defense.ts:117` 距离≥4m、+20%）不一致（非 tag 问题，顺带记录）；同类触发型奇物多标 `trigger` | 可补 `trigger`；数值描述需对齐 |
| 冰蚕衣（frost_silk_robe） | `defense` `inherent` | ❌ | `frost_silk_robe_buff`（`defense.ts:823`）招架率+12%，招架近战后 `add_debuff frost`（对敌叠霜冻）——`frost` 元素漏标；且 `description`「冰蚕丝织就的软甲」为通用防具，无血脉/义体特征，`inherent` 会使其永远进不了随机池 | 去掉 `inherent`；补 `frost`；可补 `counter`（招架反制） |
| 淬毒工具（poison_coating） | `poison` `trigger` | ✅ | `poison_coating` buff（`buffs.ts:1492`）对 `pierce`/`slash` 招式 30% 概率给对手叠 `poison`，`description`「刃上淬毒，割裂或刺击时概率令其中毒」一致 | 无需调整 |
| 十香软筋散（shixiang_ruanjin_san） | `poison` `debuff` `trigger` | ✅ | `shixiang_ruanjin_san` buff（`buffs.ts:1510`）中毒时对**敌人**叠 `weakness`，`debuff` 方向正确 | 无需调整 |
| 西域奇毒（western_poison） | `debuff` `poison` `trigger` `paralyze` | ✅ | `western_poison_buff`（`buffs.ts:1658`）每次中毒对敌叠 3 层麻痹，方向与元素均正确 | 无需调整 |
| 他山之石（other_mountain） | `buff` | ✅ | `stat_buff {dexterity:1, insight:2, wisdom:2}` 真增益，`description`「博采众长，洞察入微」一致 | 无需调整 |
| 药心石（yao_xin_shi） | `craft` `defense` | ⚠️ | `defense` 正确（`yao_xin_shi_buff` 每 2 秒减免 3 点）；但 `craft` 定义为「天工出品」（`tag.ts:57`），而 `description`「药屋世代相传的护心石」非天工造物，且 buff 有副作用（`apRegenPerSec: -0.1`，与「无副作用」矛盾） | 依口径去 `craft`（或改描述） |
| 守宫砂（cinnabar_mole） | `trigger` `inherent` | ⚠️ | `cinnabar_mark`（`damage.ts:117`）每击叠雷印、满 4 引爆伤害×1.5＝显著增伤，未标 `damage`；`inherent`（龙虎山秘传之印）成立 | 见需裁定（`damage` 口径） |
| 金丝手套（golden_silk_gloves） | `defense` `craft` | ⚠️ | `effects: parry_mod 0.15`、`silk_guard`（`defense.ts:169`）`onCanParry: true` + 缴械抗性 30%，`description`「招架率+15%，空手可招架」＝与招架机制直接相关 | 补 `parry` |
| 蜂草鱼囊（herb_pouch） | `trigger` `heal` | ⚠️ | `herb_pouch` buff（`buffs.ts:552`）每 4 秒解毒 1 层并回 2 气血：`heal` 正确；「化解毒素」＝净化自身未标 | 补 `cleanse` |
| 菩斯曲蛇胆（snake_gall） | `buff` `inherent` | ✅ | `stat_buff {strength:2, vitality:2}` 真增益；服食异种蛇胆属身体特性（`inherent` 口径「血脉限定/特性」） | 无需调整 |
| 莽牯朱蛤（frog_gall） | `buff` `inherent` | ✅ | `stat_buff {dexterity:1, agility:1}`＋`poison_resist`（百毒不侵，`defense.ts:202`）真增益 | 无需调整 |
| 火眼金睛（fiery_eyes） | `buff` `inherent` | ✅ | `stat_buff {insight:5}` 真增益；`description`「历经焚炼」＝身体特性 | 无需调整 |
| 软猬甲（soft_hedgehog_mail） | `defense` `craft` | ⚠️ | `soft_armor`（`defense.ts:305`）减免所有伤害（`defense` 正确）；受拳脚攻击时给对手叠 `bleed`（`description`「反伤并令对手流血」）——`bleed`、`counter`（受击反制）未标；注意实现只叠流血、并无直接反伤 | 补 `bleed`、`counter`；描述「反伤」与实现不符 |
| 金玲索（golden_bell_rope） | `defense` | ⚠️ | `golden_bell_guard` 防御正确；`grantsActions: ['_golden_bell_swing']`（`internal.ts:265` `blunt`/`range`、`add_debuff paralyze chance:1`） | 补 `paralyze`；`range`/`blunt` 视「奇物是否携带招式形态 tag」口径；`qi`（描述「以炁御之」）见需裁定 |
| 蛊童圣体（gu_tong_body） | `inherent` `poison` | ✅ | `gu_tong_body` buff（`buffs.ts:901`）拳脚命中 40% 给对手叠毒、自身毒体减免 75%，`description`「从小被蛊毒炼就的毒体」＝身体特性 | 无需调整 |
| 蚀蛊（shi_gu） | `inherent` `poison` | ✅ | `shi_gu_buff`（`buffs.ts:931`）使施加的中毒每跳 20% 加深，`poison` 正确；`description`「自幼炼蛊」＝特性 | 无需调整 |
| 凝缠珠（chan_orb） | `buff` `chan` | ✅ | `chan_orb_regen`（`buffs.ts:353`）`chanRegenPerSec: () => 1`＝持续回复缠劲，`chan` 口径（消耗/回复缠劲）命中 | 无需调整 |
| 九阴真经（jiu_yin_zhen_jing） | `buff` `qi` `chan` | ⚠️ | `jiu_yin_zhen_jing_buff`（`buffs.ts:464`）`chanRegenPerSec: 洞察×0.1`＝缠劲回复，`chan`/`buff` 正确；但 `description`「以洞察悟缠劲」与**炁**无关（缠劲与内息/炁是不同资源，见 `gameplay-guide.md` 第三节），`qi` 属语义漂移（该 buff 自身也只标了 `qi`） | 依口径去 `qi`（若把「内功」宽解为炁则保留，见需裁定） |
| 血祭护腕（blood_sacrifice_armband） | `buff` `craft` `low_hp` | ⚠️ | `blood_sacrifice`（`damage.ts:213`）每招耗 1% 最大气血→等额额外伤害（`onDealDamage`）并挂 `blood_recovery`（`buffs.ts:1284` 每跳回血 5 秒）：`buff` 正确；但「额外伤害」未标 `damage`、「缓慢回复」未标 `heal`；`low_hp` 见需裁定 | 补 `damage`、`heal`；`low_hp` 待裁定 |
| 胁差（wakizashi） | `weapon` `counter` | ✅ | `triggers: [{ condition: { type:'on_dodge' }, actionId:'pursuit_thrust' }]`，`internal.ts:105`「顺势反击」`tags: ['trigger','counter',...]`，`description`「闪避后可立即反击」一致 | 无需调整 |
| 机巧面具（iron_mask） | `buff` `craft` | ✅ | `stat_buff {insight:3, wisdom:2}` 真增益，`description`「天工锻造的黑铁面具」与 `craft` 一致 | 无需调整 |
| 茴香豆（hui_xiang_dou） | `buff` | ✅ | `grantsActions: ['_eat_beans']` → `bean_buff`（`buffs.ts:1151` 全属性+1，10 秒），`description`「全属性+1，持续10秒」一致 | 无需调整 |
| 女儿红（nv_er_hong） | `jiu` | ⚠️ | `nv_er_hong` buff（`defense.ts:466`）每秒回 1.5 气血＝真实回血＋正面状态；`jiu` 正确，但 `heal`/`buff` 未标（同类正面状态奇物均标 `buff`） | 补 `heal`、`buff` |
| 霸王醉（ba_wang_zui） | `jiu` `chan` | ✅ | `ba_wang_zui` buff（`defense.ts:476`）每层每秒回 1 缠劲，`chan` 口径命中 | 无需调整 |
| 竹叶青（zhu_ye_qing） | `jiu` | ⚠️ | `zhu_ye_qing` buff（`defense.ts:447`）每层 AP 恢复+0.3/秒，`description`「内息奔涌」＝正面状态；`jiu` 正确但缺 `buff` | 补 `buff` |
| 烧刀子（shao_dao_zi） | `jiu` | ⚠️ | `shao_dao_zi` buff（`defense.ts:485`）每层暴击率+7%＝输出增益；`jiu` 正确但缺 `buff`/`damage` | 补 `buff`（`damage` 见需裁定） |
| 不老泉（bu_lao_quan） | `jiu` | ⚠️ | `bu_lao_quan` buff（`defense.ts:456`）每 3 秒回 3 气血＝真实回血 | 补 `heal`、`buff` |
| 青囊三宝（qing_nang_san_bao） | `heal` | ⚠️ | `qing_nang_san_juan`（`buffs.ts:1314`）有毒解毒、没毒回 7 气血：`heal` 正确；「解毒/止血」（解除负面）未标 | 补 `cleanse` |
| 菩提珠串（pu_ti_zhu） | `buff` `defense` | ✅ | `stat_buff {wisdom:3}` 真增益；`pu_ti_zhu_buff`（`defense.ts:662`）50% 免疫临时失心＝防御价值 | 无需调整 |
| 百纳珠（bai_na_zhu） | `defense` | ✅ | `bai_na_zhu_buff`（`defense.ts:783`）`onCritTakenDamage: -0.3`，`description`「被暴击伤害降低30%」一致 | 无需调整 |
| 斗铠（combat_armor） | `defense` `inherent` | ❌ | `description`「百战之铠，非炁伤害减免，但身法-2」为通用铠甲，非义体/血脉，`inherent` 导致永远不进随机池（`reward-pool.ts:97`）；`combat_armor_def`（`defense.ts:415`）减伤＝`defense` 正确，身法-2 为自罚不计 `debuff`（正确） | 去掉 `inherent` |
| 聚缠法衣（ju_chan_fa_yi） | `craft` `buff` `qi` `chan` | ⚠️ | `ju_chan_fa_yi` buff（`buffs.ts:362`）吸缠化属性（力/身/巧/推演+2）＝真增益，`chan`/`buff` 正确；但机制只涉及**缠劲**，「玄门法衣」也无炁机制（`qi` 漂移），且非「天工出品」（`craft` 漂移） | 建议去 `qi`、`craft`（需裁定） |
| 发辫刃（braid_blade） | `weapon` `inherent` | ⚠️ | `on_opponent_move_away` → `_braid_blade`（`internal.ts:349` `slash`/`pierce` 追击）：`weapon`/`inherent`（发辫一体）可接受，但追击＝受激反制、招式形态 tag 未随身 | 可补 `slash`、`pierce`、`counter` |
| 战术腰包（tactical_pouch） | `trigger` `heal` | ⚠️ | `grantsActions: ['_field_dressing','_detox_shot','_adrenaline_shot']`：止血针/解毒针为 `cleanse`（`internal.ts:368/380`），肾上腺素针 `add_buff adrenaline_rush`（真增益）；`heal` 正确，缺 `cleanse`/`buff`；第三个触发条件为 `hp_below`（`ctx.actor.hp/maxHp < 0.5`） | 补 `cleanse`、`buff`、`low_hp` |
| 七心海棠（qi_xin_hai_tang） | `poison` `inherent` | ⚠️ | `qi_xin_hai_tang` buff（`buffs.ts:1425`）使施加的中毒伤害翻倍＝显著增伤，`poison` 正确但缺 `damage`；非血脉却标 `inherent`（见需裁定） | 补 `damage`；`inherent` 待裁定 |
| 暴雨梨花钉（tempest） | `inherent` | ⚠️ | `grantsActions: ['tempest']`（`internal.ts:394`：`pierce`/`range`/`thrown`/`chan`，5AP+满缠，27 段独立命中）；奇物自身未携带任何招式形态 tag；「机簧暗器」是否属血脉/义体存疑 | 可补 `pierce`/`range`/`thrown`/`chan`；`inherent` 待裁定 |
| 战术护目镜（tactical_goggles） | `craft` `buff` | ✅ | `stat_buff {wisdom:2, insight:2}`＋`insightReductionHalf()` 真增益，`description`「天工出品」与 `craft` 一致 | 无需调整 |
| 纳米外骨骼（nano_exoskeleton） | `craft` `buff` | ✅ | `stat_buff {strength:3, agility:3}` 真增益；`energy_drain`（每层 AP 回复-0.1/s）为自罚，不标 `debuff`（正确） | 无需调整 |
| 喷气式机动装置（jet_drive） | `craft` `buff` | ⚠️ | `rocket_boost`（`defense.ts:603` 免疫击倒）＋`jet_drive_speed`（移动效率+20%）真增益，`buff` 正确；`description`「免疫击倒」属控制免疫（防御价值）未标 | 可补 `defense`（`super_armor` 口径需裁定） |
| 能量护盾（energy_shield） | `craft` `defense` | ✅ | `energy_shield_buff`（`defense.ts:570`）以缠化盾吸收直伤（1缠:1伤），`description`一致 | 无需调整 |
| 蓄炁瓶（qi_battery） | `craft` `buff` | ⚠️ | `nei_xi_peng_pai`（每层 AP 恢复+10%）＝真增益（`buff` 正确）；`description`「天工锻造的炁能储存装置」→ `qi` 未标；`max_ap_mod -1` 为自罚不计 `debuff`（正确） | 可补 `qi`（口径见需裁定） |
| 磁暴线圈（ci_magnetic_coil） | `craft` `electric` `buff` | ⚠️ | `ci_magnetic_coil_buff`（`buffs.ts:1594`）电系招式伤害+15%＝`electric` 正确；「施加的麻痹层数翻倍」未标 `paralyze`；增伤未标 `damage` | 补 `paralyze`；`damage` 见需裁定 |
| 忍者工具包（ninja_tool_kit） | `craft` `debuff` | ⚠️ | `grantsActions: ['_oil_splash']` → 对敌叠 `oil_coating`（`debuffs.ts:245` 灼烧翻倍、身法-2），`debuff` 方向正确；`craft` 与「忍者随身油囊」不符（非天工出品） | 依口径去 `craft`；可补 `burn`（与灼烧联动） |
| 悬浮座椅（wheelchair_lightness） | `implant` `inherent` | ⚠️ | `wheelchair_speed`（`buffs.ts:425` 身法+2、移动效率+15%）真增益，缺 `buff`；`description`「以炁驱动」→ `qi` 可议 | 可补 `buff`；`qi` 见需裁定 |
| 人造发声器（sonic_generator） | `craft` `qi` `implant` | ❌ | 其余 14 件 `implant` 均带 `inherent`（义体不进随机池），此件漏标 → 会出现在随机奖励池（不该抽却能抽到）；`description`「义体研究部特制音波发声器」为义体，与 `craft`（天工造物）冲突；`grantsActions: ['_sonic_wave']`（`qi`/`range`/`debuff`）中 `qi` 已标，`debuff`/`range` 未标 | 补 `inherent`；去 `craft`（需裁定）；可补 `debuff`/`range` |
| 武学宝典总纲（wuxue_baodian_zonggang） | `buff` | ⚠️ | `wuxue_baodian_zonggang`（`buffs.ts:1023`）闪避/招架→叠 `martial_arts_crit`、暴击→叠 `martial_arts_dodge`，真增益（非纯载体），`buff` 正确；衍生攻防收益未标 | 可补 `damage`、`defense` |
| 武学宝典上（wuxue_baodian_shang） | `buff` | ⚠️ | `wuxue_baodian_shang`（`buffs.ts:1054`）每奖励标签伤害+1%（上限15%）＝输出增益，缺 `damage` | 补 `damage` |
| 武学宝典下（wuxue_baodian_xia） | `buff` | ⚠️ | `wuxue_baodian_xia`（`buffs.ts:1067`）每奖励标签受到伤害-1%（上限15%）＝防御价值，缺 `defense` | 补 `defense` |
| 自动净化背心（auto_purify_vest） | `defense` `craft` | ⚠️ | `auto_purify`（`buffs.ts:1345`）每 5 秒净化 1 层可净化负面（耗 1 缠劲）＝净化自身，`cleanse` 未标（`defense` 语义勉强）；`description`「秘制背心」非天工出品 | 补 `cleanse`；依口径去 `craft` |

## 需裁定（拿不准的）

1. **`low_hp` 口径冲突**：RUBRIC 二写「低血触发、越残越强才标」，而 `tag.ts:60` 注释含「用血换效果的奖励标签」。血祭护腕 `blood_sacrifice`（`damage.ts:213`）只按最大气血 1% 固定耗血、**无低血阈值/越残越强**，却标了 `low_hp`。按 RUBRIC 应去，按 tag.ts 注释可留。另：战术腰包有真正的 `hp_below 0.5` 触发，反而未标 `low_hp`。
2. **义体是否统一补 `buff`**：14 件 `implant` 的 `stat_buff` 都是真增益却不标 `buff`，而同为 `stat_buff` 的血脉奇物（菩斯曲蛇胆/莽牯朱蛤/火眼金睛）与 craft 奇物（机巧面具/战术护目镜/纳米外骨骼）都标了 `buff`。是「义体统一不标」还是漏标？
3. **`damage` 是否适用于奇物**：76 件奇物无一标 `damage`，而 `passives.ts` 有 6 处 `damage`；明确增伤者（凝炁玉 `damage.ts:71`、守宫砂 `damage.ts:117`、七心海棠 `damage.ts:1425`、血祭护腕 `damage.ts:213`、武学宝典上 `buffs.ts:1054`、磁暴线圈 `buffs.ts:1594`）是否统一补 `damage`/`bonus_damage`？
4. **`dot` 是死标签**：`grep "'dot'" src/data/` 无任何命中（actions/passives/weapons/buffs 全无）。毒/流血类奇物（淬毒工具、十香软筋散、西域奇毒、软猬甲、血棘戒）是否应补 `dot`，还是废弃该 tag？
5. **`craft` 口径**：`tag.ts:57` 写「天工出品，无副作用的人造装备」，RUBRIC 写「义体/天工造物」。药心石、玄门法衣（聚缠法衣）、忍者工具包、自动净化背心、人造发声器 5 件的描述都不是「天工出品」（药心石还有持续耗炁副作用）。是保留 `craft` 作「人造物」宽义，还是收窄到描述含「天工」者？
6. **`inherent` 的边界**：乌铠/冰蚕衣/斗铠三件通用防具被判 ❌（应进随机池）；而暴雨梨花钉（机簧暗器）、七心海棠（唐门至毒）同样非血脉/义体却标 `inherent`。若设计上「对手专属装备一律不进随机池」，这三件的 ❌ 需降级为 ⚠️；请确认 `inherent` 对奇物是否等同「非随机获取」。
7. **`sonic_generator` 是否应 `inherent`**：它是唯一不带 `inherent` 的 `implant`，但它同时带 `craft`（天工造物可随机）。二者只能取一，取决于它是「义体」还是「天工造物」。
8. **`qi` 的边界（内息 vs 炁）**：`gameplay-guide.md` 把内息（AP）与炁分列，但 `buffs.ts` 里 `jiu_yin_zhen_jing_buff`（缠劲）、`ju_chan_fa_yi`（缠劲）都标了 `qi`。据此，便携式核动力炉、蓄炁瓶（均为内息回复、描述称「炁能」）是否补 `qi`？九阴真经/聚缠法衣的 `qi` 是否应去？注：奇物 `qi` 目前只影响 `tagRelevance` 关联权重，不参与战斗判定（`qi` 判定读的是 action/weapon tags，见 `defense.ts:15`、`damage.ts:77`）。
9. **`imperial` 的边界**：浮游眼无 `summon` 字段、无御物耗炁，仅给自身 buff，`imperial` 是否成立？分身球（`fen_shen_cost`「以炁维持分身」）是否应补 `imperial`/`qi`？
10. **`stance` 是否要落到奇物上**：虎彻之眼、定心香氛用 `requiredTags: ['stance']` 门控且收益与架势相关，但奇物自身无 `stance` tag（全库奇物均无）。是否需要统一补？
11. **`trigger` 口径不一致**：13/76 标 `trigger`，但几乎每件奇物都有 `triggers` 数组（如冰蚕衣 `on_equip`、软猬甲 `battle_start`、能量护盾 `on_equip` 均未标）。`trigger` 是指「进入触发槽 build」还是「任意 triggers 数组」？
12. **描述与实现不一致（非 tag 问题，顺带记录）**：乌铠描述「消耗1AP减少4点」vs `dmg_reduce` 实为「1缠劲减4点、限20次」；青竹斗笠描述「距离≥5 额外+15%」vs `ranged_dodge` 实为「≥4m、+20%」；软猬甲描述「反伤并令对手流血」vs `soft_armor` 只叠 `bleed` 无直接反伤；女儿红描述「持续5秒」vs buff「持续9秒」。
