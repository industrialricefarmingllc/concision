import type { ValidationReport } from "../../application/validation/types"
import { diagnosticHighlightEnd, diagnosticHighlightStart } from "../../domain/matching/diagnostic-highlight"

const ansi = {
  red: "\u001b[31m",
  green: "\u001b[32m",
  gray: "\u001b[90m",
  reset: "\u001b[0m",
}

export function renderReport(report: ValidationReport, options: { showAll?: boolean } = {}): string {
  return renderReportWithOptions(report, options)
}

export function renderReportWithOptions(report: ValidationReport, options: { showAll?: boolean }): string {
  const failed = report.files.filter((file) => !file.valid)
  const passed = report.files.length - failed.length
  const showAll = options.showAll ?? false
  const visibleFailed = showAll ? failed : failed.slice(-5)
  const omittedFailed = failed.length - visibleFailed.length
  const lines = [report.valid ? "Concision check passed" : "Concision check failed"]

  if (report.errors.length > 0) {
    lines.push("", "Template errors", ...report.errors.map((error) => styleWarning(error)))
  }

  if (failed.length > 0) {
    lines.push("", `Failed files (${visibleFailed.length}${showAll || omittedFailed === 0 ? "" : ` shown of ${failed.length}`})`)
    visibleFailed.forEach((file, index) => {
      lines.push(...renderFailedFile(file))
      if (index < visibleFailed.length - 1) lines.push("")
    })
    if (omittedFailed > 0) {
      lines.push("", `  Omitted ${omittedFailed} additional failure${omittedFailed === 1 ? "" : "s"}. Use --show-all to display all.`)
    }
  }

  if (report.warnings.length > 0) {
    lines.push("", `Warnings (${report.warnings.length})`, ...report.warnings.map((warning) => styleWarning(warning)))
  }

  lines.push("", `Summary: ${formatSummaryCount(passed, "passed", "green")}, ${formatSummaryCount(failed.length, "failed", "red")}, ${report.files.length} checked`)

  return lines.join("\n")
}

function renderFailedFile(file: ValidationReport["files"][number]): string[] {
  const path = file.sourceLine ? `${file.path}:${file.sourceLine}` : file.path
  return [`  ${color(path, "red")}`, ...file.errors.map((error) => styleDiagnostic(error, "gray", true))]
}

function styleWarning(value: string): string {
  return value
    .split("\n")
    .map((line) => `  ${color(line, "gray")}`)
    .join("\n")
}

function styleDiagnostic(value: string, baseColor: keyof Omit<typeof ansi, "reset">, alignLabels: boolean): string {
  return value
    .split("\n")
    .map((line, index) => {
      if (!alignLabels) return styleDiagnosticLine(line, baseColor)

      if (index === 0 && line.startsWith("Template: ")) return `    ${color(padLabel("Template"), "gray")}${styleDiagnosticLine(line.slice("Template: ".length), baseColor)}`
      if (index === 1 && line.startsWith("Expected: ")) return `    ${color(padLabel("Expected"), "gray")}${styleDiagnosticLine(line.slice("Expected: ".length), undefined)}`
      if (index === 2 && line.startsWith("Actual: ")) return `    ${color(padLabel("Actual"), "gray")}${styleDiagnosticLine(line.slice("Actual: ".length), baseColor)}`

      return `    ${" ".repeat(11)}${styleDiagnosticLine(line, baseColor)}`
    })
    .join("\n")
}

function styleDiagnosticLine(value: string, baseColor?: keyof Omit<typeof ansi, "reset">): string {
  const parts = value.split(new RegExp(`(${escapeRegex(diagnosticHighlightStart)}|${escapeRegex(diagnosticHighlightEnd)})`))
  let highlighted = false
  let output = baseColor ? ansi[baseColor] : ""

  for (const part of parts) {
    if (part === diagnosticHighlightStart) {
      highlighted = true
      output += ansi.reset
    } else if (part === diagnosticHighlightEnd) {
      highlighted = false
      output += baseColor ? ansi[baseColor] : ansi.reset
    } else {
      output += part
    }
  }

  return `${output}${baseColor ? ansi.reset : ""}`
}

function color(value: string, name: keyof Omit<typeof ansi, "reset">): string {
  return `${ansi[name]}${value}${ansi.reset}`
}

function padLabel(label: string): string {
  return `${label}:`.padEnd(11, " ")
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function formatSummaryCount(count: number, label: string, colorName: keyof Omit<typeof ansi, "reset">): string {
  return `${color(String(count), colorName)} ${label}`
}
