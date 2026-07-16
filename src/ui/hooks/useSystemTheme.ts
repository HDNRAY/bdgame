import { useState, useEffect } from 'react'

/**
 * 监听系统 prefer-color-scheme，返回当前系统主题
 */
export function useSystemTheme(): 'light' | 'dark' {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const [theme, setTheme] = useState<'light' | 'dark'>(mql.matches ? 'dark' : 'light')

    useEffect(() => {
        const handler = (e: MediaQueryListEvent) => {
            setTheme(e.matches ? 'dark' : 'light')
        }
        mql.addEventListener('change', handler)
        return () => mql.removeEventListener('change', handler)
    }, [mql])

    return theme
}
