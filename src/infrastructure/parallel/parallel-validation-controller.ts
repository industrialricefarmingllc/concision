import { availableParallelism } from "node:os"
import { boundedRepeatWarnings } from "../../application/validation/bounded-repeat-warnings"
import { parseTemplates as parseTemplateFiles } from "../../application/validation/parse-templates"
import type { ParsedTemplates } from "../../application/validation/parse-templates"
import type { TextFile, ValidationReport } from "../../application/validation/types"
import { countTypeScriptVariables } from "../language/typescript"
import { parseTemplate } from "../parser/parse-template"
import { WorkerPool } from "./worker-pool"
import type { ValidationWorkerInit, ValidationWorkerJob, ValidationWorkerResult } from "./validation-worker-protocol"

type ParallelValidationOptions = {
  workers?: number
  maxWorkers?: number
  chunkSize?: number
}

export class ParallelValidationController {
  constructor(private readonly options: ParallelValidationOptions = {}) {}

  async parseTemplates(files: TextFile[]): Promise<ParsedTemplates> {
    return parseTemplateFiles(files, parseTemplate)
  }

  async validateFilePaths(parsed: ParsedTemplates, root: string, paths: string[]): Promise<ValidationReport> {
    const jobs = this.chunks(paths).map((paths) => ({ kind: "validate-file-paths", root, paths }) satisfies ValidationWorkerJob)
    const results = await this.runJobs(jobs, { kind: "init", templates: parsed.templates })
    const validations = results.flatMap((result) => result.results)

    return {
      valid: parsed.errors.length === 0 && validations.every((file) => file.valid),
      files: validations,
      errors: parsed.errors,
      warnings: boundedRepeatWarnings(await this.readFiles(root, paths), parsed.templates, countTypeScriptVariables),
    }
  }

  private async readFiles(root: string, paths: string[]): Promise<TextFile[]> {
    return Promise.all(paths.map(async (path) => ({ path, content: await Bun.file(`${root}/${path.replace(/^\//, "")}`).text() })))
  }

  private async runJobs(jobs: ValidationWorkerJob[], initMessage: ValidationWorkerInit): Promise<ValidationWorkerResult[]> {
    if (jobs.length === 0) return []

    const pool = new WorkerPool<ValidationWorkerJob, ValidationWorkerResult>(
      new URL("./validation-worker.ts", import.meta.url),
      this.workerCount(jobs.length),
      { initMessage },
    )

    try {
      return await Promise.all(jobs.map((job) => pool.run(job)))
    } finally {
      pool.close()
    }
  }

  private workerCount(jobCount: number): number {
    const available = Math.min(availableParallelism(), this.options.maxWorkers ?? 8)
    return Math.max(1, Math.min(jobCount, this.options.workers ?? available))
  }

  private chunks(paths: string[]): string[][] {
    if (paths.length === 0) return []

    const workerCount = this.workerCount(paths.length)
    const chunkSize = this.options.chunkSize ?? Math.max(1, Math.ceil(paths.length / (workerCount * 4)))
    const chunks: string[][] = []

    for (let index = 0; index < paths.length; index += chunkSize) {
      chunks.push(paths.slice(index, index + chunkSize))
    }

    return chunks
  }
}
