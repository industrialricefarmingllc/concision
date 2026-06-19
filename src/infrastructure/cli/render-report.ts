import type { ValidationReport } from "../../application/validation/types"

export function renderReport(report: ValidationReport): string {
  return [...report.files.map(renderFile), ...report.warnings.map(renderWarning)].join("\n")
}

function renderFile(file: ValidationReport["files"][number]): string {
  if (file.valid) return `ok ${file.path}`
  return `fail ${file.path}: ${file.errors.join(", ")}`
}

function renderWarning(warning: string): string {
  return `warn ${warning}`
}
