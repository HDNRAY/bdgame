// ui-geometry.mjs —— 无头 Chrome（CDP）几何断言 + 目视截图留存
//
// 为什么不是截图 md5：配色改动**必然**改变像素，md5 永远会变，不能作为通过条件
// （口径见 docs/ui-color-system.md「验证口径汇总」）。本脚本把「能当通过条件的部分」做成断言：
//   ① 三档视口下 documentElement.scrollWidth === window.innerWidth（无横向溢出）
//   ② 没有任何元素的 getBoundingClientRect 越出视口（左 < -0.5 或 右 > innerWidth + 0.5）
// 截图只**留存**到 tmp/preview/（已 gitignore）供人工目视，不参与判定。
//
// 用法（在仓库根）：
//   node scripts/ui-geometry.mjs                     # 亮 + 暗，全部玩家可见页 × 三档
//   node scripts/ui-geometry.mjs --theme light       # 只跑一套主题
//   node scripts/ui-geometry.mjs --pages home        # 只跑首页（名字见下面的 PAGES）
//   node scripts/ui-geometry.mjs --port 5199         # 换端口（默认 5199，strictPort）
//   node scripts/ui-geometry.mjs --keep              # 结束后不停 dev server
//
// 环境变量：CHROME_PATH 覆盖 Chrome 可执行文件路径。
// 退出码：0 = 全部断言通过；1 = 有溢出；2 = 环境错误。
//
// 服务生命周期：脚本自己 spawn vite（自有端口、strictPort），退出时按**记录的 PID** SIGTERM
// 停掉；不使用 pkill。Chrome 同理（SIGKILL + 独立 user-data-dir，不会碰到用户正在用的浏览器）。

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOT_DIR = path.join(ROOT, 'tmp', 'preview');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// ---------------------------------------------------------------------------
// 参数
// ---------------------------------------------------------------------------

function parseArgs(argv) {
    const out = {
        theme: 'both',
        pages:
            'home,build-ajiu,battle,roguelite-intro,roguelite-battle,settings,about,encyclopedia,tag-preview',
        port: 5199,
        keep: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--theme') out.theme = argv[++i];
        else if (a === '--pages') out.pages = argv[++i];
        else if (a === '--port') out.port = Number(argv[++i]);
        else if (a === '--keep') out.keep = true;
        else if (a === '--help' || a === '-h') out.help = true;
        else throw new Error(`未知参数：${a}`);
    }
    if (!['light', 'dark', 'both'].includes(out.theme)) throw new Error(`--theme 只能是 light/dark/both`);
    return out;
}

const opts = parseArgs(process.argv.slice(2));
if (opts.help) {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 22).join('\n'));
    process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

if (!fs.existsSync(CHROME)) {
    console.error(`找不到 Chrome：${CHROME}（可用 CHROME_PATH 指定）`);
    process.exit(2);
}
fs.mkdirSync(SHOT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// dev server（自有端口，记 PID）
// ---------------------------------------------------------------------------

const viteLog = fs.openSync(path.join('/tmp', `ui-geometry-vite-${opts.port}.log`), 'w');
const vite = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(opts.port), '--strictPort'], {
    cwd: ROOT,
    stdio: ['ignore', viteLog, viteLog],
});
let viteStopped = false;
const stopVite = () => {
    if (viteStopped) return;
    viteStopped = true;
    try {
        process.kill(vite.pid, 'SIGTERM');
    } catch {
        /* 已经退了 */
    }
};
process.on('exit', stopVite);
process.on('SIGINT', () => {
    stopVite();
    process.exit(130);
});

async function waitHttp(url) {
    for (let i = 0; i < 120; i++) {
        try {
            const res = await fetch(url);
            if (res.ok) return;
        } catch {
            /* 还没起来 */
        }
        await sleep(250);
    }
    throw new Error(`dev server 起不来：${url}（日志 /tmp/ui-geometry-vite-${opts.port}.log）`);
}

await waitHttp(`http://127.0.0.1:${opts.port}/`);
log(`dev server: pid=${vite.pid}  http://127.0.0.1:${opts.port}/`);

// ---------------------------------------------------------------------------
// headless Chrome（独立 profile，记 PID）
// ---------------------------------------------------------------------------

const CDP_PORT = opts.port + 4000;
const profileDir = fs.mkdtempSync(path.join('/tmp', 'ui-geometry-chrome-'));
const chrome = spawn(
    CHROME,
    [
        '--headless=new',
        `--remote-debugging-port=${CDP_PORT}`,
        `--user-data-dir=${profileDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--hide-crash-restore-bubble',
        // 经典滚动条会占宽（桌面 1280 的布局视口变 1265），让「scrollWidth == innerWidth」这条断言
        // 在有纵向滚动的页面上失真；无头环境用叠加滚动条，量到的是内容宽度本身。
        '--hide-scrollbars',
        '--window-size=1280,800',
        `http://127.0.0.1:${opts.port}/`,
    ],
    { stdio: 'ignore' },
);
const stopChrome = () => {
    try {
        process.kill(chrome.pid, 'SIGKILL');
    } catch {
        /* 已经退了 */
    }
};
process.on('exit', stopChrome);

async function fetchJson(url) {
    for (let i = 0; i < 120; i++) {
        try {
            const res = await fetch(url);
            if (res.ok) return await res.json();
        } catch {
            /* 还没起来 */
        }
        await sleep(250);
    }
    throw new Error(`无法连接 ${url}`);
}

const version = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json/version`);
log(`chrome: pid=${chrome.pid}  ${version['Browser']}`);

let target = null;
for (let i = 0; i < 40 && !target; i++) {
    const list = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
    target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    if (!target) await sleep(250);
}
if (!target) throw new Error('找不到 page target');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await Promise.race([
    new Promise((res, rej) => {
        ws.onopen = res;
        ws.onerror = rej;
    }),
    sleep(10000).then(() => {
        throw new Error('WebSocket 打开超时');
    }),
]);

let msgId = 0;
const pending = new Map();
ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
};
const send = (method, params = {}) =>
    Promise.race([
        new Promise((resolve, reject) => {
            const id = ++msgId;
            pending.set(id, { resolve, reject });
            ws.send(JSON.stringify({ id, method, params }));
        }),
        sleep(20000).then(() => {
            throw new Error(`CDP 超时：${method}`);
        }),
    ]);

await send('Page.enable');
await send('Runtime.enable');

async function waitLoad() {
    for (let i = 0; i < 100; i++) {
        const r = await send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
        if (r.result.value === 'complete') return;
        await sleep(100);
    }
}

// 量测口径：documentElement.scrollWidth === innerWidth，且无元素矩形越出视口。
// 自常驻底栏（docs/superpowers/specs/2026-10-09-bottom-footer-design.md）起，另加三条：
//   ③ 底栏完整落在视口内（bottom 贴住视口底、高 == --bottom-bar-h）；
//   ④ 四个入口的命中区都不小于 44×44（H5 硬口径）；
//   ⑤ 走到当前战斗轮的页面把 `.rs-battle` / `.rc-current` 的 clientHeight 一起写进 geometry.json
//      （与改动前基线对拍，只增不减 —— 见底栏 spec §6 的风险表）。
const MEASURE = `(() => {
  const vw = window.innerWidth;
  const de = document.documentElement;
  const out = {
    innerWidth: vw,
    docScrollWidth: de.scrollWidth,
    docClientWidth: de.clientWidth,
    innerHeight: window.innerHeight,
    overflow: [],
    themeAttr: de.dataset.theme || null,
    bottomBar: null,
    barItems: [],
    occluded: [],
    rsBattle: null,
    rcCurrent: null,
  };
  // 元素越出视口才算问题；但**被祖先水平裁切**的越界元素是局部横向滚动（如窄屏的战斗演示面板
  // .bp-center，手机横屏时的 battle 页），不是页面级横向溢出 —— 那类只看祖先链上的 overflow-x。
  const clippedByAncestor = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'hidden' || ox === 'clip' || ox === 'auto' || ox === 'scroll') return true;
    }
    return false;
  };
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.right > vw + 0.5 || r.left < -0.5) {
      if (clippedByAncestor(el)) continue;
      const cls = el.className && typeof el.className === 'string' ? el.className : el.tagName;
      out.overflow.push({
        tag: el.tagName,
        cls: String(cls).slice(0, 60),
        left: +r.left.toFixed(1),
        right: +r.right.toFixed(1),
        width: +r.width.toFixed(1),
      });
      if (out.overflow.length > 12) break;
    }
  }
  const bar = document.querySelector('.bottom-bar');
  if (bar) {
    const r = bar.getBoundingClientRect();
    out.bottomBar = {
      left: +r.left.toFixed(1),
      right: +r.right.toFixed(1),
      top: +r.top.toFixed(1),
      bottom: +r.bottom.toFixed(1),
      height: +r.height.toFixed(1),
      cssHeight: getComputedStyle(de).getPropertyValue('--bottom-bar-h').trim(),
      items: [...bar.querySelectorAll('.bottom-bar-item')].map((el) => {
        const ir = el.getBoundingClientRect();
        return {
          label: (el.textContent || '').trim(),
          w: +ir.width.toFixed(1),
          h: +ir.height.toFixed(1),
          pressed: el.getAttribute('aria-pressed'),
        };
      }),
    };
  }
  const arena = document.querySelector('.rs-battle');
  if (arena) {
    const r = arena.getBoundingClientRect();
    out.rsBattle = { clientHeight: arena.clientHeight, rectHeight: +r.height.toFixed(1), top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1) };
  }
  const cur = document.querySelector('.rc-current');
  if (cur) out.rcCurrent = { clientHeight: cur.clientHeight, rectHeight: +cur.getBoundingClientRect().height.toFixed(1) };
  // 内容给底栏让位：可见文本被压到底栏下沿之下 = 留底机制没生效（或固定浮层没让位）。
  // 只算「自己不在滚动容器里」的文本元素 —— 滚动容器里的内容被裁切是正常的（还能滚出来）。
  const scrollableAncestor = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll)/.test(cs.overflowY + ' ' + cs.overflowX)) return true;
    }
    return false;
  };
  out.occluded = [];
  if (bar) {
    const barTop = bar.getBoundingClientRect().top;
    for (const el of document.querySelectorAll('body *')) {
      if (el === bar || bar.contains(el)) continue;
      // 只看「自己直接有文字」的元素，避免把一大堆祖先块也算进来
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== '');
      if (!own) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (r.bottom <= barTop + 0.5) continue;
      if (scrollableAncestor(el)) continue;
      const cls = el.className && typeof el.className === 'string' ? el.className : el.tagName;
      out.occluded.push({ tag: el.tagName, cls: String(cls).slice(0, 50), bottom: +r.bottom.toFixed(1), text: (el.textContent || '').trim().slice(0, 24) });
      if (out.occluded.length > 10) break;
    }
  }
  return out;
})()`;

// 点击式准备动作：roguelite 一族的页面要先点掉开场页 / 章页 / 逐轮点选（'roguelite-intro'
// 本身停在开场页，不做准备）。
// 与「点按钮进战斗轮」的目视路径一致，不注入任何游戏状态。
const ADVANCE_ONE = `(() => {
  const q = (s) => document.querySelector(s);
  const en = q('.io-enter');
  if (en && getComputedStyle(en).visibility !== 'hidden') { en.click(); return 'enter'; }
  const intro = q('.intro-overlay');
  if (intro) { intro.click(); return 'intro'; }
  const cur = q('.rc-current');
  if (cur) {
    // 多选轮：选中后要先点「确认」才推进（单选轮点选项即执行）
    const ok = q('.rc-confirm');
    if (ok) { ok.click(); return 'confirm'; }
    const btn = cur.querySelector('.rc-choice:not(.rc-choice-selected)');
    if (btn) { btn.click(); return 'choice'; }
    cur.click(); return 'skip';
  }
  return 'idle';
})()`;

// 断言用页：必须有稳定的数据依赖（首页与设置页不依赖随机 seed）。
// 'encyclopedia'（/encyclopedia）已是玩家可见页面的默认断言集成员：它的卡片网格
// 用 minmax(min(20rem, 100%), 1fr)，320×568 下回落成单列、不再越出视口。
// 另有 'tag-preview'（/dev?tab=tags）可用 --pages 单独跑，只作参考、不作通过条件
// （DevMode 页面豁免 H5，见 AGENTS.md）。
// 「全部玩家可见页」= home / build / battle / roguelite（开场页 · 局内战斗轮）/ settings / about / encyclopedia。
const ALL_PAGES = [
    { name: 'home', url: '/' },
    { name: 'build-ajiu', url: '/build/ajiu' },
    { name: 'battle', url: '/battle?a=ajiu&b=baihu' },
    { name: 'roguelite-intro', url: '/roguelite' },
    {
        name: 'roguelite-battle',
        url: '/roguelite',
        // 逐轮点选直到出现 .rs-battle（当前战斗轮）
        prepareTo: '.rs-battle',
    },
    { name: 'settings', url: '/settings' },
    { name: 'about', url: '/about' },
    { name: 'encyclopedia', url: '/encyclopedia' },
    { name: 'tag-preview', url: '/dev?tab=tags' },
];
const PAGES = ALL_PAGES.filter((p) => opts.pages.split(',').map((s) => s.trim()).includes(p.name));

const VIEWPORTS = [
    { name: '390x844', width: 390, height: 844, mobile: true },
    { name: '320x568', width: 320, height: 568, mobile: true },
    { name: '1280x800', width: 1280, height: 800, mobile: false },
];

const THEMES = opts.theme === 'both' ? ['light', 'dark'] : [opts.theme];

const rows = [];
const failures = [];

for (const theme of THEMES) {
    await send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-color-scheme', value: theme }],
    });
    for (const page of PAGES) {
        for (const vp of VIEWPORTS) {
            await send('Emulation.setDeviceMetricsOverride', {
                width: vp.width,
                height: vp.height,
                deviceScaleFactor: 1,
                mobile: vp.mobile,
                screenWidth: vp.width,
                screenHeight: vp.height,
            });
            await send('Emulation.setTouchEmulationEnabled', {
                enabled: !!vp.mobile,
                maxTouchPoints: vp.mobile ? 5 : 1,
            });
            await send('Page.navigate', { url: `http://127.0.0.1:${opts.port}${page.url}` });
            await waitLoad();
            await sleep(1200);
            // 点击式准备：需要走到局内 / 战斗轮的页面自己点进去（与目视路径一致）
            if (page.prepareTo) {
                let hit = false;
                for (let i = 0; i < 120 && !hit; i++) {
                    const r = await send('Runtime.evaluate', {
                        expression: `!!document.querySelector(${JSON.stringify(page.prepareTo)})`,
                        returnByValue: true,
                    });
                    if (r.result.value) {
                        hit = true;
                        break;
                    }
                    const a = await send('Runtime.evaluate', { expression: ADVANCE_ONE, returnByValue: true });
                    await sleep(a.result.value === 'choice' ? 900 : 400);
                }
                if (!hit) failures.push(`${theme} ${page.name} ${vp.name}: 准备步骤没走到 ${page.prepareTo}`);
                await sleep(400);
            }
            const res = await send('Runtime.evaluate', { expression: MEASURE, returnByValue: true });
            const m = res.result.value;
            const row = { theme, page: page.name, vp: vp.name, ...m };
            rows.push(row);

            const widthOk = m.docScrollWidth === m.innerWidth;
            const overflowOk = m.overflow.length === 0;
            // 底栏：完整在视口内、贴住布局视口的左右与下沿、四个入口 ≥44×44。
            // 宽度基准用 documentElement.clientWidth 而非 innerWidth：桌面有纵向滚动条时
            // 两者差一条滚动条宽（battle 页 1280 → 1265），fixed 元素贴的是布局视口。
            const bar = m.bottomBar;
            const layoutW = m.docClientWidth;
            const barOk =
                !!bar &&
                Math.abs(bar.left) <= 0.5 &&
                bar.right >= layoutW - 0.5 &&
                Math.abs(bar.bottom - m.innerHeight) <= 0.5 &&
                bar.items.length === 4 &&
                bar.items.every((it) => it.w >= 44 - 0.5 && it.h >= 44 - 0.5);
            if (!widthOk) failures.push(`${theme} ${page.name} ${vp.name}: scrollWidth=${m.docScrollWidth} != innerWidth=${m.innerWidth}`);
            if (!overflowOk) {
                failures.push(`${theme} ${page.name} ${vp.name}: ${m.overflow.length} 个元素越出视口 ${JSON.stringify(m.overflow.slice(0, 3))}`);
            }
            const occludedOk = (m.occluded ?? []).length === 0;
            if (!occludedOk) {
                failures.push(`${theme} ${page.name} ${vp.name}: ${m.occluded.length} 处内容被底栏压住 ${JSON.stringify(m.occluded.slice(0, 3))}`);
            }
            if (!barOk) {
                failures.push(
                    `${theme} ${page.name} ${vp.name}: 底栏不达标 ${JSON.stringify({
                        bar: bar && { left: bar.left, right: bar.right, bottom: bar.bottom, h: bar.height, cssH: bar.cssHeight },
                        items: bar && bar.items,
                        layoutW,
                        innerH: m.innerHeight,
                    })}`,
                );
            }
            log(
                `${theme.padEnd(5)} ${page.name.padEnd(17)} ${vp.name.padEnd(9)} ` +
                    `scrollWidth=${m.docScrollWidth} innerWidth=${m.innerWidth} ${widthOk ? 'OK' : '横向溢出'} ` +
                    `超视口元素=${m.overflow.length} 被底栏压住=${(m.occluded ?? []).length} 底栏=${bar ? `${bar.height}px/${bar.items.map((i) => `${i.label}:${i.w}x${i.h}`).join(',')}` : '缺失'} ` +
                    `rs-battle=${m.rsBattle ? m.rsBattle.clientHeight : '-'} rc-current=${m.rcCurrent ? m.rcCurrent.clientHeight : '-'}`,
            );

            const shot = await send('Page.captureScreenshot', { format: 'png' });
            const file = `${page.name}-${theme}-${vp.name}.png`;
            fs.writeFileSync(path.join(SHOT_DIR, file), Buffer.from(shot.data, 'base64'));
        }
    }
}

console.log('\n== 几何断言 ==');
console.log(`视口档数：${VIEWPORTS.length}（${VIEWPORTS.map((v) => v.name).join(' / ')}）  主题：${THEMES.join(' + ')}`);
for (const r of rows) {
    const ok = r.docScrollWidth === r.innerWidth && r.overflow.length === 0 && !!r.bottomBar;
    console.log(
        `${ok ? '通过' : '失败'}  ${r.theme.padEnd(5)} ${r.page.padEnd(17)} ${r.vp.padEnd(9)} ` +
            `scrollWidth=${r.docScrollWidth} innerWidth=${r.innerWidth} 超视口=${r.overflow.length} ` +
            `底栏=${r.bottomBar ? r.bottomBar.height : '缺失'} rs-battle=${r.rsBattle ? r.rsBattle.clientHeight : '-'} ` +
            `rc-current=${r.rcCurrent ? r.rcCurrent.clientHeight : '-'} theme=${r.themeAttr}`,
    );
}
console.log(`\n截图：${rows.length} 张，在 ${path.relative(ROOT, SHOT_DIR)}/ （只留存，不参与判定）`);
if (failures.length) {
    console.log('\n失败明细：');
    for (const f of failures) console.log(`  ${f}`);
}
console.log(
    failures.length
        ? `\n结果：失败（${failures.length} 项）`
        : '\n结果：通过（三档 scrollWidth == innerWidth，超视口元素 0）',
);

fs.writeFileSync(
    path.join(SHOT_DIR, 'geometry.json'),
    JSON.stringify({ theme: opts.theme, viewports: VIEWPORTS.map((v) => v.name), rows, failures }, null, 1),
);

ws.close();
stopChrome();
if (opts.keep) {
    console.log(`--keep：dev server 保留在 pid=${vite.pid}  http://127.0.0.1:${opts.port}/`);
} else {
    stopVite();
}
await sleep(300);
process.exit(failures.length ? 1 : 0);
