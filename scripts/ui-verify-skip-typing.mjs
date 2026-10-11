// ui-verify-skip-typing.mjs —— 打字中「点击任意处 / Enter / Space 跳过」的无头实测（CDP）
//
// 本项目没有 jsdom，交互只能靠真浏览器。本脚本起自有端口的 dev server，
// 用真实 CDP 输入事件（Input.dispatchMouseEvent / dispatchKeyEvent / dispatchTouchEvent，
// 不是 page.evaluate 里合成事件）走五组断言：
//   ① 1278 桌面：打字中点击**可滚动区域（.rs-rounds）空白处** → 描述立刻全出、选项出现；
//   ② 1278 桌面：打字中按 Enter → 同上；
//   ③ 1278 桌面：打字中按 Space → 同上，且 window.scrollY / .rs-rounds.scrollTop 前后不变
//      （取「先滚到非 0、再按 Space」的对照：默认行为被吃掉才会停在原处）；
//   ④ 打完字之后再点击 / 再按 Enter → 无副作用（不重复跳过、不误触选项、选项区不消失）；
//   ⑤ 390×844 + 触摸模拟：在描述上拖拽滚动 → 不触发跳过（文字长度还在增长；click 事件不补发）。
//
// 用法（仓库根）：node scripts/ui-verify-skip-typing.mjs [--port 5233] [--keep]
// 退出码：0 = 全通过；1 = 有断言失败；2 = 环境错误。不用 pkill，服务与 Chrome 都按 PID 停。

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOT_DIR = path.join(ROOT, 'tmp', 'preview');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const argv = process.argv.slice(2);
const opts = { port: 5233, keep: false };
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port') opts.port = Number(argv[++i]);
    else if (argv[i] === '--keep') opts.keep = true;
    else throw new Error(`未知参数：${argv[i]}`);
}
if (!fs.existsSync(CHROME)) {
    console.error(`找不到 Chrome：${CHROME}（可用 CHROME_PATH 指定）`);
    process.exit(2);
}
fs.mkdirSync(SHOT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
const results = [];
const failures = [];
function check(name, ok, detail) {
    results.push({ name, ok, detail });
    if (!ok) failures.push(`${name} :: ${JSON.stringify(detail)}`);
    log(`${ok ? '通过' : '失败'}  ${name}${detail === undefined ? '' : `  ${JSON.stringify(detail)}`}`);
}

// ---------------------------------------------------------------------------
// dev server（自有端口、记 PID）
// ---------------------------------------------------------------------------

const viteLog = fs.openSync(path.join('/tmp', `skip-typing-vite-${opts.port}.log`), 'w');
const vite = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(opts.port), '--strictPort'], {
    cwd: ROOT,
    stdio: ['ignore', viteLog, viteLog],
});
const stopVite = () => {
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

for (let i = 0; i < 120; i++) {
    try {
        const res = await fetch(`http://127.0.0.1:${opts.port}/`);
        if (res.ok) break;
    } catch {
        /* 还没起来 */
    }
    await sleep(250);
}
log(`dev server: pid=${vite.pid}  http://127.0.0.1:${opts.port}/`);

// ---------------------------------------------------------------------------
// headless Chrome（独立 profile、记 PID）
// ---------------------------------------------------------------------------

const CDP_PORT = opts.port + 4000;
const profileDir = fs.mkdtempSync(path.join('/tmp', 'skip-typing-chrome-'));
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

let target = null;
for (let i = 0; i < 40 && !target; i++) {
    const list = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
    target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    if (!target) await sleep(250);
}
if (!target) throw new Error('找不到 page target');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
});
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
    new Promise((resolve, reject) => {
        const id = ++msgId;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
    });

await send('Page.enable');
await send('Runtime.enable');
await send('Runtime.addBinding', { name: '__skipProbe' }).catch(() => {});

async function waitLoad() {
    for (let i = 0; i < 120; i++) {
        const r = await send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
        if (r.result.value === 'complete') return;
        await sleep(100);
    }
}

/** 在页面里求值（同步表达式，返回 JSON 值） */
async function evaluate(expression) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`页面求值异常：${JSON.stringify(r.exceptionDetails.exception?.description)}`);
    return r.result.value;
}

async function setViewport({ width, height, mobile }) {
    await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile,
        screenWidth: width,
        screenHeight: height,
    });
    await send('Emulation.setTouchEmulationEnabled', { enabled: !!mobile, maxTouchPoints: mobile ? 5 : 1 });
}

// 真鼠标点击（CDP 输入，isTrusted: true）
async function mouseClick(x, y) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await sleep(120);
}

async function pressKey(key, code, keyCode) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
    await sleep(150);
}
const pressEnter = () => pressKey('Enter', 'Enter', 13);
const pressSpace = () => pressKey(' ', 'Space', 32);

// ---------------------------------------------------------------------------
// 页面侧探针：描述快照 / 点击目标坐标 / 跳过是否发生
// ---------------------------------------------------------------------------

/**
 * 一次求值拿到：描述长度与文本、是否还在打字、选项数、滚动位置。
 * `descLen` 用 textContent 去掉光标字形后的长度（光标是独立的 .rc-cursor）。
 */
const SNAP = `(() => {
  const cur = document.querySelector('.rc-current');
  const desc = cur ? cur.querySelector('.rc-desc') : document.querySelector('.intro-overlay .io-text-live');
  const textEl = desc || null;
  const cursor = textEl ? textEl.querySelector('.rc-cursor, .io-cursor') : null;
  const typed = textEl ? textEl.textContent.replace(/[▌]/g, '') : '';
  const scroller = document.querySelector('.rs-rounds');
  return {
    hasCard: !!cur,
    isIntro: !cur && !!document.querySelector('.intro-overlay'),
    typed,
    len: typed.length,
    typing: !!cursor,
    choices: cur ? cur.querySelectorAll('.rc-choice').length : 0,
    selected: cur ? cur.querySelectorAll('.rc-choice-selected').length : 0,
    confirm: cur ? !!cur.querySelector('.rc-confirm') : false,
    roundsScrollTop: scroller ? scroller.scrollTop : null,
    roundsScrollHeight: scroller ? scroller.scrollHeight : null,
    windowScrollY: window.scrollY,
    activeTag: document.activeElement ? document.activeElement.tagName : null,
  };
})()`;

const snap = () => evaluate(SNAP);

/** 可滚动区域（.rs-rounds）里「不是当前卡片、也没别的文字」的空白处坐标 */
const BLANK_POINT = `(() => {
  const scroller = document.querySelector('.rs-rounds');
  if (!scroller) return null;
  const sr = scroller.getBoundingClientRect();
  const cur = document.querySelector('.rc-current');
  const cr = cur ? cur.getBoundingClientRect() : null;
  // 优先：滚动容器底部、当前卡片下沿之外的 padding 空白（.rs-rounds 自己的留白）
  if (cr && cr.bottom + 24 < sr.bottom) {
    return { x: Math.round(sr.left + sr.width / 2), y: Math.round(cr.bottom + 12), where: 'container-padding-below-card' };
  }
  // 次选：卡片内、描述文字块之外的空白（右半边、标题行下方）
  if (cr) {
    const d = document.querySelector('.rc-current .rc-desc');
    const dr = d ? d.getBoundingClientRect() : null;
    if (dr && dr.right + 16 < cr.right) {
      return { x: Math.round((dr.right + cr.right) / 2), y: Math.round(dr.top + dr.height / 2), where: 'card-blank-right-of-desc' };
    }
    return { x: Math.round(cr.left + cr.width / 2), y: Math.round(cr.top + 4), where: 'card-top-padding' };
  }
  return { x: Math.round(sr.left + sr.width / 2), y: Math.round(sr.top + 8), where: 'container-top' };
})()`;

const blankPoint = () => evaluate(BLANK_POINT);

/** 等当前卡打完字（选项出现） */
async function waitCardDone(timeoutMs = 20000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
        const s = await snap();
        if (s.hasCard && !s.typing) return s;
        await sleep(80);
    }
    throw new Error('等不到当前卡打完字');
}

/** 从任意界面走到「正在打字的回合卡」：点掉开场页 / 章页 / 推进过纯选择轮 */
async function gotoTypingCard() {
    await send('Page.navigate', { url: `http://127.0.0.1:${opts.port}/roguelite` });
    await waitLoad();
    // React 挂载 + 首屏渲染可能比 readyState=complete 晚一点（开发模式下按需编译更慢）
    for (let k = 0; k < 60; k++) {
        const s = await snap();
        if (s.isIntro || s.hasCard) break;
        await sleep(150);
    }
    await sleep(500);
    for (let i = 0; i < 60; i++) {
        const s = await snap();
        if (process.env.SKIP_DEBUG)
            log(
                `  [goto ${i}] ${JSON.stringify(s)} | ` +
                    `overlays=${await evaluate(`document.querySelectorAll('.intro-overlay').length`)} ` +
                    `enterVisible=${await evaluate(`(() => { const b = document.querySelector('.io-enter'); return b ? getComputedStyle(b).visibility : null; })()`)}`,
            );
        if (s.hasCard && s.typing) {
            // 滚动容器复位，后面的 scrollTop 前后对照才干净
            await evaluate(`(() => { const el = document.querySelector('.rs-rounds'); if (el) el.scrollTop = 0; })()`);
            await sleep(60);
            return await snap();
        }
        // 开场页 / 章页：等它打完，再点「开始」。
        // 这里刻意**直接读遮挡层的 DOM 类名**（`.intro-overlay-typing` 只在打字中挂着），
        // 而不是用 snap() 的 React 快照 —— 换页那一帧快照会读旧值，判断容易落空。
        if (await introPresent()) {
            for (let k = 0; k < 100; k++) {
                if (!(await introTyping())) break;
                await sleep(100);
            }
            const p = await pointOf('.io-enter', true);
            if (!p) throw new Error('开场页的「开始」按钮点不到');
            await mouseClick(p.x, p.y);
            // 点掉一页后会**立刻**换成下一页遮罩（开场页 → 第一章章页），中间还有一帧是空的：
            // 必须等 DOM 稳定下来再判断下一步，否则会拿旧快照去点被遮罩盖住的选项。
            await settle(150);
            continue;
        }
        // 无描述的纯选择轮（如「你从哪里来」）：选项 → 确认（这类轮没有光标，等不到打字）
        const p =
            (await pointOf('.rc-confirm')) ||
            (await pointOf('.rc-current .rc-choice:not(.rc-choice-selected)')) ||
            (await pointOf('.rc-current .rc-choice')) ||
            (await pointOf('.rs-battle-continue'));
        if (!p) throw new Error(`卡住了：既没有打字卡也没有可点选项 ${JSON.stringify(s)}`);
        if (process.env.SKIP_DEBUG) log(`     click(${p.sel}) at (${p.x},${p.y}) top=${JSON.stringify(await topAt(p.x, p.y))}`);
        await mouseClick(p.x, p.y);
        await settle(180);
        if (process.env.SKIP_DEBUG) log(`     click(${p.sel}) -> ${JSON.stringify(await snap())}`);
    }
    throw new Error('走不到正在打字的回合卡');
}

/** 直接问 DOM：开场/章页遮罩在不在（不用 React 快照，换页那一帧快照会读旧值） */
const introPresent = () => evaluate(`!!document.querySelector('.intro-overlay')`);
/** 直接问 DOM：遮罩是不是正在打字（类名或光标） */
const introTyping = () =>
    evaluate(
        `(() => { const el = document.querySelector('.intro-overlay'); return !!el && (el.classList.contains('intro-overlay-typing') || !!el.querySelector('.io-cursor')); })()`,
    );

/** 等界面稳定：同一份「遮罩数 / 当前卡 / 光标 / 选项数」串连续 3 次一致才认为换页结束 */
async function settle(stepMs = 120, maxSteps = 40) {
    let prev = null;
    let same = 0;
    for (let i = 0; i < maxSteps; i++) {
        const sig = await evaluate(
            `(() => [document.querySelectorAll('.intro-overlay').length, !!document.querySelector('.rc-current'), !!document.querySelector('.rc-cursor'), document.querySelectorAll('.rc-current .rc-choice').length, document.querySelectorAll('.io-enter').length].join('/'))()`,
        );
        same = sig === prev ? same + 1 : 0;
        if (same >= 2) return sig;
        prev = sig;
        await sleep(stepMs);
    }
    return prev;
}

/** 某个坐标上最顶层的元素（诊断用） */
async function topAt(x, y) {
    return evaluate(`(() => {
      const el = document.elementFromPoint(${x}, ${y});
      if (!el) return null;
      return { tag: el.tagName, cls: String(el.className).slice(0, 60), overlays: document.querySelectorAll('.intro-overlay').length };
    })()`);
}

/** 某个选择器的中心坐标；`requireVisible` = 必须 visibility 不是 hidden（用于 .io-enter） */
async function pointOf(sel, requireVisible = false) {
    return evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return null;
      if (${requireVisible} && getComputedStyle(el).visibility === 'hidden') return null;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return null;
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), sel: ${JSON.stringify(sel)} };
    })()`);
}

// ---------------------------------------------------------------------------
// 探针 1：文本真正打完时的长度（不必依赖页面内的完整原文）
// ---------------------------------------------------------------------------

async function measureFinalLen() {
    await gotoTypingCard();
    const s = await waitCardDone();
    return { finalLen: s.len, choices: s.choices, typed: s.typed };
}

// ---------------------------------------------------------------------------
// ①-④ 桌面档
// ---------------------------------------------------------------------------

await setViewport({ width: 1280, height: 800, mobile: false });
// 逐字打开（默认即 true，但显式写死，避免受 profile 残留影响）
await send('Page.navigate', { url: `http://127.0.0.1:${opts.port}/` });
await waitLoad();
await evaluate(`localStorage.setItem('bdgame-ui-config', JSON.stringify({ theme: 'dark', uiScale: 1, typewriter: true }))`);

const final = await measureFinalLen();
log(`文本打完基线：len=${final.finalLen} 选项=${final.choices}`);
check('基线：等自然打完拿到全文长度（对照组）', final.finalLen > 10, { finalLen: final.finalLen, choices: final.choices });

// ① 点击可滚动区域空白处
{
    const before = await gotoTypingCard();
    const p = await blankPoint();
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SHOT_DIR, 'skip-typing-typing-1280.png'), Buffer.from(shot.data, 'base64'));
    await mouseClick(p.x, p.y);
    const after = await snap();
    check(
        '① 点击可滚动区域空白处 → 立刻全出',
        after.typing === false && after.len === final.finalLen && after.choices === final.choices,
        { point: p, beforeLen: before.len, beforeTyping: before.typing, afterLen: after.len, afterTyping: after.typing, choices: after.choices },
    );
    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SHOT_DIR, 'skip-typing-done-1280.png'), Buffer.from(shot2.data, 'base64'));

    // ④ 打完字之后再点击 / 再按 Enter：无副作用
    const beforeClickAgain = await snap();
    const pAgain = await blankPoint();
    await mouseClick(pAgain.x, pAgain.y);
    await pressEnter();
    const afterAgain = await snap();
    check(
        '④ 打完字后再点击 / 再按 Enter → 无副作用',
        afterAgain.typing === false &&
            afterAgain.len === final.finalLen &&
            afterAgain.selected === 0 &&
            !afterAgain.confirm &&
            afterAgain.choices === final.choices &&
            afterAgain.roundsScrollTop === beforeClickAgain.roundsScrollTop,
        {
            len: afterAgain.len,
            selected: afterAgain.selected,
            confirm: afterAgain.confirm,
            choices: afterAgain.choices,
            scrollTop: [beforeClickAgain.roundsScrollTop, afterAgain.roundsScrollTop],
        },
    );

    // 选项照旧可点（证明交互没被抢）
    const pick = await evaluate(`(() => {
      const el = document.querySelector('.rc-current .rc-choice');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    await mouseClick(pick.x, pick.y);
    const afterPick = await snap();
    check('④b 选项点击照旧生效（选中态出现，未被跳过逻辑吃掉）', afterPick.selected >= 1, { selected: afterPick.selected });
}

// ② Enter 跳过
{
    const before = await gotoTypingCard();
    await pressEnter();
    const after = await snap();
    check('② 打字中按 Enter → 立刻全出', after.typing === false && after.len === final.finalLen, {
        beforeLen: before.len,
        afterLen: after.len,
        afterTyping: after.typing,
    });
}

// ③ Space 跳过 + 不额外滚动
{
    const before = await gotoTypingCard();
    // 滚动容器挪到中间：Space 的默认行为（向下滚一屏）若没被吃掉，scrollTop 立刻会变
    await evaluate(`(() => { const s = document.querySelector('.rs-rounds'); s.scrollTop = 0; })()`);
    await sleep(80);
    const pre = await snap();
    await pressSpace();
    const after = await snap();
    check(
        '③ 打字中按 Space → 立刻全出，且没有额外滚动',
        after.typing === false && after.len === final.finalLen && after.roundsScrollTop === pre.roundsScrollTop && after.windowScrollY === pre.windowScrollY,
        {
            beforeLen: before.len,
            afterLen: after.len,
            roundsScrollTop: [pre.roundsScrollTop, after.roundsScrollTop],
            windowScrollY: [pre.windowScrollY, after.windowScrollY],
        },
    );
}

// ③b 对照：不在打字状态时按 Space，滚动容器照常下滚（证明上一条是 preventDefault 的功劳，不是容器本来就不滚）
{
    await evaluate(`(() => { const s = document.querySelector('.rs-rounds'); s.scrollTop = 0; })()`);
    await sleep(80);
    const before2 = await snap();
    await pressSpace();
    const after2 = await snap();
    check(
        '③b 对照：不在打字时按 Space，滚动容器照常下滚',
        before2.typing === false && after2.roundsScrollTop > before2.roundsScrollTop,
        {
            typing: before2.typing,
            roundsScrollTop: [before2.roundsScrollTop, after2.roundsScrollTop],
            scrollHeight: after2.roundsScrollHeight,
        },
    );
}

// ---------------------------------------------------------------------------
// ⑤ 触屏档：拖拽滚动不算「点击跳过」
// ---------------------------------------------------------------------------

await setViewport({ width: 390, height: 844, mobile: true });
{
    const before = await gotoTypingCard();
    await evaluate(`(() => { const s = document.querySelector('.rs-rounds'); s.scrollTop = 0; })()`);
    await sleep(80);
    const anchor = await evaluate(`(() => {
      const s = document.querySelector('.rs-rounds');
      const r = s.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height * 0.75) };
    })()`);
    const start = await snap();
    // 真实触摸：按下 → 分步上移（拖动滚动）→ 抬起
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: anchor.x, y: anchor.y }] });
    for (let i = 1; i <= 10; i++) {
        await send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: anchor.x + i, y: anchor.y - i * 12 }],
        });
        await sleep(30);
    }
    await sleep(120); // 手指按住后停顿，进一步排除「轻点」判定
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(250);
    const after = await snap();
    check(
        '⑤ 390×844 触屏：拖拽滚动没有被当成跳过（文字仍在打字并继续推进）',
        after.typing === true && after.len > start.len && after.roundsScrollTop > start.roundsScrollTop,
        {
            startLen: start.len,
            afterLen: after.len,
            startTyping: start.typing,
            afterTyping: after.typing,
            scrollTop: [start.roundsScrollTop, after.roundsScrollTop],
            drag: anchor,
        },
    );

    // ⑤b 触屏档的一张「打字中」截图（拖动之后仍在打字）+ 点击跳过后的截图
    const shotTyping = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SHOT_DIR, 'skip-typing-typing-390.png'), Buffer.from(shotTyping.data, 'base64'));
    const blank390 = await evaluate(`(() => {
      const s = document.querySelector('.rs-rounds');
      const r = s.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.bottom - 10) };
    })()`);
    // 触屏档的「点击」用 touchStart/touchEnd 同点（真机上 click 就是这么来的）
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: blank390.x, y: blank390.y }] });
    await sleep(40);
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(200);
    const afterTap = await snap();
    check('⑤b 390×844 触屏：轻点空白处 → 跳过生效（真机 click 路径）', afterTap.typing === false && afterTap.len === final.finalLen, {
        len: afterTap.len,
        typing: afterTap.typing,
        expected: final.finalLen,
    });
    const shotDone = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SHOT_DIR, 'skip-typing-done-390.png'), Buffer.from(shotDone.data, 'base64'));
}

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------

fs.writeFileSync(
    path.join(SHOT_DIR, 'skip-typing-report.json'),
    JSON.stringify({ results, failures, finalLen: final.finalLen }, null, 1),
);
console.log('\n== 汇总 ==');
for (const r of results) console.log(`${r.ok ? '通过' : '失败'}  ${r.name}`);
console.log(`截图：${SHOT_DIR}/skip-typing-{typing,done}-{390,1280}.png`);
console.log(failures.length ? `\n结果：失败（${failures.length} 项）\n  ${failures.join('\n  ')}` : '\n结果：全部通过');

ws.close();
stopChrome();
if (opts.keep) log(`--keep：dev server 保留在 pid=${vite.pid}`);
else stopVite();
await sleep(300);
process.exit(failures.length ? 1 : 0);
