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

1. **`internal` 漏标 → 内部招式进奖励池（已验证）**
   `internal.ts` 共 38 条，其中 **15 条没有 `internal`**；`reward-pool.ts:104` 的 `_getActionPool()` 直接 `allMainActions` 且**不按 `internal` 过滤**，`engine.ts:413` 的筛选也不查该 tag（过滤只发生在 UI 层的构筑界面）。
   受害最明显的是 `_orb_shot` / `_huan_shot` / `_silk_shot` / `_fei_jian_shot` / `_fen_shen_shot`：它们既无 `internal` 也**无 `trigger`**，会作为「学招式」奖励直接发给玩家，学了永远不生效 —— **死奖励**。
   （`_arm_explosion` 是**有意豁免**：`internal.ts:144` 注释说明 AI 需经 `conditionId` 主动选用。）

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
   - `pre_action`/`post_action`：`feng_fan` 同带两者（AI 会重复释放）、`wind_hear`/`resheath` 该蓄势却标收招；
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
| F | **`pre_action` / `post_action` 的边界与互斥** | `feng_fan` 同带两者（AI 会重复释放）；`wind_hear`/`resheath` 是蓄势却标 `post_action` | 定为互斥；请给一句定义（前摇/前置 vs 收招/后置） |
| G | **`inherent` 的边界（剩余）** | `tai_shang_yu_fa`（玄门祖传）未标；`ling_long_xin_qiao` 仅数值增益却被永久排除；只在特定对手处授予的 `zui_quan`；以及"对手专属装备是否一律不进池" | 定为「**血脉/传承特性、不应被随机获取**」，逐条按"能否被抽到"判定 |
| H | **武器上的 `unarmed` / 多攻击类型** | 匕首/忍者刀/鹤山剑带 `unarmed`（握兵器也能吃拳脚招）；玄铁重剑同时带 `blunt`+`slash`+`pierce` | 去掉"握兵器还能用拳脚招"的 `unarmed`；多攻击类型（重剑）保留 |
| I | **形态 tag 在功法上的使用** | 110 个功法 `thrown`/`move`/`range`/`melee` 合计 0 处；`bai_ju_guo_xi`（3 米内）、`hearing_power`（徒手）属明显形态 | 给"形态明确"的功法补形态 tag（参与权重即可） |
| J | **招式池的两处泄漏** | `tempest`（唐柔专属奇物招式）无 `internal`/`inherent` 会进池；15 条 `internal.ts` 招式漏标 `internal` | 与 `internal` 那批一起处理：池层过滤 `internal`，`tempest` 补标 |

另有**一批描述与机制不符**（`thunder_storm` 写麻痹实为眩晕、`hearing_power` 写徒手实为任意命中、`ru_lai_shen_zhang` 形态、`soft_armor` 等已改）—— 建议单独出一轮文案同步清单。

## 七、第二轮裁定（A–J）

| # | 你的裁定 | 待办 |
| --- | --- | --- |
| **A** | **能叠层的一般都算 `buff`；叠层上限翻倍也算** | 据此**撤销** passives-a 里大部分"多标 buff"判定（只放大时长/计数载体只要给角色带来数值或能力收益即保留）；仅"引用的 buff 自身零收益"（给对手上负面、纯回血、纯触发）仍不算 buff |
| **B** | **`qi` 只有真的有炁机制的才算**；炁系伤害一般表现为穿透或增加距离（设计备注） | 去掉 `铁布衫`/`万象剑意`/`越女剑法` 等的 `qi`；描述写"以炁驱动"的 8 把武器补 `qi`（⚠️ 会真改数值，需单独确认） |
| **C** | **`heavy` = 重型武器，不是"巨型双手"** | 更新 `tag.ts:29` 注释 |
| **D** | 待你定（建议见报告） | 推荐**删掉 `damage`**，`support-planner.ts:79` 改为只看 `buff` |
| **E** | **short_dash 不算 `move`**；`chanCost` 与 `chan` 必须一致；**穿透不算 `ignore_parry`** | `wind_hear` 去掉 `chan`；8 条有 `chanCost` 的补 `chan`；穿透类不标 `ignore_parry` |
| **F** | 同带 `pre_action`+`post_action` = 招前招后都能放，但**不应释放两次** | 记录为待研究：改完 tag 后查 AI 会不会重复放 |
| **G** | **功法上的 `inherent` 只表示"不进普池"**（原意是"飞龙探云手能否被偷"，该机制已移除） | 按"是否应进普池"逐条判 |
| **H** | 武器带 `unarmed` **没问题**（持匕首时本就能同时用拳脚）；**`阿赖耶识` 的 `unarmed` 去掉** | 白山"同时释放拳脚招式"改用别的方式 → 记录，后续讨论 |
| **I** | `thrown`/`range`/`melee` 该标就标；**`move` 只有「凤舞九天」该标** | 按此批量 |
| **J** | **`tempest` 可以进池**（不改）；**`internal.ts` 里的都要标上 `internal`** | 15 条补标；⚠️ 例外 `_arm_explosion`（`internal.ts:144` 注释：AI 需经 conditionId 主动选用；`ai/index.ts:76-80` 会把 `internal` 从 AI 候选中剔除）→ 需确认或豁免 |

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

- `internal.ts` 15 条待补 `internal`（`_arm_explosion` 除外）；
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

