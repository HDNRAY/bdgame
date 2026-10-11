import type { Plugin, Rollup } from 'vite'
import subsetFont from 'subset-font'
import * as fontverter from 'fontverter'
import { Blob as HbBlob, Face } from 'harfbuzzjs'

/**
 * 构建期字体子集化（零手动步骤）
 * ============================================================================
 *
 * 做什么：`vite build` 的 `generateBundle` 阶段，先把**产物里出现的字符**收集起来，
 * 再用它把 `src/assets/fonts/` 的完整字体裁成子集，直接替换掉产物里的字体资源。
 *
 * 为什么这么做：
 * - 像素中文字体是全集字体（四个字面合计 2.03 MB），而本作的文案全部来自仓库 —— 子集后
 *   只要 250 kB 级。首屏那两份 12px 从 1.27 MB 降到 130 kB 级。
 * - 「字符集 = 实际产出的代码」意味着**不需要任何人维护清单**：新文案进了产物，就自动进子集；
 *   不存在"忘了重新生成"。
 * - 用 npm 生态的 HarfBuzz WASM（`subset-font`），**不需要 Python**：`npm install` 之后
 *   `npm run build` 直接可用。
 *
 * 三层结果：
 * 1. 产物里的 `*.woff2` 被替换成子集（文件名/引用不变，只有字节变小）；
 * 2. **构建期校验**：产出代码里的每个字符、只要源字体有字形，就必须也出现在子集里 ——
 *    不满足直接让构建失败（防止子集器悄悄漏字，玩家看到豆腐块）；
 * 3. 源字体本来就没有的字符（例如 `炁`、emoji）→ 只警告，不当失败：那是**既有**的字体覆盖
 *    问题（改子集化之前就在），不该让构建挂掉，但值得每次都提醒出来。
 *
 * 源字体（完整版）留在仓库里，只有产物里是子集；`vite dev` 不做子集化（本地 2 MB 无所谓），
 * 所以要看真实体积请跑 `npm run build` / `npm run preview`。
 */

/** 参与「字符收集」的产物扩展名 —— 只有这些会渲染出文字 */
const TEXT_ASSET = /\.(js|css|html|webmanifest|json)$/

export interface FontSubsetPluginOptions {
    /** 源字体目录（相对仓库根） */
    fontDir?: string
    /** 关闭覆盖率校验（只给变异验证用，正常构建不要开） */
    disableCoverageCheck?: boolean
}

/** 控制字符不进子集字符表（没有字形） */
function isControl(ch: string): boolean {
    const c = ch.codePointAt(0) ?? 0
    return c < 0x20 || c === 0x7f
}

/**
 * 类型守卫：bundle 的条目是 `OutputAsset | OutputChunk` 的判别联合，只有资源（asset）
 * 有 `source`，代码块（chunk）没有。读 `source` 之前必须先窄化 —— 直接读会 TS2339，
 * 而 `as` 断言会把这类错误藏起来（构建期靠 `tsc -b` 才查得到这个文件，见 AGENTS.md）。
 */
function isOutputAsset(entry: Rollup.OutputAsset | Rollup.OutputChunk): entry is Rollup.OutputAsset {
    return entry.type === 'asset'
}

/** 资源字节数：`source` 的类型是 `string | Uint8Array`（字体产物一定是后者，字符串按 utf8 计） */
function assetBytes(asset: Rollup.OutputAsset): number {
    return typeof asset.source === 'string' ? Buffer.byteLength(asset.source) : asset.source.byteLength
}

/** 收集产物里出现的全部字符 */
export function collectBundleCharset(sources: Buffer[]): string {
    const set = new Set<string>()
    for (const buf of sources) for (const ch of buf.toString('utf8')) if (!isControl(ch)) set.add(ch)
    return [...set].sort().join('')
}

/**
 * 读字体里真正有的码位。
 * HarfBuzz 读不了 woff2（要先用 `fontverter` 解成 sfnt），所以这里先转格式再问 HarfBuzz。
 */
export async function collectUnicodes(buffer: Buffer): Promise<Set<number>> {
    const sfnt = fontverter.detectFormat(buffer) === 'sfnt' ? buffer : await fontverter.convert(buffer, 'truetype')
    const face = new Face(new HbBlob(new Uint8Array(sfnt)))
    return new Set(face.collectUnicodes())
}

export function fontSubsetPlugin(options: FontSubsetPluginOptions = {}): Plugin {
    const fontDir = options.fontDir ?? 'src/assets/fonts'
    return {
        name: 'dantiao:font-subset',
        apply: 'build',
        // 排在 vite-plugin-pwa 之后：Workbox 在 closeBundle 里按磁盘上的产物算 precache 清单，
        // 这里替换的是 generateBundle 里的资源字节，两边不冲突（清单会在替换之后生成）。
        enforce: 'post',
        async generateBundle(_outputOptions, bundle) {
            const startedAt = Date.now()
            const textAssets = Object.entries(bundle).filter(
                (entry): entry is [string, Rollup.OutputAsset] =>
                    isOutputAsset(entry[1]) && TEXT_ASSET.test(entry[0]),
            )
            const sources = textAssets.map(([, asset]) => Buffer.from(asset.source))
            const charset = collectBundleCharset(sources)
            const chars = [...charset]

            const fontAssets = Object.entries(bundle).filter(
                (entry): entry is [string, Rollup.OutputAsset] =>
                    isOutputAsset(entry[1]) && entry[0].endsWith('.woff2'),
            )
            if (!fontAssets.length) {
                this.warn(`产物里没有 .woff2（检查 ${fontDir} 是否还被 CSS 引用）`)
                return
            }

            const lines: string[] = []
            const missingInSource = new Set<string>()

            for (const [fileName, asset] of fontAssets) {
                const original = Buffer.from(asset.source)
                const subset = await subsetFont(original, charset, { targetFormat: 'woff2' })
                asset.source = subset

                const srcUnicodes = await collectUnicodes(original)
                const subsetUnicodes = await collectUnicodes(Buffer.from(subset))
                // 源字体本来就没有的字形（既有覆盖问题）→ 只警告
                const lostBySubsetter: string[] = []
                for (const ch of chars) {
                    const cp = ch.codePointAt(0) ?? 0
                    if (!srcUnicodes.has(cp)) {
                        missingInSource.add(ch)
                        continue
                    }
                    if (!subsetUnicodes.has(cp)) lostBySubsetter.push(ch)
                }
                if (lostBySubsetter.length && !options.disableCoverageCheck) {
                    // 同时打到 stderr：Vite 报错时，其它插件的 closeBundle 异常有可能把它盖掉，
                    // 缺字清单必须让开发者一定能看见。
                    console.error(
                        `\n[font-subset] ${fileName} 子集缺字：${lostBySubsetter.join('')}\n` +
                            '  这些字源字体里有、子集里没有，渲染出来是豆腐块。\n',
                    )
                    this.error(
                        `${fileName}: 子集丢了 ${lostBySubsetter.length} 个源字体里明明有的字：${lostBySubsetter.join('')}\n` +
                            '这些字会渲染成豆腐块。请检查 subset-font 的调用（字符表来自产物文本）。',
                    )
                }
                lines.push(
                    `  ${fileName.replace(/^assets\//, '').slice(0, 46).padEnd(46)} ${String(original.length).padStart(7)} → ${String(subset.length).padStart(6)} B`,
                )
            }

            const emitted = fontAssets.reduce((s, [, a]) => s + assetBytes(a), 0)
            this.warn(
                `[font-subset] 字符 ${chars.length} 个（来自 ${textAssets.length} 份产物文本）→ 字体 ${emitted} B\n` +
                    lines.join('\n') +
                    `\n  用时 ${Date.now() - startedAt} ms`,
            )
            if (missingInSource.size) {
                const list = [...missingInSource].sort()
                this.warn(
                    `[font-subset] 以下 ${list.length} 个字符**源字体里就没有字形**，会落到系统兜底字体（既有问题，非子集化引起）：${list.join('')}`,
                )
            }
        },
    }
}
