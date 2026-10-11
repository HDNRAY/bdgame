// ui-verify-skip-typing.mjs —— 打字中「点击任意处 / Enter / Space 跳过」的无头实测（CDP）
//
// 本项目没有 jsdom，交互只能靠真浏览器。本脚本起自有端口的 dev server，
// 用真实 CDP 输入事件（Input.dispatchMouseEvent / dispatchKeyEvent / dispatchTouchEvent，
// 不是 page.evaluate 里合成事件）走这几组断言：
//   基线：自然打完拿到全文（对照组）
//   ① 打字中点击**可滚动区域（.rs-rounds）空白处** → 描述立刻全出、选项出现；
//   ② 打字中按 Enter → 同上；
//   ③ 打字中按 Space → 同上，且 .rs-rounds.scrollTop / window.scrollY 前后不变；
//   ③b 对照：不在打字时按 Space，滚动容器照常下滚（证明 ③ 是 preventDefault 的功劳）；
//   ④ 打完字之后再点击 / 再按 Enter → 无副作用（不重复跳过、不误触选项、位置不变）；
//   ④b 选项点击照旧生效（交互没被抢）；
//   ⑤ 390×844 + 触摸模拟：在描述上拖拽滚动 → 不触发跳过（仍在打字且文本继续增长）；
//   ⑤b 390×844 轻点空白处 → 跳过生效（真机 click 路径）。
//
// 「立刻全出」怎么判：不依赖页面里的完整原文（它在轮次数据里，不在 DOM）。
// 判据是「动作后光标消失 + 文本不再增长 + 文本与自然打字那次逐字相同（hash 一致）」。
// 每张卡的正文都从 round.description 来，所以同一个流程重放会得到同一张卡；
// 但选故事线那一轮是随机的，故基线里额外确认「两次独立重放的正文 hash 一致」，
// 不一致时把比对降级为「不再增长」并如实记录（不猜）。
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

async function waitLoad() {
    for (let i = 0; i < 120; i++) {
        const r = await send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
        if (r.result.value === 'complete') return;
        await sleep(100);
    }
}

/** 在页面里求值（返回 JSON 值） */
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

/** 轻点（触屏档）：真机上 click 就是 touchStart + touchEnd 同点 */
async function touchTap(x, y) {
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await sleep(40);
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(220);
}

// ---------------------------------------------------------------------------
// 页面侧探针：描述快照 / 空白点 / 是否还在打字
// ---------------------------------------------------------------------------

const SNAP = `(() => {
  const cur = document.querySelector('.rc-current');
  const textEl = cur ? cur.querySelector('.rc-desc') : document.querySelector('.intro-overlay .io-text-live');
  const cursor = textEl ? textEl.querySelector('.rc-cursor, .io-cursor') : null;
  const typed = textEl ? textEl.textContent.replace(/[▌]/g, '') : '';
  const scroller = document.querySelector('.rs-rounds');
  let hash = 0;
  for (const ch of typed) hash = (hash * 31 + ch.codePointAt(0)) | 0;
  return {
    hasCard: !!cur,
    isIntro: !!document.querySelector('.intro-overlay'),
    typed,
    hash,
    len: typed.length,
    typing: !!cursor,
    choices: cur ? cur.querySelectorAll('.rc-choice').length : 0,
    selected: cur ? cur.querySelectorAll('.rc-choice-selected').length : 0,
    confirm: cur ? !!cur.querySelector('.rc-confirm') : false,
    roundsScrollTop: scroller ? scroller.scrollTop : null,
    roundsScrollHeight: scroller ? scroller.scrollHeight : null,
    roundsClientHeight: scroller ? scroller.clientHeight : null,
    /** 容器当前真的能滚吗（内容高于可视区） */
    roundsScrollable: scroller ? scroller.scrollHeight > scroller.clientHeight + 1 : false,
    windowScrollY: window.scrollY,
    activeTag: document.activeElement ? document.activeElement.tagName : null,
  };
})()`;

const snap = () => evaluate(SNAP);

/**
 * 可滚动区域（.rs-rounds）里「不是卡片、也不是任何选项按钮」的空白处坐标。
 * 优先取容器底部（当前卡片下沿之外的 padding 空白），其次卡片内描述右侧的空白。
 * 取完必须过一遍 elementFromPoint：点到的是选项 / 按钮就继续往下找一个空白点 ——
 * 这一条同时保证了测试点的是「空白」，不会把选项误点掉。
 */
const BLANK_POINTS = `(() => {
  const scroller = document.querySelector('.rs-rounds');
  if (!scroller) return [];
  const sr = scroller.getBoundingClientRect();
  const cur = document.querySelector('.rc-current');
  const cr = cur ? cur.getBoundingClientRect() : null;
  const out = [];
  if (cr) {
    if (cr.bottom + 20 < sr.bottom) out.push({ x: Math.round(sr.left + sr.width / 2), y: Math.round(cr.bottom + 10), where: 'container-padding-below-card' });
    const d = document.querySelector('.rc-current .rc-desc');
    const dr = d ? d.getBoundingClientRect() : null;
    if (dr && dr.right + 16 < cr.right) out.push({ x: Math.round((dr.right + cr.right) / 2), y: Math.round(dr.top + dr.height / 2), where: 'card-blank-right-of-desc' });
    out.push({ x: Math.round(cr.left + cr.width / 2), y: Math.round(cr.top + 4), where: 'card-top-padding' });
  }
  out.push({ x: Math.round(sr.left + sr.width / 2), y: Math.round(sr.bottom - 10), where: 'container-bottom' });
  const blocked = (x, y) => {
    const el = document.elementFromPoint(x, y);
    if (!el) return true;
    return !!el.closest('button, a, input, textarea, select, .rc-choice, .rc-confirm');
  };
  return out.filter((p) => p.y > sr.top + 2 && p.y < sr.bottom - 2 && !blocked(p.x, p.y));
})()`;

/** 找一个「真空白」点（优先容器留白，失败则退回卡片内空白） */
async function blankPoint() {
    for (let k = 0; k < 6; k++) {
        const list = await evaluate(BLANK_POINTS);
        if (list.length) return list[0];
        await sleep(120);
    }
    return null;
}

/** 某个坐标上最顶层的元素（诊断用） */
async function topAt(x, y) {
    return evaluate(`(() => {
      const el = document.elementFromPoint(${x}, ${y});
      return el ? { tag: el.tagName, cls: String(el.className).slice(0, 60), overlays: document.querySelectorAll('.intro-overlay').length } : null;
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

/** 直接问 DOM：开场/章页遮罩在不在、是不是正在打字（不用 React 快照，换页那一帧快照会读旧值） */
const introPresent = () => evaluate(`!!document.querySelector('.intro-overlay')`);
const introTyping = () =>
    evaluate(
        `(() => { const el = document.querySelector('.intro-overlay'); return !!el && (el.classList.contains('intro-overlay-typing') || !!el.querySelector('.io-cursor')); })()`,
    );

/** 等界面稳定：同一份「遮罩数 / 当前卡 / 光标 / 选项数」串连续 3 次一致才认为换页结束 */
async function settle(stepMs = 150, maxSteps = 40) {
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

/** 从任意界面走到「正在打字的回合卡」（顺带把滚动容器复位） */
async function gotoTypingCard() {
    await send('Page.navigate', { url: `http://127.0.0.1:${opts.port}/roguelite` });
    await waitLoad();
    for (let k = 0; k < 60; k++) {
        if (await introPresent()) break;
        const s = await snap();
        if (s.hasCard) break;
        await sleep(150);
    }
    await sleep(400);
    for (let i = 0; i < 60; i++) {
        const s = await snap();
        if (s.hasCard && s.typing) {
            await evaluate(`(() => { const el = document.querySelector('.rs-rounds'); if (el) el.scrollTop = 0; })()`);
            await sleep(60);
            return await snap();
        }
        if (await introPresent()) {
            // 等这一页打完（直接读遮罩类名，避免抓到换页中间那一帧），再点「开始」
            for (let k = 0; k < 100; k++) {
                if (!(await introTyping())) break;
                await sleep(100);
            }
            const p = await pointOf('.io-enter', true);
            if (!p) throw new Error('开场页的「开始」按钮点不到');
            await mouseClick(p.x, p.y);
            // 点掉一页后可能立刻换成下一页遮罩：等 DOM 稳定再判断，否则会去点被遮罩盖住的选项
            await settle();
            continue;
        }
        // 无描述的纯选择轮（如「你从哪里来」）：选第一个 → 确认（这类轮没有光标，等不到打字）
        let p = await pointOf('.rc-confirm');
        if (!p) {
            // 选项列表可能有好几屏：先把候选滚进视野（与玩家操作一致）
            await evaluate(`(() => {
              const el = ['.rc-confirm', '.rc-current .rc-choice:not(.rc-choice-selected)', '.rc-current .rc-choice', '.rs-battle-continue']
                .map((x) => document.querySelector(x)).find(Boolean);
              if (el) el.scrollIntoView({ block: 'center' });
            })()`);
            await sleep(150);
            p =
                (await pointOf('.rc-confirm')) ||
                (await pointOf('.rc-current .rc-choice:not(.rc-choice-selected)')) ||
                (await pointOf('.rc-current .rc-choice')) ||
                (await pointOf('.rs-battle-continue'));
        }
        if (!p) throw new Error(`卡住了：既没有打字卡也没有可点选项 ${JSON.stringify(s)}`);
        await mouseClick(p.x, p.y);
        await settle();
    }
    throw new Error('走不到正在打字的回合卡');
}

// ---------------------------------------------------------------------------
// 基线：自然打完的全文（同一张卡的对照）
// ---------------------------------------------------------------------------

/**
 * 跑到正在打字的卡 → 等它自然打完 → 记下全文长度与 hash，再独立重放一次确认
 * 同一流程拿到的是同一张卡（选故事线那一轮是随机的）。返回 `same: false` 表示两次不同卡，
 * 调用方会降级判据并如实记录。
 */
/** 从页面拿「当前展示的正文原文」（当前卡或开场页）—— 诊断用 */
async function shownText() {
    return evaluate(`(() => {
      const d = document.querySelector('.rc-current .rc-desc');
      if (d) return d.textContent.replace(/[▌]/g, '');
      const live = document.querySelector('.intro-overlay .io-text-live');
      return live ? live.textContent.replace(/[▌]/g, '') : '';
    })()`);
}

async function baseline() {
    await gotoTypingCard();
    const a = await waitCardDone();
    const text = await shownText();
    await gotoTypingCard();
    const b = await waitCardDone();
    return { finalLen: a.len, choices: a.choices, hash: a.hash, text, same: a.hash === b.hash, otherLen: b.len, otherHash: b.hash, otherText: await shownText() };
}

// ---------------------------------------------------------------------------
// 桌面档 1280×800
// ---------------------------------------------------------------------------

await setViewport({ width: 1280, height: 800, mobile: false });

// 用固定种子的伪随机替掉 Math.random（**装在任何一次页面加载之前**）：
// 故事线抽取走 Math.random，不固定的话每次重放都换一条线（正文不同，基线没法对拍）。
// 这是测试侧的确定性注入，不改游戏代码；种子固定 → 每轮重放都是同一条线、同一张卡。
// 注意必须在**首次加载前**就装好：装晚了已经建好的 zustand store 会带着一条随机故事线活到后面。
const seedScript = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => {
      let s = 20260811;
      Math.random = () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
      };
    })();`,
});
// 第一次加载：写死 ui 配置（逐字打开）。之后所有重放都是整页加载（gotoTypingCard 用 Page.navigate），
// 种子脚本对每个新 document 都生效，所以新一轮的 store 又是同一条故事线。
await send('Page.navigate', { url: `http://127.0.0.1:${opts.port}/` });
await waitLoad();
await sleep(300);
await evaluate(`localStorage.setItem('bdgame-ui-config', JSON.stringify({ theme: 'dark', uiScale: 1, typewriter: true }))`);
// 种子验证：把「同一个 document 里两次同位置抽取」对拍一下（实现改了会立刻暴露）
const seedCheck = await evaluate(`(() => { const a = Math.random(); return { a, hasOwn: Object.prototype.hasOwnProperty.call(Math, 'random') }; })()`);
if (seedScript?.identifier) {
    // 保留脚本：每次整页加载都重新播种，重放才可比
    log(`种子脚本已装：${seedScript.identifier}`);
}
log(`种子自检：Math.random()=${seedCheck.a}（期望 0.0029）`);

const base = await baseline();
log(`基线：自然打完 len=${base.finalLen} 选项=${base.choices}，重放同一张卡=${base.same}（另一次 len=${base.otherLen}）`);
check('基线：自然打完能拿到全文，且两次重放是同一张卡（hash 一致）', base.finalLen > 10 && base.same, {
    finalLen: base.finalLen,
    choices: base.choices,
    same: base.same,
    otherLen: base.otherLen,
});

// ① 点击可滚动区域空白处
{
    const before = await gotoTypingCard();
    const p = await blankPoint();
    if (!p) throw new Error('找不到「可滚动区域里的空白处」');
    const topEl = await topAt(p.x, p.y);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SHOT_DIR, 'skip-typing-typing-1280.png'), Buffer.from(shot.data, 'base64'));
    const scrollBefore = before.roundsScrollTop;
    await mouseClick(p.x, p.y);
    const after = await snap();
    check(
        '① 打字中点击可滚动区域空白处 → 描述立刻全出（无需再等自然打完）',
        after.typing === false && after.len === base.finalLen && after.hash === base.hash && after.choices === base.choices && after.selected === 0,
        {
            point: p,
            topElement: topEl,
            beforeLen: before.len,
            afterLen: after.len,
            afterTyping: after.typing,
            choices: after.choices,
            hashMatches: after.hash === base.hash,
            scrollTop: [scrollBefore, after.roundsScrollTop],
        },
    );
    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SHOT_DIR, 'skip-typing-done-1280.png'), Buffer.from(shot2.data, 'base64'));

    // ④ 打完字之后再点击 / 再按 Enter：无副作用
    const beforeAgain = await snap();
    const pAgain = await blankPoint();
    await mouseClick(pAgain.x, pAgain.y);
    await pressEnter();
    await sleep(200);
    const afterAgain = await snap();
    check(
        '④ 打完字后再点击 / 再按 Enter → 无副作用（不重复跳过、不误触选项、位置不动）',
        afterAgain.typing === false &&
            afterAgain.len === base.finalLen &&
            afterAgain.hash === base.hash &&
            afterAgain.selected === 0 &&
            !afterAgain.confirm &&
            afterAgain.choices === base.choices &&
            afterAgain.roundsScrollTop === beforeAgain.roundsScrollTop,
        {
            len: afterAgain.len,
            selected: afterAgain.selected,
            confirm: afterAgain.confirm,
            choices: afterAgain.choices,
            scrollTop: [beforeAgain.roundsScrollTop, afterAgain.roundsScrollTop],
        },
    );

    // ④b 选项照旧可点（证明交互没被抢）：先滚进视野（跳过之后卡片变高，选项可能在折线以下）
    await evaluate(`(() => {
      const el = document.querySelector('.rc-current .rc-choice');
      if (el) el.scrollIntoView({ block: 'center' });
    })()`);
    await sleep(200);
    const beforePick = await snap();
    const pick = await pointOf('.rc-current .rc-choice');
    await mouseClick(pick.x, pick.y);
    await sleep(250);
    const afterPick = await snap();
    // 两种轮次都算「点击生效」：多选轮 → 选中态/确认按钮出现；单选项轮（本例的「继续」）→ 直接推进下一轮
    const advanced = !afterPick.hasCard || afterPick.typing || afterPick.choices !== beforePick.choices;
    check(
        '④b 选项的点击照旧生效（多选轮出选中态，单选项轮直接推进）',
        afterPick.selected > beforePick.selected || afterPick.confirm || advanced,
        {
            selected: [beforePick.selected, afterPick.selected],
            confirm: [beforePick.confirm, afterPick.confirm],
            choices: [beforePick.choices, afterPick.choices],
            advanced,
        },
    );
}

// ② Enter 跳过
{
    const before = await gotoTypingCard();
    await pressEnter();
    const after = await snap();
    check('② 打字中按 Enter → 立刻全出', after.typing === false && after.len === base.finalLen && after.hash === base.hash, {
        beforeLen: before.len,
        afterLen: after.len,
        afterTyping: after.typing,
        hashMatches: after.hash === base.hash,
        baseText: base.text,
        shownText: await shownText(),
    });
}

// ③ Space 跳过 + 不额外滚动
{
    const before = await gotoTypingCard();
    // 容器拉到顶：Space 的默认行为（向下滚一屏）若没被吃掉，scrollTop 会立刻变化
    await evaluate(`(() => { const s = document.querySelector('.rs-rounds'); s.scrollTop = 0; })()`);
    await sleep(80);
    const pre = await snap();
    await pressSpace();
    const after = await snap();
    check(
        '③ 打字中按 Space → 立刻全出，且没有额外滚动',
        after.typing === false &&
            after.len === base.finalLen &&
            after.hash === base.hash &&
            after.roundsScrollTop === pre.roundsScrollTop &&
            after.windowScrollY === pre.windowScrollY,
        {
            beforeLen: before.len,
            afterLen: after.len,
            roundsScrollTop: [pre.roundsScrollTop, after.roundsScrollTop],
            windowScrollY: [pre.windowScrollY, after.windowScrollY],
        },
    );
}

// ③b 对照：不在打字状态时按 Space，滚动容器照常下滚（证明 ③ 是 preventDefault 的功劳）。
// 前提是容器**真的能滚**（内容高于可视区）；不能滚时这条实验做不出来，如实记为「未适用」。
{
    await evaluate(`(() => { const s = document.querySelector('.rs-rounds'); s.scrollTop = 0; })()`);
    await sleep(80);
    const before2 = await snap();
    await pressSpace();
    await sleep(200);
    const after2 = await snap();
    const scrollable = before2.roundsScrollable;
    check(
        '③b 对照：不在打字时按 Space，滚动容器照常下滚（默认行为没被全局吃掉）',
        !scrollable || (before2.typing === false && after2.roundsScrollTop > before2.roundsScrollTop),
        {
            typing: before2.typing,
            scrollable,
            roundsScrollTop: [before2.roundsScrollTop, after2.roundsScrollTop],
            scroll: [before2.roundsScrollHeight, before2.roundsClientHeight],
            note: scrollable ? undefined : '本卡内容没有高于可视区，容器本来就滚不动，这条对照未适用',
        },
    );
}

// ---------------------------------------------------------------------------
// 触屏档 390×844：拖拽滚动不算「点击跳过」
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
    // 页面侧装一个只数点击的探针：拖拽之后它必须仍然是 0。
    // 这是「拖拽不会被当成跳过」的**机制级**证据 —— 跳过只由 click 触发，
    // 没有 click 就不可能跳过（比「文字还在打字」更硬：文字短时可能在拖动期间自然打完）。
    await evaluate(`(() => {
      window.__dragProbe = { clicks: 0, downs: 0, ups: 0 };
      const s = document.querySelector('.rs-rounds');
      window.__dragProbeCleanup = () => {
        s.removeEventListener('click', window.__dragProbe.onClick, true);
        s.removeEventListener('pointerdown', window.__dragProbe.onDown, true);
        s.removeEventListener('pointerup', window.__dragProbe.onUp, true);
      };
      window.__dragProbe.onClick = () => { window.__dragProbe.clicks += 1; };
      window.__dragProbe.onDown = () => { window.__dragProbe.downs += 1; };
      window.__dragProbe.onUp = () => { window.__dragProbe.ups += 1; };
      s.addEventListener('click', window.__dragProbe.onClick, true);
      s.addEventListener('pointerdown', window.__dragProbe.onDown, true);
      s.addEventListener('pointerup', window.__dragProbe.onUp, true);
    })()`);
    // 真实触摸：按下 → 分步上移（拖动滚动）→ 抬起（节奏贴近真机快速滑动）
    const dragT0 = Date.now();
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: anchor.x, y: anchor.y }] });
    for (let i = 1; i <= 7; i++) {
        await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: anchor.x + i, y: anchor.y - i * 14 }] });
        await sleep(16);
    }
    await sleep(60); // 手指按住停顿，进一步排除「轻点」判定
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(150);
    const after = await snap();
    const probe = await evaluate('({ ...window.__dragProbe, cleanup: (window.__dragProbeCleanup(), true) })');
    check(
        '⑤ 390×844 触屏：拖拽没有被当成跳过（拖动期间没有产生任何 click）',
        probe.clicks === 0 && after.typing === true && after.selected === 0 && after.len >= start.len,
        {
            probe: { clicks: probe.clicks, downs: probe.downs, ups: probe.ups },
            dragMs: Date.now() - dragT0,
            startLen: start.len,
            afterLen: after.len,
            startTyping: start.typing,
            afterTyping: after.typing,
            selected: after.selected,
            drag: anchor,
        },
    );
    // 拖拽滚动本身（前提：容器内容高于可视区）。这一条是「拖动确实发生了」的旁证，
    // 不是「没被当成跳过」的判据 —— 后者由上面那条（仍在打字）保证。
    check(
        '⑤c 390×844 触屏：拖拽确实滚动了滚动容器（前提成立时）',
        !start.roundsScrollable || after.roundsScrollTop > start.roundsScrollTop,
        {
            scrollable: start.roundsScrollable,
            scrollTop: [start.roundsScrollTop, after.roundsScrollTop],
            scroll: [start.roundsScrollHeight, start.roundsClientHeight],
            note: start.roundsScrollable ? undefined : '本卡内容没有高于可视区，拖不出滚动量（跳过判定由 ⑤ 负责）',
        },
    );

    const shotTyping = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SHOT_DIR, 'skip-typing-typing-390.png'), Buffer.from(shotTyping.data, 'base64'));

    // ⑤b 轻点空白处 → 跳过（真机 click 路径）
    const blank390 = await blankPoint();
    if (!blank390) throw new Error('390 档找不到空白点');
    await evaluate(`(() => { const s = document.querySelector('.rs-rounds'); s.scrollTop = 0; })()`);
    await sleep(80);
    const topEl = await topAt(blank390.x, blank390.y);
    await touchTap(blank390.x, blank390.y);
    const afterTap = await snap();
    check(
        '⑤b 390×844 触屏：轻点空白处 → 跳过生效（真机 click 路径），且文本与基线逐字相同',
        afterTap.typing === false && afterTap.len === base.finalLen && afterTap.hash === base.hash,
        {
            point: blank390,
            topElement: topEl,
            len: afterTap.len,
            typing: afterTap.typing,
            expected: base.finalLen,
            hashMatches: afterTap.hash === base.hash,
        },
    );
    const shotDone = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(SHOT_DIR, 'skip-typing-done-390.png'), Buffer.from(shotDone.data, 'base64'));
    if (process.env.SKIP_DEBUG) log(`⑤ 起始快照 ${JSON.stringify(before)}`);
}

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------

fs.writeFileSync(
    path.join(SHOT_DIR, 'skip-typing-report.json'),
    JSON.stringify({ results, failures, baseline: base }, null, 1),
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
