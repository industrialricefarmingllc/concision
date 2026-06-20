import type { FileValidation } from "../../application/validation/types"
import type { TemplateDocument } from "../../domain/language/types"
import type { WorkerRequest, WorkerResponse } from "./worker-pool"

export type ValidationWorkerInit = {
  kind: "init"
  templates: TemplateDocument[]
}

export type ValidationWorkerJob = {
  kind: "validate-file-paths"
  root: string
  paths: string[]
}

export type ValidationWorkerResult = {
  kind: "validate-file-paths"
  results: FileValidation[]
}

export type ValidationWorkerRequest = WorkerRequest<ValidationWorkerJob>
export type ValidationWorkerResponse = WorkerResponse<ValidationWorkerResult>
export type ValidationWorkerMessage = ValidationWorkerInit | ValidationWorkerRequest
