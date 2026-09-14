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
