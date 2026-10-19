# 首页题记设计

## 目标

进入故事之前，让玩家读到一句概括本作循环的话：每一次获得都要付出代价。位置在首页标题下、主按钮上。

## 定稿文案

> 每一次获得都是一场赌博——你无从知晓，自己能否承受其代价

- **不加句号**：这是题记，不是正文句子，句末停在「代价」上。正文事件文案仍按 `docs/writing-style.md` 带句号。
- 两段式骨架、破折号、「赌博」「承受」「代价」都保留；相对原句只把「那份」换成「其」（30 字 → 29 字）。
- 被否掉的更短版本：「你不知能否承受代价」「你不知自己能否承受代价」——用户选定了书面味更重的「无从知晓」一版。

## 位置与排版

- DOM 顺序：标题 → 题记 → 主按钮，全部居中。
- 字号 12px（`--font-md`，像素字体网格），弱文字色 `--color-text-dim`：亮 6.90:1 / 暗 ≥9.7:1，过 4.5 门槛。只用 token，不新增颜色。
- 行高 1.9；两段各用一个 `white-space: nowrap` 的 `span`：宽屏并成一行，窄屏只在破折号处断成两行，不会把「赌博」「其代价」拆开。
- 间距：标题与题记之间 8px（`--sp-xs`）；标题原来的下边距上移到包裹标题与题记的 `.mode-select-head`，题记到按钮的呼吸位与改动前一致。

## 改动文件

- `src/ui/screens/ModeSelect/ModeSelect.tsx` — 新增 `.mode-select-head` 包裹层与 `.mode-select-epigraph`。
- `src/ui/screens/ModeSelect/ModeSelect.scss` — 新增 head / epigraph 规则；`.mode-select-title` 的 `margin-bottom` 归零（值移到 head），矮屏断点同步。
- `src/ui/screens/ModeSelect/ModeSelect.test.tsx` — 断言题记文案、DOM 顺序（标题 → 题记 → 按钮）。

## 验收

- `npx tsc --noEmit -p tsconfig.app.json`、`npx eslint src/ --quiet`、`npx vitest run` 全绿；`grep -rn ' as any' src/engine/` 仍为空。
- `node scripts/ui-geometry.mjs --pages home`：320px 窄屏不横向溢出，题记两行。
- 桌面与 320px 各目视一次截图。

## 不做

- 不做多句随机轮换，不改其它页面，不新增设置项。
