export namespace Storage {
    export function getItem(key: string) {
        const item = localStorage.getItem(key)

        if (!item) return undefined

        let result
        try {
            result = JSON.parse(item)
        } catch (e) {
            console.error(e)
        }
        return result
    }

    export function setItem(key: string, item: Object) {
        try {
            const s = JSON.stringify(item)
            localStorage.setItem(key, s)
        } catch (e) {
            console.error(e)
        }
    }
}
