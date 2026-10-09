#!/usr/bin/env node
/**
 * scss-triples.mjs —— 配色改动回归闸门：编译后摊平 (选择器, 媒体, 声明体) 三元组对拍
 *
 * 背景与口径见 docs/ui-color-system.md「验证口径汇总」。要点：
 * - 配色改动**必然**改变像素，所以截图 md5 不能当通过条件；
 * - 可以当通过条件的是「结构不变」：把每个 .scss 编译成 CSS 之后摊平成三元组集合，
 *   两次状态之间**集合必须逐字相同**，只有声明体的**值**允许变化，
 *   且值发生变化的声明必须全部是颜色相关声明（否则判定回归）。
 *
 * 用法（在仓库根跑）：
 *   node scripts/scss-triples.mjs --baseline <目录或 git-ref> [--current <目录>] [--json <文件>]
 *
 *   --baseline  git ref（如 HEAD、HEAD~1）或已有的 CSS 树目录；默认 HEAD
 *   --current   同样接受 git ref 或目录；默认为工作区（src/**\/*.scss 现盘内容）
 *   --json      额外把结果写成 JSON
 *
 * 例：
 *   node scripts/scss-triples.mjs                       # HEAD → 工作区
 *   node scripts/scss-triples.mjs --baseline /tmp/before --current /tmp/after
 *
 * 退出码：0 = 通过（三元组集合一致，且变化只落在颜色声明上）；1 = 回归；2 = 用法/环境错误。
 *
 * 依赖：只依赖仓库已有的 sass（devDependency）。零新增依赖。
 * 解析：不引入 postcss —— 直接解析 sass 的 expanded 输出（每个声明独占一行），约 60 行。
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// 参数
// ---------------------------------------------------------------------------

function parseArgs(argv) {
    const out = { baseline: 'HEAD', current: null, json: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--baseline') out.baseline = argv[++i];
        else if (a === '--current') out.current = argv[++i];
        else if (a === '--json') out.json = argv[++i];
        else if (a === '--help' || a === '-h') out.help = true;
        else throw new Error(`未知参数：${a}`);
    }
    return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
    process.exit(0);
}

// ---------------------------------------------------------------------------
// 取源：git ref 或目录
// ---------------------------------------------------------------------------

function isGitRef(spec) {
    try {
        execFileSync('git', ['rev-parse', '--verify', '--quiet', `${spec}^{commit}`], {
            cwd: ROOT,
            stdio: 'pipe',
        });
        return true;
    } catch {
        return false;
    }
}

/** 把一棵源码树取到临时目录，返回根目录。目录直接返回自身。 */
function materialize(spec, label) {
    if (spec === null) return ROOT;
    if (fs.existsSync(spec) && fs.statSync(spec).isDirectory()) return path.resolve(spec);
    if (!isGitRef(spec)) throw new Error(`${label}：既不是目录也不是 git ref —— ${spec}`);
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), `scss-triples-${label}-`));
    // git archive 只含已跟踪文件，正合适：新建的未跟踪文件不属于基线
    const tar = execFileSync('git', ['archive', '--format=tar', spec], {
        cwd: ROOT,
        maxBuffer: 1 << 28,
    });
    fs.writeFileSync(path.join(dest, 'tree.tar'), tar);
    execFileSync('tar', ['-xf', 'tree.tar'], { cwd: dest });
    fs.rmSync(path.join(dest, 'tree.tar'));
    return dest;
}

function collectScss(dir) {
    const out = [];
    const walk = (d) => {
        for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, ent.name);
            if (ent.isDirectory()) {
                if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
                walk(p);
            } else if (ent.name.endsWith('.scss')) {
                out.push(p);
            }
        }
    };
    walk(dir);
    return out.sort();
}

// ---------------------------------------------------------------------------
// 解析：sass expanded 输出 → 三元组 map
// ---------------------------------------------------------------------------

/** 值归一化：折叠空白（只影响排版，不影响语义）。 */
const normValue = (v) => v.replace(/\s+/g, ' ').trim();

const SELECTOR_SPLIT = /\s*,\s*/;
/** 媒体块在块栈上的哨兵（选择器为空，但要能被无歧义识别） */
const MEDIA_MARK = Symbol('media');

/**
 * 极简 CSS 解析器（输入是 sass expanded 输出，缩进与分号规则化）。
 * 返回 Map<key, { selector, media, props: Map<prop, value> }>。
 * 同一条选择器在同一媒体下出现多次时取并集（后者覆盖同名属性）。
 */
function parseCss(css, file) {
    const triples = new Map();
    const stack = []; // 每层块的选择器前缀（媒体块为 MEDIA_MARK）
    const mediaStack = []; // 媒体条件栈
    let buf = '';
    const currentMedia = () => mediaStack.filter(Boolean).join(' && ');
    const currentSelector = () => {
        const parts = stack.filter((s) => typeof s === 'string' && s);
        return parts.length ? parts.join(' ') : ':root';
    };

    const flushDecl = () => {
        const text = buf.trim();
        buf = '';
        if (!text) return;
        const ci = text.indexOf(':');
        if (ci < 0) return; // 忽略 @charset / @import 之类的无冒号条目
        const prop = text.slice(0, ci).trim();
        const value = normValue(text.slice(ci + 1));
        const media = currentMedia();
        const selector = currentSelector();
        const key = `${media}\u0000${selector}\u0000${prop}`;
        let t = triples.get(key);
        if (!t) {
            t = { selector, media, props: new Map() };
            triples.set(key, t);
        }
        t.props.set(prop, value);
    };

    let i = 0;
    while (i < css.length) {
        const ch = css[i];
        if (ch === '/' && css[i + 1] === '*') {
            const end = css.indexOf('*/', i + 2);
            i = end < 0 ? css.length : end + 2;
            continue;
        }
        if (ch === '{') {
            const header = buf.trim();
            buf = '';
            if (header.startsWith('@media')) {
                mediaStack.push(header.slice('@media'.length).trim());
                stack.push(MEDIA_MARK);
            } else if (header.startsWith('@')) {
                // @supports / @keyframes 等：当作普通块，选择器用 header 本身
                stack.push(header);
            } else {
                stack.push(header.split(SELECTOR_SPLIT).join(', '));
            }
            i++;
            continue;
        }
        if (ch === '}') {
            flushDecl(); // 块内最后一个声明可能没有分号
            // 与 push 的顺序镜像：媒体块需要弹出媒体栈
            if (stack.pop() === MEDIA_MARK) mediaStack.pop();
            i++;
            continue;
        }
        if (ch === ';') {
            flushDecl();
            i++;
            continue;
        }
        buf += ch;
        i++;
    }
    flushDecl();

    // 键去掉 prop 维度：外面要比较的是「(选择器, 媒体, 声明体)」
    const out = new Map();
    for (const t of triples.values()) {
        const key = `${t.media}\u0000${t.selector}`;
        let agg = out.get(key);
        if (!agg) {
            agg = { selector: t.selector, media: t.media, props: new Map() };
            out.set(key, agg);
        }
        for (const [k, v] of t.props) agg.props.set(k, v);
    }
    for (const agg of out.values()) agg.file = file;
    return out;
}

// ---------------------------------------------------------------------------
// 颜色声明判定
// ---------------------------------------------------------------------------

/**
 * 颜色相关 = 允许值变化的声明。除这些以外的任何值变化都算回归。
 * 自定义属性按前缀判定：--color-* / --scrollbar-* / --shadow-* 是颜色与阴影；
 * --section-accent 由 TS 内联传入语义色，同样属于颜色面。
 */
const COLOR_PROPS = new Set([
    'color',
    'background',
    'background-color',
    'background-image',
    'border',
    'border-color',
    'border-top',
    'border-right',
    'border-bottom',
    'border-left',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'outline',
    'outline-color',
    'box-shadow',
    'text-shadow',
    'fill',
    'stroke',
    'caret-color',
    'accent-color',
    'text-decoration-color',
    'column-rule-color',
    'scrollbar-color',
    '-webkit-text-stroke-color',
]);

function isColorDecl(prop) {
    if (prop.startsWith('--')) {
        return /^--(color|scrollbar|shadow|section-accent)/.test(prop);
    }
    return COLOR_PROPS.has(prop);
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

async function compileTree(root) {
    const sass = await import('sass');
    const files = collectScss(root);
    if (!files.length) throw new Error(`没有找到任何 .scss：${root}`);
    const all = new Map();
    const failures = [];
    for (const f of files) {
        const rel = path.relative(root, f).split(path.sep).join('/');
        const source = fs.readFileSync(f, 'utf8');
        let css;
        try {
            css = sass.compileString(source, {
                style: 'expanded',
                syntax: 'scss',
                loadPaths: [path.dirname(f)],
                silenceDeprecations: ['import', 'global-builtin', 'color-functions'],
            }).css;
        } catch (err) {
            failures.push(`${rel}: ${err.message.split('\n')[0]}`);
            continue;
        }
        for (const [key, t] of parseCss(css, rel)) {
            const scoped = `${rel}\u0001${key}`;
            all.set(scoped, t);
        }
    }
    return { all, failures, fileCount: files.length };
}

function fmtTriple(t) {
    const props = [...t.props.entries()]
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ');
    return `${t.file ?? '?'} | ${t.media ? `@media ${t.media}` : '(root)'} | ${t.selector} | { ${props} }`;
}

function main() {
    const baselineRoot = materialize(args.baseline, 'baseline');
    const currentRoot = materialize(args.current, 'current');

    return Promise.all([compileTree(baselineRoot), compileTree(currentRoot)]).then(
        ([base, curr]) => {
            const report = {
                baseline: `${args.baseline} (${base.fileCount} 文件)`,
                current: `${args.current ?? 'workspace'} (${curr.fileCount} 文件)`,
                parseFailures: [...base.failures, ...curr.failures],
                counts: {
                    base: base.all.size,
                    current: curr.all.size,
                },
                removed: [],
                added: [],
                changed: [],
                valueOnlyColor: 0,
                violations: [],
            };

            // 文件级：先按「文件 + 选择器 + 媒体」定位（baseline 独有的文件只在 removed 里体现）
            for (const [key, b] of base.all) {
                const c = curr.all.get(key);
                if (!c) {
                    report.removed.push(fmtTriple(b));
                    continue;
                }
                const props = new Set([...b.props.keys(), ...c.props.keys()]);
                const diffs = [];
                for (const p of props) {
                    const bv = b.props.get(p);
                    const cv = c.props.get(p);
                    if (bv !== cv) diffs.push({ prop: p, from: bv, to: cv });
                }
                if (!diffs.length) continue;
                const nonColor = diffs.filter((d) => !isColorDecl(d.prop));
                report.changed.push({ selector: b.selector, media: b.media, file: b.file, diffs });
                if (nonColor.length) {
                    report.violations.push({
                        file: b.file,
                        selector: b.selector,
                        media: b.media,
                        diffs: nonColor,
                    });
                } else {
                    report.valueOnlyColor++;
                }
            }
            for (const [key, c] of curr.all) {
                if (!base.all.has(key)) report.added.push(fmtTriple(c));
            }

            const pass =
                !report.removed.length &&
                !report.added.length &&
                !report.violations.length &&
                !report.parseFailures.length;

            console.log('== scss 摊平三元组对拍 ==');
            console.log(`基线：${report.baseline}`);
            console.log(`当前：${report.current}`);
            console.log(`三元组数：(选择器, 媒体) 对 —— 基线 ${report.counts.base} / 当前 ${report.counts.current}`);
            console.log(`消失的三元组：${report.removed.length}`);
            console.log(`新增的三元组：${report.added.length}`);
            console.log(
                `声明体有变化的三元组：${report.changed.length}` +
                    `（其中仅颜色声明变化 ${report.valueOnlyColor}，含非颜色声明变化 ${report.violations.length}）`,
            );
            for (const v of report.removed.slice(0, 40)) console.log(`  [消失] ${v}`);
            for (const v of report.added.slice(0, 40)) console.log(`  [新增] ${v}`);
            for (const v of report.violations.slice(0, 40)) {
                const d = v.diffs.map((x) => `${x.prop}: ${x.from} → ${x.to}`).join('; ');
                console.log(`  [非颜色变化] ${v.file} | ${v.media ? `@media ${v.media}` : '(root)'} | ${v.selector} | ${d}`);
            }
            if (report.parseFailures.length) {
                console.log('编译失败：');
                for (const f of report.parseFailures) console.log(`  ${f}`);
            }
            console.log(pass ? '结果：通过（三元组集合一致，变化只在颜色声明）' : '结果：回归');

            if (args.json) {
                fs.writeFileSync(args.json, JSON.stringify({ pass, ...report }, null, 2));
                console.log(`JSON 已写入 ${args.json}`);
            }
            process.exit(pass ? 0 : 1);
        },
    );
}

main().catch((err) => {
    console.error(`错误：${err.message}`);
    process.exit(2);
});
