export type WorkerRequest<TJob> = {
  id: number
  job: TJob
}

export type WorkerResponse<TResult> = { id: number; ok: true; result: TResult } | { id: number; ok: false; error: string }

type WorkerPoolOptions = {
  initMessage?: unknown
}

type QueuedJob<TJob, TResult> = {
  request: WorkerRequest<TJob>
  resolve: (result: TResult) => void
  reject: (error: Error) => void
}

type PoolWorker<TJob, TResult> = {
  worker: Worker
  active: QueuedJob<TJob, TResult> | null
}

export class WorkerPool<TJob, TResult> {
  private nextId = 1
  private closed = false
  private readonly queue: Array<QueuedJob<TJob, TResult>> = []
  private readonly workers: Array<PoolWorker<TJob, TResult>>

  constructor(workerUrl: URL | string, size: number, options: WorkerPoolOptions = {}) {
    this.workers = Array.from({ length: Math.max(1, size) }, () => this.createWorker(workerUrl, options.initMessage))
  }

  run(job: TJob): Promise<TResult> {
    if (this.closed) return Promise.reject(new Error("Worker pool is closed."))

    return new Promise((resolve, reject) => {
      this.queue.push({ request: { id: this.nextId++, job }, resolve, reject })
      this.drain()
    })
  }

  close(): void {
    this.closed = true
    const pending = [...this.queue]
    this.queue.length = 0
    pending.forEach((job) => job.reject(new Error("Worker pool closed before the job started.")))
    this.workers.forEach(({ worker }) => worker.terminate())
  }

  private createWorker(workerUrl: URL | string, initMessage: unknown): PoolWorker<TJob, TResult> {
    const poolWorker: PoolWorker<TJob, TResult> = { worker: new Worker(workerUrl), active: null }

    poolWorker.worker.onmessage = (event: MessageEvent<WorkerResponse<TResult>>) => {
      const active = poolWorker.active
      poolWorker.active = null
      if (!active) return

      const response = event.data
      if (response.id !== active.request.id) {
        active.reject(new Error(`Worker response ${response.id} did not match active job ${active.request.id}.`))
        this.fail(new Error("Worker returned a response for the wrong job."))
      } else if (response.ok) {
        active.resolve(response.result)
      } else {
        active.reject(new Error(response.error))
      }

      this.drain()
    }

    poolWorker.worker.onerror = (event) => {
      const active = poolWorker.active
      poolWorker.active = null
      if (active) active.reject(new Error(errorMessage(event)))
      this.fail(new Error("Worker failed while processing a job."))
    }

    if (initMessage !== undefined) poolWorker.worker.postMessage(initMessage)

    return poolWorker
  }

  private drain(): void {
    if (this.closed) return

    for (const poolWorker of this.workers) {
      if (poolWorker.active) continue

      const next = this.queue.shift()
      if (!next) return

      poolWorker.active = next
      poolWorker.worker.postMessage(next.request)
    }
  }

  private fail(error: Error): void {
    this.closed = true
    const active = this.workers.flatMap((poolWorker) => {
      const job = poolWorker.active
      poolWorker.active = null
      return job ? [job] : []
    })
    const pending = [...active, ...this.queue]
    this.queue.length = 0
    this.workers.forEach(({ worker }) => worker.terminate())
    pending.forEach((job) => job.reject(error))
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error && "message" in error) return String(error.message)
  return String(error)
}
