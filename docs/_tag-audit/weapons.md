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
