// ════════════════════════════════════════
//  构筑试炼 · Web Worker
//  收一组任务（每个对手 n 场），逐项跑完一次性回传；进度由主线程按任务分片感知。
//  Vite module worker；引擎层无浏览器 API 依赖，可安全在 worker 运行。
// ════════════════════════════════════════
import { runSeries, type SeriesJob, type SeriesResult } from './sim-core'
import type { CharacterBuild } from '../../../../game/entities/character-build'

interface WorkerRequest {
    build: CharacterBuild
    jobs: SeriesJob[]
}

const ctx = self as unknown as {
    onmessage: ((ev: MessageEvent<WorkerRequest>) => void) | null
    postMessage: (msg: unknown) => void
}

ctx.onmessage = (ev: MessageEvent<WorkerRequest>) => {
    const { build, jobs } = ev.data
    const results: SeriesResult[] = jobs.map((job) => runSeries(build, job))
    ctx.postMessage(results)
}
