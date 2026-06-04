/** buff key 格式：`actionId::characterId` */
export function encodeBuffKey(actionId: string, characterId: string): string {
    return `${actionId}::${characterId}`
}

/** 解析 buff key，返回 null 则格式无效 */
export function decodeBuffKey(key: string): { actionId: string; characterId: string } | null {
    const sepIdx = key.lastIndexOf('::')
    if (sepIdx === -1) return null
    return {
        actionId: key.slice(0, sepIdx),
        characterId: key.slice(sepIdx + 2),
    }
}

/** 生成唯一 appId，用于可叠层 buff 的独立层标识 */
export function genAppId(tMs: number): string {
    return `${tMs}_${Math.random().toString(36).slice(2, 6)}`
}
