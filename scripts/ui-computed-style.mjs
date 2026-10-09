// ui-computed-style.mjs —— 浏览器计算值快照 / 对拍（配色重构的"逐处计算值相同"证明）
//
// 用途：像"把 scss 硬编码换成 token""把 TS 字面色换成 CSS 变量"这类**重构**，
// 判据不是"看起来一样"，而是**浏览器里的计算值逐处相同**。本脚本：
//   ① 快照模式：遍历指定页面的所有元素，用稳定选择器路径作 key，
//      记录颜色相关属性的 getComputedStyle 值 → JSON
//   ② 对拍模式：比对两份快照，逐 (页面, 主题, 元素, 属性) 报差异
//
// 用法（仓库根）：
//   node scripts/ui-computed-style.mjs --out /tmp/before.json
//   node scripts/ui-computed-style.mjs --out /tmp/after.json
//   node scripts/ui-computed-style.mjs --diff /tmp/before.json /tmp/after.json
//
//   --pages a,b,c     默认 home,settings,tag-preview,encyclopedia,dev-pixel,dev-tournament,dev-buildsim,dev-weapon,dev-ap,dev-meta
//   --theme light|dark|both   默认 both
//   --port 5199       自有端口（strictPort），退出时按 PID 停服务
//   --keep            结束后不停 dev server
//
// 退出码：快照 0；对拍 0 = 无差异，1 = 有差异（含新增/消失元素），2 = 环境错误。
//
// 与 ui-geometry.mjs 一样：自己 spawn vite + Chrome，按记录的 PID 收尾，不 pkill。

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// 页面 → 路径 + 采样前要做的准备动作（有些 UI 藏在弹窗 / tab 里）
const PAGES = {
    home: '/',
    'home-gameplay': { url: '/', prepare: `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '玩法')?.click()` },
    settings: '/settings',
    'tag-preview': '/dev?tab=tags',
    encyclopedia: '/encyclopedia',
    about: '/about',
    battle: '/battle',
    roguelite: '/roguelite',
    'dev-pixel': '/dev?tab=pixel',
    'dev-tournament': '/dev?tab=tournament',
    'dev-buildsim': '/dev?tab=buildsim',
    'dev-weapon': '/dev?tab=weapon',
    'dev-ap': '/dev?tab=ap',
    'dev-meta': '/dev?tab=meta',
    'dev-summary': '/dev?tab=summary',
    'dev-editor': '/dev?tab=editor',
};
const VIEWPORTS = [
    { name: '390x844', width: 390, height: 844, mobile: true },
    { name: '1280x800', width: 1280, height: 800, mobile: false },
];

function parseArgs(argv) {
    const out = { pages: 'home,settings,tag-preview,encyclopedia,dev-pixel,dev-tournament,dev-buildsim,dev-weapon,dev-ap,dev-meta', theme: 'both', port: 5199, keep: false, out: null, diff: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--pages') out.pages = argv[++i];
        else if (a === '--theme') out.theme = argv[++i];
        else if (a === '--port') out.port = Number(argv[++i]);
        else if (a === '--out') out.out = argv[++i];
        else if (a === '--diff') { out.diff = [argv[++i], argv[++i]]; }
        else if (a === '--keep') out.keep = true;
        else if (a === '--help' || a === '-h') out.help = true;
        else throw new Error(`未知参数：${a}`);
    }
    return out;
}
const opts = parseArgs(process.argv.slice(2));
if (opts.help) {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 24).join('\n'));
    process.exit(0);
}

// ── 对拍模式（不需要浏览器） ────────────────────────────────────────────────

if (opts.diff) {
    const [fa, fb] = opts.diff;
    const A = JSON.parse(fs.readFileSync(fa, 'utf8'));
    const B = JSON.parse(fs.readFileSync(fb, 'utf8'));
    const keys = new Set([...Object.keys(A), ...Object.keys(B)]);
    const diffs = [];
    for (const key of [...keys].sort()) {
        const a = A[key];
        const b = B[key];
        if (a === undefined) { diffs.push({ key, kind: '元素新增', from: null, to: b }); continue; }
        if (b === undefined) { diffs.push({ key, kind: '元素消失', from: a, to: null }); continue; }
        const props = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const p of [...props].sort()) {
            if (a[p] !== b[p]) diffs.push({ key, kind: '属性变化', prop: p, from: a[p], to: b[p] });
        }
    }
    console.log('== 计算值对拍 ==');
    console.log(`A：${fa}（${Object.keys(A).length} 个元素快照）`);
    console.log(`B：${fb}（${Object.keys(B).length} 个元素快照）`);
    console.log(`差异：${diffs.length} 处`);
    for (const d of diffs.slice(0, 200)) {
        if (d.kind === '属性变化') console.log(`  [变化] ${d.key} :: ${d.prop}: ${d.from} → ${d.to}`);
        else console.log(`  [${d.kind}] ${d.key}`);
    }
    if (diffs.length > 200) console.log(`  ...（其余 ${diffs.length - 200} 处从略）`);
    console.log(diffs.length ? '\n结果：有差异' : '\n结果：计算值逐处相同');
    process.exit(diffs.length ? 1 : 0);
}

if (!opts.out) {
    console.error('用法：--out <file> 快照，或 --diff <a> <b> 对拍');
    process.exit(2);
}
if (!fs.existsSync(CHROME)) {
    console.error(`找不到 Chrome：${CHROME}`);
    process.exit(2);
}

// ── 采样模式（浏览器） ──────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

const viteLog = fs.openSync(path.join('/tmp', `ui-cs-vite-${opts.port}.log`), 'w');
const vite = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(opts.port), '--strictPort'], { cwd: ROOT, stdio: ['ignore', viteLog, viteLog] });
let viteStopped = false;
const stopVite = () => { if (!viteStopped) { viteStopped = true; try { process.kill(vite.pid, 'SIGTERM'); } catch { /* 已退 */ } } };
process.on('exit', stopVite);
process.on('SIGINT', () => { stopVite(); process.exit(130); });

async function waitHttp(url) {
    for (let i = 0; i < 120; i++) {
        try { const r = await fetch(url); if (r.ok) return; } catch { /* 未起 */ }
        await sleep(250);
    }
    throw new Error(`dev server 起不来：${url}（日志 /tmp/ui-cs-vite-${opts.port}.log）`);
}
await waitHttp(`http://127.0.0.1:${opts.port}/`);
log(`dev server pid=${vite.pid}`);

const CDP_PORT = opts.port + 4000;
const profileDir = fs.mkdtempSync(path.join('/tmp', 'ui-cs-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox', '--hide-crash-restore-bubble', '--window-size=1280,800', `http://127.0.0.1:${opts.port}/`], { stdio: 'ignore' });
process.on('exit', () => { try { process.kill(chrome.pid, 'SIGKILL'); } catch { /* 已退 */ } });

async function fetchJson(url) {
    for (let i = 0; i < 120; i++) {
        try { const r = await fetch(url); if (r.ok) return await r.json(); } catch { /* 未起 */ }
        await sleep(250);
    }
    throw new Error(`无法连接 ${url}`);
}
const version = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json/version`);
log(`chrome pid=${chrome.pid} ${version['Browser']}`);
let target = null;
for (let i = 0; i < 40 && !target; i++) {
    const list = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
    target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    if (!target) await sleep(250);
}
if (!target) throw new Error('找不到 page target');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await Promise.race([new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; }), sleep(10000).then(() => { throw new Error('WebSocket 超时'); })]);
let msgId = 0;
const pending = new Map();
ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
        const { resolve, reject } = pending.get(m.id);
        pending.delete(m.id);
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    }
};
const send = (method, params = {}) => Promise.race([
    new Promise((resolve, reject) => { const id = ++msgId; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }),
    sleep(20000).then(() => { throw new Error(`CDP 超时：${method}`); }),
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

/** 采集：所有元素的颜色相关计算值，key = 稳定选择器路径 */
const SAMPLE = `(() => {
  const PROPS = ['color','background-color','background-image','border-top-color','border-right-color','border-bottom-color','border-left-color','outline-color','box-shadow','text-shadow','fill','stroke','opacity','filter'];
  const out = {};
  const all = document.querySelectorAll('body *');
  const seg = (el) => {
    const p = el.parentElement;
    if (!p) return el.tagName.toLowerCase();
    let i = 1;
    for (const s of p.children) { if (s === el) break; if (s.tagName === el.tagName) i++; }
    return el.tagName.toLowerCase() + ':nth-of-type(' + i + ')';
  };
  const pathOf = (el) => { const parts = []; let cur = el; while (cur && cur.tagName && cur.tagName.toLowerCase() !== 'body') { parts.unshift(seg(cur)); cur = cur.parentElement; } return parts.join('>'); };
  for (const el of all) {
    const cs = getComputedStyle(el);
    const rec = {};
    for (const p of PROPS) { const v = cs.getPropertyValue(p); if (v && v !== 'none' && v !== 'normal' && v !== 'rgba(0, 0, 0, 0)') rec[p] = v; }
    if (!Object.keys(rec).length) continue;
    const key = pathOf(el) + '|' + (el.className && typeof el.className === 'string' ? el.className.slice(0, 40) : '');
    if (out[key]) { let n = 2; while (out[key + '#' + n]) n++; out[key + '#' + n] = rec; }
    else out[key] = rec;
  }
  return out;
})()`;

const themes = opts.theme === 'both' ? ['light', 'dark'] : [opts.theme];
const pageNames = opts.pages.split(',').map((s) => s.trim()).filter((p) => PAGES[p]);
const snapshot = {};
for (const theme of themes) {
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
    for (const page of pageNames) {
        for (const vp of VIEWPORTS) {
            await send('Emulation.setDeviceMetricsOverride', { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile, screenWidth: vp.width, screenHeight: vp.height });
            await send('Emulation.setTouchEmulationEnabled', { enabled: !!vp.mobile, maxTouchPoints: vp.mobile ? 5 : 1 });
            const def = PAGES[page];
            const url = typeof def === 'string' ? def : def.url;
            await send('Page.navigate', { url: `http://127.0.0.1:${opts.port}${url}` });
            await waitLoad();
            await sleep(900);
            if (typeof def === 'object' && def.prepare) {
                await send('Runtime.evaluate', { expression: def.prepare, returnByValue: true });
                await sleep(600);
            }
            const res = await send('Runtime.evaluate', { expression: SAMPLE, returnByValue: true });
            const data = res.result.value ?? {};
            for (const [k, v] of Object.entries(data)) snapshot[`${theme}|${page}|${vp.name}|${k}`] = v;
            log(`${theme} ${page} ${vp.name}: ${Object.keys(data).length} 个元素`);
        }
    }
}
fs.writeFileSync(opts.out, JSON.stringify(snapshot, null, 0));
log(`快照写入 ${opts.out}（${Object.keys(snapshot).length} 条）`);
ws.close();
try { process.kill(chrome.pid, 'SIGKILL'); } catch { /* 已退 */ }
if (!opts.keep) stopVite();
await sleep(300);
process.exit(0);
