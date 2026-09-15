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

> 执行进展：P0 见 §十一、P1 见 §十三、P2 见 §十四、P3 文案见 §十五（下表处数为审计当时估算，实际以执行记录为准）。

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

## 十四、P2 执行结果（2026-09）

依据 = 各分类明细的逐条结论 + 裁定 A / 第三轮 `buff` 口径。**共改 132 条实体的 tags**（9 个数据文件：`internal` 13、`melee` 10、`player` 12、`qi` 3、`support` 8、`unarmed` 12、`artifacts` 31、`passives` 30、`weapons` 13）。

### 1. `passive` 标签已下架（2026-09）

审计说「功法上半 42/55 缺 `passive`」，**实测只有 15 条**缺。该标签全库**零消费方**（`includes('passive')` 无命中），且在 `tagRelevance` 里对**同一奖励池内**的候选是等比加成（池内相对分布不变）→ 实际零效果；功法本来就在 `PASSIVES` 表里，再标一次是重复信息。

按用户裁定**整体下架**：

| 位置 | 改动 |
| --- | --- |
| `src/data/passives/passives.ts` | 110 条功法的 `tags` 全部去掉 `passive`（其中 15 条先补后撤、95 条为历史标注） |
| `src/engine/entities/tag.ts` | 删除 `\| 'passive' // 功法` 成员 |
| `src/bridge/tagDisplay.ts` | 删除 `TAG_CN`/`TAG_COLOR` 的 `passive` 条目 |
| `AGENTS.md` | Tag 总数 54 → **53** |

与 `dot` 同一处理方式（零数据使用/零消费方的死标签下架）。

### 2. 奇物去 `trigger`（13 件）

`blood_thorn_ring`、`blood_thorn_earring`、`wisdom_talisman`、`tiger_eye`、`qi_guard`、`iron_will`、`qi_amplifier`、`poison_coating`、`shixiang_ruanjin_san`、`western_poison`、`cinnabar_mole`、`herb_pouch`、`tactical_pouch`。
`trigger` 的代码消费方读的是**招式**的 tags（`handlers.ts:590`：触发招式的 `short_dash` 一律冲向贴脸），奇物侧纯展示。

### 3. 功能与元素 tag（88 条）

| 类别 | 处数 | 判定依据 |
| --- | --- | --- |
| `debuff` | 30 | `effects` 带 `add_debuff` 即标（口径：弱化不论敌我） |
| `paralyze` 11 / `stun` 4 / `knockdown` 5 / `burn` 6 / `frost` 4 / `bleed` 2 / `poison` 1 / `knockback` 1 | 34 | 施加了该元素/控制状态（含经 buff 施加者，如 `frost_silk_robe` 招架后叠霜冻） |
| `ignore_parry` | 9 | **只有效果里真有 `ignore_parry` 才标**（裁定 E：穿透不算） |
| `cleanse` | 9 | 净化类效果（含每跳解毒的 buff） |
| `defense` | 13 | 减伤/免疫/招架闪避类收益 |
| `counter` | 4 | 反伤/受击反制 |
| `heal` | 3 | `tai_shang_yu_fa`、`nv_er_hong`、`bu_lao_quan` |
| `stance` | 3 | `zantetsu`、`tiger_eye`、`calming_talisman` |
| `self_damage` | 2 | 卖血：`blood_droplet`、`blood_qi_protection` |
| 去 `electric` 2 / 去 `heal` 1 | 3 | `qi_electric_conversion`、`flash` 无雷系机制；`_field_dressing` 是净化不是回血 |

实体侧的 `debuff`/`stance`/元素/`cleanse`/`counter`/`ignore_parry` 只进 `tagRelevance` 权重：代码里的消费方读的是 **BuffDef 自身的 tags**（`buffs.ts:629`、`buff-layer.ts:194`）或**效果本身**（`handlers.ts:497` 架势替换、`engine.ts:827` 命中形态广播）。全库 `includes('chan')`、`includes('counter')`、`includes('ignore_parry')`、`includes('stun')` 等均为零命中。

### 4. `buff` 按「是否施加了状态」重筛（39 条）

口径（第三轮收窄，取代裁定 A 的宽口径）：**只有本条真的施加了「状态」才算 `buff`** —— 叠层、有持续、有条件/触发，或免疫、吸收、回复、资源回复、行动代价这类非纯数值行为；**平坦的永久属性/命中/暴击/暴伤/招架/闪避数值加成不算**（`惊鸿` 的 `stat_buff`、`千机` 的 `qianji_crit`、`绝剑诀` 的 `last_stand` 都不算）。

- **补 30**：武器 10（`po_lang_zhu_zhi`、`broken_blade`、`special_forces_dagger`、`iron_spear`、`xiu_dong`、`chun_lei`、`overlord_blade`、`buer_sword`、`ganjiang_sword`、`moxie_sword`）、功法 7、招式 4（`wan_liu_gui_zong`、`yun_bu`、`summon_haste`、`condense_shield`）、内部招 3（`_qiti_awaken`、`_cangfeng_mind_eye`、`_iaijutsu_ready`）、奇物 4（`venom_gland`、`floating_eye`、`wheelchair_lightness`、`power_furnace`）、`spring_bamboo_sword`、`cloud_hidden_sword`；
- **去 9**（引用的 buff 自身零收益）：`nei_xi_mian_chang`（只放大时长）、`yue_nv_sword`（buff 触发器已被注释）、`shenxing_baibian`（纯移动消耗）、`feng_wu_jiu_tian` 与 `ling_ao_bu`（只授招、本体不施状态）、`tai_shang_yu_fa`（纯回血）、`yi_ma_xin_yuan`/`tongtian`/`chou_dao_duan_shui`（只给对手上负面）；
- **不补/保留**：14 条只用 `stat_buff` 或平坦数值（`yanling_blade`/`qianji`/`ninja_sword`/`bare_hands`/`dagger`/`heshan_sword`/`fusi_sword`/`dark_room_catch`/`ningqi_jue`/`agility_steal`/`_alaya_insight`/`synthetic_lung`/`cochlear_implant`/`zhu_ye_qing`/`shao_dao_zi`）；施加**自身负面**的（`ap_drain`/`fumble_chance`/`muscle_degradation`/`permanent_burn`）；裁定 A 下保留的 `extreme`、`yuxin_sword_mastery`、`wan_xiang_jian_yi`；`one_arm` 留 `debuff`、不补 `buff`。

### 5. 追加口径（第四轮澄清）

| 主题 | 裁定 | 落地 |
| --- | --- | --- |
| `heal` 的范围 | **只算回血**，不含回 AP/内息 | `cang_niao_jian_fa`（AP 回复 +0.4/s）**不补** `heal`——补了会把它的 AI 辅招优先级由 50 抬到 100 |
| `low_hp` 的定义 | **血量越低越强 或 自伤 都算**（与 `tag.ts:56` 双义一致） | 补 `blood_qi_protection`（释放 15% 当前气血 = 自伤）；`blood_droplet` 保留；`tactical_pouch` 的 `hp_below 0.5` 只是阈值触发、**不补** |
| `craft` 的范围 | **宽义：人造物即 `craft`** | 药心石/聚缠法衣/忍者工具包/自动净化背心 的 `craft` 保留——它有真实消费方（`buffs.ts:1559` 千星「炁电转换」按 `craft`/`implant` 装备数给属性） |
| `qi` 的补类 | 维持第三轮「只去不补」 | 核动力炉/蓄炁瓶/归元劲/秋水论/炁电转换 一律不补 |
| `super_armor` / `jiu` | 代码读的是 **BuffDef** 自身的 tags（`buff-apply.ts:185`、`drunk.ts:8`） | 实体侧维持现状 |
| `range_up` / `poison_coating` | 全库零消费方 | 维持现状 |

### 6. 未做（留待 P3）

- `craft` 之外的类型类口径、`super_armor` 是否落到实体（如需）；
- P3 文案同步：`thunder_storm` 麻痹 vs stun、`hearing_power` 徒手 vs 任意命中、`chanzi_stance` 10% vs 15%、`soft_armor` 反伤、`zhu_huo_jue` 灼烧减半、`blood_droplet` 越残越弱、`shixiang_ruanjin_san` 等一批「描述与实现不符」。

### 7. 校验

`tsc` 无错、`eslint` 无错、**423 测试全过**、`vite build` 通过。

| 轮次 | 胜率区间 | 备注 |
| --- | --- | --- |
| P1 后 | 46.3% – 54.0% | 同码两次 |
| P2 后 | 45.7% – 53.5% | N=100 |
| P2 后低端复测 | 李雪影 47.1%、空拳·来风 47.1%、刘西瓜 47.5% | N=300，45.7/45.8 属抽样波动 |

32 人全部落在 45–55。P2 中真正会改战斗的只有两类：

1. `heal`/`buff` 落在**招式**上 → AI 辅招优先级变化（`blood_qi_protection` 50→100、`wan_liu_gui_zong`/`condense_shield` 30→50、`summon_haste` 10→50；`spring_bamboo_sword` 本就是 100；`yun_bu` 是位移招、不走辅招通道）；
2. `flash` 去掉 `electric` → 电系加成类 buff 不再对它生效。
实测影响在 ±1 点内。

## 十五、P3 文案同步（2026-09）

把「描述与实现不符」的一批按**实现**改文（不动机制），并补一处错标 tag：

| 位置 | 原文 | 改为 | 依据 |
| --- | --- | --- | --- |
| 寸芒（`cun_mang`） | 顺势反击 | 锋锐入骨 | 效果只有 `damage`，无 counter |
| 雷蛇（`thunder_storm`） | 麻痹对手 | 眩晕对手 | `add_debuff: stun` |
| 棍挑（`rod_lift`） | 破敌防势，降低对手闪避 | 力透棍梢 | 无任何降闪避 debuff |
| 三头六臂（`santou_liubi`） | 消耗30层缠劲…后续3个回合 | 消耗27层缠劲…后续2个回合 | `chanCost:27`、buff `stacks:2` |
| 金刚不坏（`chanzi_stance`） | 反伤10% | 反伤15% | `defense.ts:676` |
| 灵炁灌注（`ling_qi_guan_zhu`） | 增加命中和暴击 | 增加伤害与命中 | `sword_enhance_buff`：伤害+10%/命中+5% |
| 听劲（`hearing_power`） | 每次徒手击中 | 每次命中 | trigger 是无过滤 `on_hit` |
| 如来神掌（`ru_lai_shen_zhang`） | 距离极远 | （删去该分句） | `getRange [0,2]`，远距全靠 `short_dash 5` |
| 无影脚（`shadow_kick`） | 先近身再出腿 | 出腿无声 | 无 `dash`/`short_dash` |
| 碧海潮生曲（`bi_hai_chao_sheng_qu`） | 无视招架闪避 | 无视招架 | `ignore_parry` 只无视招架（`damage.ts:317`） |
| 裂地击（`fissure`） | tags 错标 `unarmed` | 去 `unarmed`、补 `blunt`/`polearm` | 棍系招（`requiredTags:['polearm']`），`unarmed` 会污染空手流派权重 |

已核对**无问题、无需改**：`yi_hui` 的 `hookNotes`（+20% 暴击 / +20% 暴伤 / 气血低于 50% 必中，与代码一致）；`special_forces_dagger`（其 buff 确实有 40% 概率麻痹，描述准确）。

### 已裁定（用户）

- **天外飞仙（`tian_wai_fei_xian`）**：不该有 `range`（本质是 `short_dash 5` 冲近砍）→ 已去 `range`、保留 `thrown`；
- **无假剑法 / 流萤剑法的「柔劲 / 刚劲」**：**不是问题**，无需改（不改文案、不换 buff）；
- **剑意淬体（`sword_intent_tempering`）**：**它不是血脉特性** → 不补 `inherent`，继续进随机池；
- **`thrown` 的权重档**：全库没有投掷武器是正常的 → 保持 `weaponType` 权重 4 不动。

### 剩余可选项（低影响）

审计里标「可补 / 可选」而本次未做的条目，逐条建议见 §十六.3。

### 校验

`tsc` 无错、`eslint` 无错、**423 测试全过**、`vite build` 通过。

`npm run tour`（含天外飞仙去 `range` 后）：32 人 **46.1% – 53.3%**，全部落在 45–55；低端复测（N=300）宁浩然 47.3%，46.1 属抽样波动。

## 十六、死事件下架与收尾（2026-09）

### 1. 4 个无消费方的触发事件已删除

`on_melee` / `on_range` / `on_unarmed` / `on_polearm` 全项目只有发射方与声明（校订记录 5 已核实无消费方），按追加裁定「确认无消费方，考虑删除」下架：

| 位置 | 改动 |
| --- | --- |
| `src/engine/combat/engine.ts` | 删除 4 行 `emit` + 1 行注释（"按攻击方招式 tag 命中触发"） |
| `src/engine/entities/trigger.ts` | 删除 4 个 `TriggerEvent` 成员 |
| `src/bridge/triggerDisplay.ts` | 删除 `TRIGGER_CN` 4 行 + `TRIGGER_DESCS` 4 行 |

删除后 `melee` / `polearm` / `range` / `unarmed` 的消费点只剩两个：`tagRelevance` 权重档与招式 `requiredTags`（`engine.ts:487`）。零行为影响，tour 32 人 **46.9% – 53.4%**。

### 2. 收尾裁定

见 §十五「已裁定（用户）」。

### 3. 可选项裁定与落地（2026-09）

**已补 16 处**（实体侧这些标签只影响抽卡权重）：

| 实体 | 补 | 依据 |
| --- | --- | --- |
| 轮舞月斩（`overlord_art`） | `polearm` `heavy` | 描述"长兵轮转"（用户裁定连 `heavy` 一起补） |
| 舞花棍（`hua_gun`） | `polearm` | 棍属长柄 |
| 太极（`tai_chi_mastery`） | `parry` | 描述"空手可招架" |
| 灵犀一指（`lingxi_finger`） | `unarmed` `parry` | "空手入白刃，招架时缴械" |
| 听潮式（`guard`） | `parry` | `requiredTags:['parry']` + 招架 buff |
| 人体雷达（`human_radar`） | `stance` | 完全由 `on_stance` 驱动（用户裁定补） |
| 转换时刻（`stance_time`） | `super_armor` | 其 buff `stance_armor` 自带 `super_armor` |
| 金钟罩（`jin_zhong_zhao`） | `super_armor` | 其 buff `jin_zhong_zhao` 自带 `super_armor` |
| 凝炁成盾（`condense_shield`） | `qi` | 「炁盾」属炁的外放 |
| 炁体源流·觉醒（`_qiti_awaken`） | `defense` | 施加 `qi_shield` 吸收伤害 |
| 自爆（`_arm_explosion`） | `range` | `getRange [0,5]`，非近身 |
| 扫描分析（`scan_analysis`） | `imperial` | 御物支援招，与同族一致 |
| 机械眼球（`mechanical_eye`） | `defense` | 洞察降低减半＝抗减益 |
| 武学宝典总纲（`wuxue_baodian_zonggang`） | `defense` | 暴击→叠闪避 |
| 发辫刃（`braid_blade`） | `slash` `pierce` | 辫中藏刃 |
| 暴雨梨花钉（`tempest`，奇物） | `pierce` `range` `chan` | 与它授予的招式同形（用户裁定补） |

**`super_armor` 不参与流派权重**：`src/game/tagRelevance.ts` 的 `NO_BUILD_TAGS` 加入 `super_armor` —— 它不是流派方向，与 `move`/`pre_action`/`post_action`/`chan`/`heal` 同类，权重归 0。

**未补（维持现状）**：

- `jet_drive`：其 buff `rocket_boost` 的 tags 是 `['defense']`，**没有** `super_armor`（免疫击倒是用 `onReceiveDebuff` 钩子实现的）→ 按用户条件不补；
- 弗思剑 / 莫邪 的 `defense`（用户裁定不补）；
- 以炁驱动的 8 把武器、核动力炉 / 蓄炁瓶 / 悬浮座椅 的 `qi`（"以炁驱动/储存/恢复"不算外放）；
- 一刀流 / 龙宫院流 / 定心香氛 / 青竹斗笠 的 `trigger`（与"奇物不标 trigger"同口径）；
- 神行百变 `move`（`move` 只给凤舞九天）；

**校验**：`tsc` / `eslint` / 423 测试 / `vite build` 全过；tour 32 人 **45.9% – 53.7%**，低端李雪影复测（N=300）为 47.1%，全部落在 45–55。这 16 处里只有 `_arm_explosion` 的 `range` 会改战斗（对手的"防远程"类 buff 现在会对自爆生效，符合它 5 米投掷的形态）。、剑意淬体 `inherent`（非血脉）与 `slash`/`pierce`（它是减免斩刺）、生死符 `pierce`/`ignore_parry`（穿透≠无视招架）、冰蚕衣 `inherent`（P0 已裁定进池）、钛合金臂 `self_damage`（自伤在其授予的招式上）、锁链断刀 `retrieve_weapon`/`range_up`（前者只被招式侧读取、后者零消费方）。
