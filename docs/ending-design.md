# 终局设计（隐藏boss · 「东西」· 元进度存档）

> 状态：**已实现**（2026-09）。叙事文案见 `docs/stories/main-story.md`（「山腹」「隐藏boss」「击败」「"东西"面前」「陨落于山腹」+ 结局表），本文件写**游戏侧怎么接**。
> 关联：`docs/stories/main-story.md`（终局文案）、`docs/background/the-thing.md`（「东西」设定）、`docs/plot-todo.md`（待办）、`docs/gameplay-guide.md`（战斗规则）。

---

## 一、目标与范围

在决赛（n33）之后接两段**无奖励**内容：

| 称呼 | 内容 | 出现条件 |
| --- | --- | --- |
| **n33.5** | 山腹 → 与**隐藏boss**（上一轮得魁的玩家 build）一战 | 有过得魁记录（`MetaSave.clears >= 1`） |
| **n34** | 走到「东西」面前 → 许愿 / 转身离开 → 结局 | 同上 |

- 首次得魁之前：n33 打完直接按现在的「得魁」结算（老流程不变）。
- n33.5 与 n34 **每条故事线完全一样**，不做分线差异。
- 两者都不发奖励（沿用 `noReward` 的写法：选项里不放奖励轮）。
- 败给隐藏boss = 本局结束（拿不到许愿的机会），与「中途死亡」同类。

---

## 二、流程结构（用现有事件系统「插入」，不动节点编号）

现有机制（`src/game/entities/round.ts`、`src/game/roguelite/engine.ts`）：

- 事件 = 一串轮次；选项类型里有 `event`（**开始另一个事件**）与 `continue`（跳本事件内的轮次，`__end__` = 结束事件并推进节点）。
- 轮次带 `enemyId`/`enemyPool` 即战斗轮，进轮时立刻结算战斗（`_pushRound` → `_executeCombat`），结果写进 `round.result`，之后照常显示该轮选项。
- 选项支持 `when`，上下文里带**上一场战斗的胜负**（`result.won`）。
- 事件结束后 `_advanceToNextNode()`：`nodeIndex++`，`> 33` 即 `finished`。

因此终局用**插入事件**实现，**不改 `33` 这个上限、不动奖励槽预算、不动流程图编号**：

```
n33  tournament_final（现有事件）
 └ round 'match'（战斗轮：该线决赛对手）
     胜后选项：「推开最后一扇门」→ type: 'event' → ending_cavern
     （失败：processTournament 判淘汰 → finished，走不到这条选项）

ending_cavern（新事件，插入，无奖励；见 src/data/events/ending.ts）
 ├ r1 'walk'            场景轮：「最后一扇门」→ 石道 + 两侧历代会长的名字 → 继续
 ├ r2 'cliff'           场景轮：「东西」悬在半空 → 走近
 ├ r3 'guardian'        战斗轮（enemyFromSave）：隐藏boss（斗炁协会副会长）→「收招」
 ├ r4 'guardian_result' 分歧轮（bossOnly）：按上一场 result.won 过滤 —— 胜「去看」/ 败「闭眼」
 ├ r5 'beaten'          场景轮（bossOnly）：击败 →「别信它。」→「跨过去」
 ├ r6 'thing'           场景轮：「我可以实现你一个愿望…」→ 三条路
 │                        · 「回到过去」＝历代会长都许过的那个愿（副文案写「我想再见见那些
 │                          已经不在的人。」）→ r7a
 │                        · 「我要变强」＝迷惑选项：它不给你变强，只把遗憾念给你听 → r6b
 │                        · 「转身，离开。」＝真结局路线：只在有过得魁记录时给，而且要**连选三次**
 │                          （每选一次都被蛊惑一句：r6c → r6；r6d → r6；第三次才进 r7b）
 │                          （所以首次得魁只有前两条：「没有第三个选项」）
 ├ r6b 'taunt_power'    蛊惑轮：选「我要变强」后（唯一出口是回 r6 重选：「沉默」→ r6）
 ├ r6c 'taunt_leave_1'  蛊惑（一）：第一次转身时它再说一句 → 回 r6
 ├ r6d 'taunt_leave_2'  蛊惑（二）：第二次转身时它替你算账 → 回 r6
 ├ r7a 'loop'           结局轮：1989 年初 / 等一百年 → __end__（写 flag ending_loop）
 ├ r7b 'true'           结局轮：天亮 / 不回头 → __end__（写 flag ending_true）
 └ r8  'fallen'         结局轮（boss 战败）：「陨落于山腹」→ __end__（写 ending_fallen，仅供结算页分辨）
                        （结束时 nodeIndex 33 → 34 > 33 → finished，写元进度存档）
```

- **胜负分支为什么写在战斗轮的下一轮**：引擎在**推轮时**就按 `result.won` 过滤选项，而战斗轮的选项过滤发生在该场战斗结算**之前**。这与 n23 热身赛（`warmup_result`）同构，沿用同一套机制，不必给引擎加「战斗后重新过滤」的补丁。
- **首次得魁没有那具躯体**：`guardian` 带 `enemyFromSave`，存档里没有 `lastWinBuild` 时引擎整轮跳过；跳过的同时会把紧跟其后的 `bossOnly` 轮次（`guardian_result` / `beaten`）一起跳过，直接落到 `thing`，避免撞上「无人可打却只剩败北选项」的死路。
- `thing` 上的三条路都会回到 `thing`（`taunt_*` 轮的唯一出口），只有 `loop` / `true` 会 `__end__`。蛊惑轮可以转任意次，也可以一次都不转。
- **「转身，离开」要连选三次**：次数记在 `flags.leave_step`（选项自带 `setMany` 效果，0 → 1 → 2），三个同名选项用 `when` 互斥（第一次还要求 `flags.cleared_before`），第三个才指向 `true` 轮。所以「首次得魁没有第三条路」= 第一次的那条选项被 `cleared_before` 挡住。
- 「回到过去」与「我想再见见那些已经不在的人。」是**同一个选项**（label 是动作，description 是那个愿），不拆成两条。

---

## 三、隐藏boss 的构造（不走 `gen`）

**现状**：`_executeCombat`（`src/game/roguelite/engine.ts:474`）只认 `getOpponentDef(round.enemyId)`，再用 `gen(def, nodeIndex)` 按 `targetAttrs` + 修炼点重建属性。隐藏boss 是**上一轮得魁的玩家 build**，本来就不是 `OPPONENTS` 里的一员，也不能用 `gen` 重建。

**做法**：给轮次加一个**动态敌人入口**，引擎里走一条专用分支：

```ts
// Round 新增（二选一）
enemyBuild?: CharacterBuild      // 直接给一份完整 build
enemySource?: 'champion'         // 或只给标记，引擎自己去存档取
```

落地的是 `enemyFromSave?: boolean`（数据侧只写「敌人来自存档」）+ `enemyBuild?: CharacterBuild`（运行时由 `championBuildFromSave()` 注入），AI 侧 `_executeCombat` 里：有动态来源就 `new Character(round.enemyBuild)`，**不调用 `gen`**；`enemyId` 分支保持原样。UI 回放那侧（`RogueliteScreen.tsx`）加了一个同源分支读 `enemyBuild`。（`enemySource: 'champion'` 这个写法没有采用：build 由引擎注入更便于回放与测试。）

**踩过的坑（务必保留）**：boss build 的 `id` 必须与玩家 build 的 `id`（`'player'`）**不同** —— `runBattle` 用角色 id 报胜者，引擎再用 `winner === enemy.id` 判负，同 id 会让 boss 战**恒判为败**。现用 `CHAMPION_BOSS_ID = 'champion_boss'`（`src/game/champion-boss.ts`）。

**boss build 的构造口径（本次定稿）**：

| 项 | 口径 |
| --- | --- |
| 奖励 | **玩家 13 个奖励完全保留**，武器/副手照旧 |
| 义体 | 换入 **13 件**：15 件义体里排除 **悬浮座椅、战斗芯片·改** |
| 属性 | **六项一律 7 点起**（`CHAMPION_BASE_ATTR`），奖励与义体的加成**全部叠上去**，不做任何抵扣（玩家存档里的 `baseAttrs` 不再参与） |
| 专属义体 | 新增 1 件**只给隐藏boss 的义体：根骨 +5** —— **「钛合金脊椎」**（`titanium_spine`，`implant` + `inherent`）；与其余义体一样叠加 |
| 代价 | **照常生效**：`overload`（失重）/ `ap_drain`（失能）/ `fumble_chance`（永久失心）/ `muscle_degradation`（失感）/ `permanent_burn`（过热）在战斗里正常结算，**设计换算里不再另行折算** |

**属性账（供调平衡用；属性旋钮只有 `CHAMPION_BASE_ATTR = 7`）**

| 义体 | 属性加成 | 是否上阵 |
| --- | --- | --- |
| 钛合金臂 | 力道+2 灵巧+2 | 是（可飞臂自爆） |
| 液压腿 | — | 是（所有招式附短距冲刺） |
| 机械眼球 | 洞察+4 | 是（洞察降低减半） |
| 肌肉强化针 | 力道+5 身法+5 | 是 |
| 纳米金属心脏 | 力道+2 身法+2 灵巧+1 | 是 |
| 合成肺叶 | 根骨+2 力道+1 身法+1 | 是 |
| 人造神经网络 | 身法+1 灵巧+4 洞察+1 | 是 |
| 战斗芯片 | 推演+5 | 是 |
| 便携式核动力炉 | — | 是（最大AP+1、内息澎湃 2.8 层） |
| 毒腺 | — | 是 |
| 髓泵 | — | 是（最大气血+60） |
| 人造耳蜗 | 洞察+4 推演+1 | 是 |
| 人造发声器 | — | 是（音波：无视招架 + 失心） |
| 悬浮座椅 | — | **否** |
| 战斗芯片·改 | 推演+4 | **否** |

- 义体加成合计（13 件换入 + 专属）：**力道+10 根骨+7 身法+9 灵巧+7 洞察+9 推演+6 = 48 点**（平均每项 8 点）
- 属性：**六项一律 7 点起**，加义体后为 力道 17 / 根骨 14 / 身法 16 / 灵巧 14 / 洞察 16 / 推演 13，再叠上那份得魁奖励自带的属性
- 口径理由：只有一个旋钮（那 7 点），boss 的身板不再随存档里 `baseAttrs` 漂移；义体的特效与代价照常结算（见下）。数值后续按 tour 调。

定名：**钛合金脊椎**（与「钛合金臂」同族风格，材质+部位）。只出现在隐藏boss 身上，玩家不可获得（`implant` + `inherent`，无任何事件/对手授予）。

描述按 `writing-style.md` 写（白描、短句、不解释），例如：`最早换上的那批义体之一。锈蚀发黑，撑着一具不该再动百年的身体。`

**引擎改动清单（都很小，已落地）**

1. `Round` 加动态敌人入口（`enemyFromSave` / `enemyBuild` / `bossOnly`）；`_executeCombat` 加分支（不调 `gen`）；UI 回放分支同源。
2. `championBossBuild(build)`：纯函数 —— 克隆存档 build → 六项 `baseAttrs` 一律置为 `CHAMPION_BASE_ATTR`（7）→ 换入 13 件义体 + 专属义体（玩家已有的不重复挂，属性照常叠加）→ 过一遍非法组合清理（主手不是单手兵器时清掉副手）。`src/game/champion-boss.ts`。
3. 义体代价**照常结算**（失重/失能/永久失心/失感/过热都生效），不做「忽略代价」的引擎改动。

---

## 四、存档系统（新增）

现在只有 UI 配置与 DevMode 的 BuildSim 用 `localStorage`（`app-store.ts`、`BuildSim.tsx`），**没有任何跨局存档**。本方案新增一个「游戏结果保存系统」：

```ts
/** localStorage key: dantiao:meta:v1 */
interface MetaSave {
    schemaVersion: 1
    runs: number                  // 总轮数（每次开局 +1）
    clears: number                // 得魁数（打过 n33 决赛；玩家可见名见下）
    loopClears: number            // 循环结局（许愿回去）次数
    trueEndingDone: boolean       // 真结局是否达成
    bossWins: number              // 击败隐藏boss 次数
    bossLosses: number            // 败给隐藏boss 次数
    bestClear?: { injuries: number; rewards: number; at: number }   // 最漂亮的一次得魁
    lastWinAt?: number            // 最近一次得魁时间
    lastWinEnding?: 'loop' | 'true'
    lastWinBuild?: CharacterBuild // 最近一次得魁的完整 build（武器/副手/13 奖励/属性/actionConfigs）
}
```

- **写入时机**（实现口径）：`runs` 在开局 +1（`roguelite-store` 的 `confirmWorldIntro`）；`bossWins` / `bossLosses` 在 r3 战斗结算后写；`clears` / `lastWinEnding` / `lastWinBuild` / `bestClear` 在**结局轮被选中**时写（`_advanceToNextNode` 判 `finished` 时读 flag 落档）。因此**败给隐藏boss 不记得魁**，最近得魁的 build 仍是上一局那一份。
- 读档容错：解析失败或 `schemaVersion` 不符时按空档处理（照 `BuildSim.loadPersisted` 的写法）。
- DevMode 的「元进度」页（`src/ui/screens/DevMode/MetaPanel/`）提供**查看 / 清档 / 导出 JSON**；导出的 JSON 可直接存成 `scripts/champion-build.json`。
- 隐藏boss 胜率用 CLI 测：`npm run tour -- champion_boss --champion=scripts/champion-build.json`（不带 `--champion=` 时用内置基准 build，偏保守；`scripts/tournament.ts` 会把隐藏boss 作为第 33 名参赛者）。
- `CharacterBuild` 本身标注了「可序列化」，BuildSim 已经直接 `JSON.stringify` 存过，因此 `lastWinBuild` 直接存即可。

---

## 五、结局与写档

| 结局 | 触发 | 写档 | 后续 |
| --- | --- | --- | --- |
| 循环结局「**得魁**」 | r6 `thing` 选「回到过去」（首次得魁时它也在这两条里） | `clears+1`、`loopClears+1`、`lastWinEnding='loop'`、`lastWinBuild=本局 build` | 该 build 成为下一局 n33.5 的隐藏boss |
| 真结局「**带着遗憾向前**」 | r6 `thing` **连选三次**「转身，离开」（仅有得魁记录后出现） | `clears+1`、`trueEndingDone=true`、`lastWinEnding='true'`、`lastWinBuild=本局 build` | 同样更新最近得魁的 build（口径：**用最新一次得魁**）；随后单独放一页**终章**（见下） |
| 陨落于山腹 | r4 `guardian_result` 败给隐藏boss | 只记 `bossLosses+1`（`runs` 已在开局记过）；**不记得魁** | 本局结束，没有许愿的机会——文案见 `main-story.md`「### 陨落于山腹」 |

- 「首次得魁没有第三条路」的落地：开局时把 `clears > 0` 写进本局 flags（`flags.cleared_before`），「转身，离开。」那条选项带 `when`。
- **终章页**（真结局专属）：run 结束后先盖一页章页样式的正文（`IntroOverlay` + `TRUE_ENDING_EPILOGUE`，正文在 `src/data/story-intros.ts`，讲主角接任会长后从炁印里知道的来龙去脉），点「结束」才进结算页；是否已读记在 store 的 `endingSeen`（`reset()` 清掉，本局只盖一次）。
- 结算页标题按结局分：
  **得魁**（循环结局）/ **带着遗憾向前**（真结局）/ **陨落于山腹**（`flags.ending_fallen`，仅供 UI 分辨）/ **胜败乃兵家常事**（淘汰、伤势满 100）。显示名统一放在 `src/data/story-intros.ts`（`ENDING_NAMES` / `ENDING_NAME_FALLEN` / `ENDING_NAME_DEFAULT`；旧文里的「通关」就是现在的「得魁」、「本局结束」就是现在的「胜败乃兵家常事」）。

- 结局选项用现有 `effects` 写 flags（`ending_loop` / `ending_true`），引擎在 `_advanceToNextNode` 判 `finished` 时读 flag 落存档 —— 不需要给 Effect DSL 加新的效果类型。
- 真结局达成后是否还能继续开新局、n33.5 是否照常出现：**是**（元进度只记录，不封锁内容）。

---

## 六、已定与待办

**已定（2026-09）**

1. 属性：**六项一律 7 点起**（`CHAMPION_BASE_ATTR`），奖励与义体全部叠加，不做抵扣。
2. 义体代价：**照常结算**（失重/失能/永久失心/失感/过热都生效），设计换算里不另行折算。
3. 专属义体：**「钛合金脊椎」**（`titanium_spine`，`implant`+`inherent`，根骨+5），只给隐藏boss。
4. 隐藏boss 取**最近一次得魁**的 build（与最近一次是哪种结局无关）。
5. 首次得魁时不给「转身离开」（只有「回到过去」与迷惑选项「我要变强」两条）；文案后续打磨。
6. 元进度只记录、不封锁内容：真结局达成后仍可继续开局，n33.5 照常出现。
7. **难度目标**：隐藏boss 打全部 32 位选手，tour 胜率 **55% – 60%**（需要把 boss 作为第 33 个角色接进 `scripts/tournament.ts` 才能测）。
8. 隐藏boss 的义体按常规装上即可（代价照常触发），**不需要任何「忽略代价」的引擎改动**。
9. 义体属性**不抵扣**：13 件换入 + 专属共 48 点（平均每项 8 点）直接叠在那 7 点上。

**待办**

1. 具体数值平衡：按 55%–60% 的目标调（扣点、义体集合、专属义体数值）。测量入口已就位（见第四节末）。
2. 败给隐藏boss 的结算页文案：已按设计落成（`fallen` 轮 + `main-story.md`「### 陨落于山腹」），后续打磨。
3. **碎片 / 旧痕迹系统**：本轮不做，后续单独设计。现有可用的伏笔入口：玄门先祖被蛊惑（`the-thing.md` 玄门关联）、杨之改/龙语仙守断崖、禅子镇守（多林寺问禅事件）、青山镇炼炁十倍、青山镇为何有大量驻军（军旅线）、组织的手法为何如此前沿。
## 七、需要同步的旧文档

- `docs/stories/main-story.md`：流程图与要素表里的旧设定（流派背景「剑修/锻体/御物/诡术」、随机「重要之人」、碎片系统、义体的记忆代价）与现实现不符，本轮已就地标注/更正；n33.5 / n34 的接入点已注记。
- `docs/plot-todo.md`：第三节的两条终局待办改为「已实现，见本文件」；删除「血海线 n33 = 军师 + 隐藏boss」的分线写法（隐藏boss 每条线相同）。
- `docs/background/the-thing.md`：「历届会长许愿后成为下一轮隐藏boss」这条补上游戏实现指向。
- `docs/TODO.md`：新增/更新终局与存档系统的条目。

## 八、实现落点（代码索引）

| 文件 | 内容 |
| --- | --- |
| `src/data/events/ending.ts` | `ending_cavern` 事件（9 轮：场景 / 战斗 / 分歧 / 击败 / 许愿 / 两个结局 / 陨落） |
| `src/data/events/tournament.ts` | n33 决赛胜后选项 `type: 'event'` → `ending_cavern` |
| `src/game/roguelite/engine.ts` | `enemyFromSave` 注入 / 缺席跳过、`bossOnly` 连带跳过、boss 战绩与得魁落档 |
| `src/game/entities/round.ts` | `enemyFromSave` / `enemyBuild` / `bossOnly` |
| `src/game/champion-boss.ts` | 隐藏boss build 构造（`CHAMPION_BOSS_ID` / `championImplantIds` / `championBossBuild`） |
| `src/game/meta-save.ts` | `MetaSave` 读写（`localStorage` key `dantiao:meta:v1`） |
| `src/data/story-intros.ts` | 结局显示名 `ENDING_NAMES`、真结局终章页文案 `TRUE_ENDING_EPILOGUE`（章页样式，`IntroOverlay` 渲染） |
| `src/ui/stores/roguelite-store.ts` | `endingSeen` / `confirmEnding`（本局终章页只盖一次） |
| `src/data/artifacts.ts` | 专属义体 `titanium_spine`「钛合金脊椎」 |
| `src/ui/screens/DevMode/MetaPanel/` | 元进度查看 / 清档 / 导出 |
| `scripts/tournament.ts` | `--champion[=文件]`：把隐藏boss 作为第 33 名参赛者测胜率 |
| 测试 | `src/game/__tests__/{meta-save,champion-boss,ending-flow}.test.ts`、`src/ui/__tests__/ending-epilogue.test.ts` |
