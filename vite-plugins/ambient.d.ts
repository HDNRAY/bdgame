/**
 * 两个子集化工具没有自带类型声明（都是 CJS 包），这里按实际用到的 API 补一份最小声明。
 * 只覆盖 `vite-plugins/font-subset.ts` 用到的那几个入口。
 */

declare module 'subset-font' {
    export interface SubsetFontOptions {
        /** 输出格式；产物要 woff2，校验时为了迁就 HarfBuzz 会转 truetype */
        targetFormat?: 'woff' | 'woff2' | 'truetype'
        variationAxes?: Record<string, number | [number, number]>
        preserveNameIds?: number[]
    }
    export default function subsetFont(font: Buffer, text: string, options?: SubsetFontOptions): Promise<Buffer>
}

declare module 'fontverter' {
    export type FontFormat = 'sfnt' | 'woff' | 'woff2'
    export function detectFormat(buffer: Buffer): FontFormat
    export function convert(buffer: Buffer, toFormat: FontFormat | 'truetype', fromFormat?: FontFormat): Promise<Buffer>
}
