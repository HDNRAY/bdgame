# 《单挑》

> 《单挑》。公元 2088 年，青山镇的斗炁大会。

单人 roguelite 自动战斗游戏。赛博朋克都市与古风修炼混搭的世界里，玩家沿一条 33 个节点的流程做选择、拿奖励、养自己的 build；每一场对决由战斗引擎自动推演，玩家负责构筑与配置。设定上，青山镇会长之位空缺时，以单挑战逐出下任会长。

## 技术栈

- TypeScript（strict）+ Vite 8 + React 19 + Zustand 5
- react-router-dom 7，按路由懒加载
- PixiJS 8 画布战斗渲染（`src/ui/canvas/`），像素精灵叠加武器图
- Sass 样式（`src/index.css` / `src/App.scss` / `src/ui/styles/`）
- Vitest 4 单元测试，tsx 跑 CLI 脚本，vite-plugin-pwa 打包 PWA

## 目录结构

```
src/
  engine/        战斗引擎（不依赖 UI）
    ai/            AI 决策（主招/支援规划、期望伤害）
    calc/          纯函数（伤害/属性/内息价值）
    combat/        战斗状态机、效果处理、日志、统计、tick
    entities/      核心实体（角色/招式/功法/奇物/属性/标签/触发）
    util/          随机数等工具
    battle-runner.ts  runBattle 入口
  game/          游戏流程层
    roguelite/     肉鸽主流程（节点推进、地图、奖励池与生成）
    tournament/    斗炁大会赛制（小组赛/淘汰赛模拟）
    meta-save.ts   元进度存档（localStorage）
  data/          静态数据（武器/招式/功法/奇物/事件/对手）
  bridge/        引擎与 UI 之间的桥（战斗回放引擎、显示文案映射）
  ui/            界面层
    screens/       各页面（ModeSelect / BuildScreen / BattleScreen / RogueliteScreen / DevMode 等）
    components/    面板与通用组件
    canvas/        PixiJS 战斗渲染
    pixel-sprites/ 像素精灵与武器叠加图
    stores/        Zustand store
scripts/         开发工具脚本（见下）
docs/            设计文档（见下）
```

## 环境要求与安装

需要 Node `^20.19.0` 或 `>=22.12.0`（Vite 8 的要求；CI 用 20.x）。

仓库里不含 `.env`（被 gitignore，需要自建）。本地开发建议在根目录建一个：

```
VITE_APP_TITLE=2088 青山镇 斗炁大会
VITE_ENABLE_DEV_MODE=true
```

不建也能跑，只是页面标题会显示未替换的 `%VITE_APP_TITLE%`，且 `/dev`（DevMode）路由不开放 —— 它的开关是 `VITE_ENABLE_DEV_MODE === 'true'`（见 `src/App.tsx`）。

```bash
npm install
npm run dev
```

## 常用命令

| 命令                | 说明                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `npm run dev`       | 启动 Vite 开发服务器                                                                       |
| `npm run build`     | `tsc -b && vite build`，产物输出到 `bdgame/`（线上走 GitHub Pages 子路径 `/bdgame/`）      |
| `npm run preview`   | 本地预览构建产物                                                                           |
| `npm test`          | 运行全部单元测试（`vitest run`，跑一次就退出）                                             |
| `npm run test:watch`| 监听模式跑测试                                                                             |
| `npm run lint`      | `eslint .` 检查仓库                                                                        |

改完代码后的检查（细节与理由见 `AGENTS.md`；`tsc` 必须带 `-p tsconfig.app.json`，否则根 solution 配置一个文件都不查，是假绿）：

```bash
npx tsc --noEmit -p tsconfig.app.json  # 严格类型检查（覆盖 src，含 __tests__）
npx eslint src/ --quiet                # eslint 零错误
npx vitest run                         # 全部测试通过
grep -rn ' as any' src/engine/         # 应为空
```

推送 `master` 后由 `.github/workflows/deploy.yml` 构建并部署到 GitHub Pages。

## 工具脚本

`package.json` 里已注册的脚本：

- `npm run demo [n]` — 两个满配（33 节点）角色对战模拟。`n=1` 打印完整战斗日志，`n>1` 聚合胜率与伤害统计；日志同时写入 `scripts/battle-log.txt`。
- `npm run node` — 肉鸽流程 `RogueliteRun` 的交互式 CLI，每轮按提示输入数字做选择。
- `npm run tour -- [对手ID] [每对局数]` — 对手胜率巡回赛。省略对手 ID 就跑全部两两配对，每对默认 100 局；日志写入 `scripts/tournament-log.txt`。
- `npm run tour -- champion_boss --champion=<build.json>` — 隐藏 boss 胜率测试。`--champion` 不带文件时用内置基准 build；文件可以是裸 `CharacterBuild`，也可以是元进度存档（含 `lastWinBuild`）。
- `npm run tour-cli [--knockout] [--players=N]` — 斗炁大会赛制的交互式 CLI（小组赛 + 淘汰赛）。
- `npm run reward -- <对手ID> [--n N] [--level 33] ...` — 奖励影响分析：逐一摘掉某个对手的每个奖励，看胜率下降多少，找出影响最大的那件。参数见 `scripts/reward-impact.ts` 文件头。
- `npm run rt` — 统计每个对手的奖励类型（武器/招式/功法/奇物）数量，结果写入 `scripts/reward-types.txt`。
- `npm run pixel -- <武器ID[,ID...]> [姿势|all] [缩放]` — 像素武器预览，把「精灵 + 武器 + 手部遮罩」合成 PNG，输出到 `scripts/preview/`（该目录已 gitignore）。例如 `npm run pixel -- qimei_staff parry 2`。

没有注册进 `package.json` 的脚本用 `npx tsx` 直接跑，例如：

```bash
npx tsx scripts/gen-flow-map.ts   # 重新生成 docs/stories/flow-map.md
```

## 玩法要点

- 33 个节点的肉鸽流程，逐节点做选择、拿奖励（武器/招式/功法/奇物）。
- 六属性：力道、根骨、身法、灵巧、洞察、推演。
- 两种资源：内息是出招燃料，缠劲是终结技燃料（缠劲到 30 会得到「周」）。
- 距离以米计，每个招式有射程区间，够得着才打得到。
- 战斗自动结算，胜负由 build、出招条件与触发器配置决定。

完整规则见 `docs/gameplay-guide.md`。

## 文档索引

| 文档                              | 内容                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| `AGENTS.md`                       | 项目记忆与开发约定，改任何代码前先读                                                     |
| `CLAUDE.md`                       | RTK 命令压缩工具的使用说明                                                               |
| `docs/writing-style.md`           | 叙事写作规范（白描、短句、「」对话等），写任何文案前必读                                 |
| `docs/gameplay-guide.md`          | 面向玩家的对战规则手册；首页「玩法」弹窗是它的精简版，两处需同步                         |
| `docs/ending-design.md`           | 终局（n33.5 隐藏 boss、n34 许愿/转身离开）与元进度存档设计                               |
| `docs/design-principles.md`       | 奖励与属性加成的设计原则                                                                 |
| `docs/battle-stats-design.md`     | 战斗统计设计                                                                             |
| `docs/weapon-visual-references.md`| 像素武器美术参照                                                                         |
| `docs/background/`                | 世界观与角色：`town-settings.md`、`character-relations.md`、`character-graph.md`、`the-thing.md`、`hidden-boss-timeline.md` |
| `docs/stories/`                   | 故事线：`main-story.md`、`branch-stories.md`、`character-stories.md`、`flow-map.md`、`view-stories/` |
| `docs/superpowers/specs/`         | 设计规格                                                                                 |

## 约定（摘要）

- 注释、文档、提交信息一律用中文。
- 禁止 emoji，所有文本（含 UI 文案与设计文档）都不出现表情符号。
- 引擎代码：零 `as any`、零未使用变量/导入、不用动态 `import()`（UI 路由懒加载是唯一例外）。
- 写叙事文本前先读 `docs/writing-style.md`；改战斗机制前先对照 `docs/gameplay-guide.md`。
