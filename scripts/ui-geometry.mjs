// ui-geometry.mjs —— 无头 Chrome（CDP）几何断言 + 目视截图留存
//
// 为什么不是截图 md5：配色改动**必然**改变像素，md5 永远会变，不能作为通过条件
// （口径见 docs/ui-color-system.md「验证口径汇总」）。本脚本把「能当通过条件的部分」做成断言：
//   ① 三档视口下 documentElement.scrollWidth === window.innerWidth（无横向溢出）
//   ② 没有任何元素的 getBoundingClientRect 越出视口（左 < -0.5 或 右 > innerWidth + 0.5）
// 截图只**留存**到 tmp/preview/（已 gitignore）供人工目视，不参与判定。
//
// 用法（在仓库根）：
//   node scripts/ui-geometry.mjs                     # 亮 + 暗，两页 × 三档
//   node scripts/ui-geometry.mjs --theme light       # 只跑一套主题
//   node scripts/ui-geometry.mjs --pages home        # 只跑首页（可选 home / settings / encyclopedia / tag-preview）
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
    const out = { theme: 'both', pages: 'home,settings', port: 5199, keep: false };
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
  };
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.right > vw + 0.5 || r.left < -0.5) {
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
  return out;
})()`;

// 断言用页：必须有稳定的数据依赖（首页与设置页不依赖随机 seed）。
// 另有 'encyclopedia'（/encyclopedia）可用 --pages 单独跑：它在 320×568 下本来就有
// 13 个 .encyclopedia-card 越出视口（卡片固定宽度，文档无横向滚动），是既有布局问题、
// 与配色无关，所以不放进默认断言集。
const PAGES = [
    { name: 'home', url: '/' },
    { name: 'settings', url: '/settings' },
    { name: 'encyclopedia', url: '/encyclopedia' },
    { name: 'tag-preview', url: '/dev?tab=tags' },
].filter((p) => opts.pages.split(',').map((s) => s.trim()).includes(p.name));

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
            const res = await send('Runtime.evaluate', { expression: MEASURE, returnByValue: true });
            const m = res.result.value;
            const row = { theme, page: page.name, vp: vp.name, ...m };
            rows.push(row);

            const widthOk = m.docScrollWidth === m.innerWidth;
            const overflowOk = m.overflow.length === 0;
            if (!widthOk) failures.push(`${theme} ${page.name} ${vp.name}: scrollWidth=${m.docScrollWidth} != innerWidth=${m.innerWidth}`);
            if (!overflowOk) {
                failures.push(`${theme} ${page.name} ${vp.name}: ${m.overflow.length} 个元素越出视口 ${JSON.stringify(m.overflow.slice(0, 3))}`);
            }
            log(
                `${theme.padEnd(5)} ${page.name.padEnd(11)} ${vp.name.padEnd(9)} ` +
                    `scrollWidth=${m.docScrollWidth} innerWidth=${m.innerWidth} ${widthOk ? 'OK' : '横向溢出'} ` +
                    `超视口元素=${m.overflow.length}`,
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
    const ok = r.docScrollWidth === r.innerWidth && r.overflow.length === 0;
    console.log(
        `${ok ? '通过' : '失败'}  ${r.theme.padEnd(5)} ${r.page.padEnd(11)} ${r.vp.padEnd(9)} ` +
            `scrollWidth=${r.docScrollWidth} innerWidth=${r.innerWidth} 超视口=${r.overflow.length} theme=${r.themeAttr}`,
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
