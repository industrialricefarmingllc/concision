import { validateOneFile } from "../../application/validation/validate-one-file"
import { templatesForFile } from "../../application/validation/templates-for-file"
import type { TextFile } from "../../application/validation/types"
import type { TemplateDocument } from "../../domain/language/types"
import { countTypeScriptVariables } from "../language/typescript"
import type { ValidationWorkerJob, ValidationWorkerMessage, ValidationWorkerRequest, ValidationWorkerResponse, ValidationWorkerResult } from "./validation-worker-protocol"

declare var self: Worker

let templates: TemplateDocument[] = []

self.onmessage = async (event: MessageEvent<ValidationWorkerMessage>) => {
  const message = event.data

  if ("kind" in message && message.kind === "init") {
    templates = message.templates
    return
  }

  const { id, job } = message as ValidationWorkerRequest

  try {
    postMessage({ id, ok: true, result: await runJob(job) } satisfies ValidationWorkerResponse)
  } catch (error) {
    postMessage({ id, ok: false, error: errorMessage(error) } satisfies ValidationWorkerResponse)
  }
}

async function runJob(job: ValidationWorkerJob): Promise<ValidationWorkerResult> {
  const results = []

  for (const path of job.paths) {
    const file = await readTextFile(job.root, path)
    results.push(validateOneFile(file, templatesForFile(file.path, templates), countTypeScriptVariables))
  }

  return {
    kind: "validate-file-paths",
    results,
  }
}

async function readTextFile(root: string, path: string): Promise<TextFile> {
  return { path, content: await Bun.file(`${root}/${path.replace(/^\//, "")}`).text() }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}
