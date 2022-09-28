import { useState, useRef, useCallback, useEffect } from 'react'

const useCountDown = (props: { interval?: number; duration: number }) => {
    const { interval = 50, duration } = props
    const [progress, setP] = useState(0)
    const pRef = useRef(0)

    const [running, setRunning] = useState(false)

    const run = useCallback(() => {
        if (pRef.current === 0) {
            pRef.current = 100
            setRunning(true)
        }
    }, [])
    useEffect(() => {
        let intervalId: number
        if (running) {
            intervalId = window.setInterval(() => {
                pRef.current = pRef.current - (interval / duration) * 100
                if (pRef.current <= 0) {
                    pRef.current = 0
                    setRunning(false)
                }
                setP(pRef.current)
            }, interval)
        }

        return () => {
            clearInterval(intervalId)
        }
    }, [duration, interval, running])

    return { progress, running, run }
}

export { useCountDown }
