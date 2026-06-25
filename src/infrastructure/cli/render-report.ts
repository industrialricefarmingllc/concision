import type { ValidationReport } from "../../application/validation/types"
import { diagnosticHighlightEnd, diagnosticHighlightStart } from "../../domain/matching/diagnostic-highlight"
import type { TemplateError } from "../parser/parse-template"

const ansi = {
  red: "\u001b[31m",
  green: "\u001b[32m",
  cyan: "\u001b[36m",
  gray: "\u001b[90m",
  white: "\u001b[37m",
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
    lines.push("", "Template errors", ...report.errors.flatMap(renderTemplateError))
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
    lines.push("", `  Re-run specific files with \`concision check [file-path]\`.`)
    lines.push("", ...renderSyntaxRef())
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

export function renderTemplateError(error: TemplateError): string[] {
  const location = error.sourceLine > 0 ? `${error.path}:${error.sourceLine}` : error.path
  const lines: string[] = [`  ${color(location, "gray")}`]
  if (error.sourceText) {
    lines.push(`    ${color(error.sourceText, "red")}`)
    lines.push(`    ${color(" ".repeat(Math.max(0, error.column - 1)) + "^", "gray")}`)
  }
  lines.push(`    ${color(error.message, "white")}`)
  return lines
}

function styleDiagnostic(value: string, baseColor: keyof Omit<typeof ansi, "reset">, alignLabels: boolean): string {
  return value
    .split("\n")
    .map((line, index) => {
      if (!alignLabels) return styleDiagnosticLine(line, baseColor)

      if (index === 0 && line.startsWith("Template: ")) return `    ${color(padLabel("Template"), "gray")}${styleDiagnosticLine(line.slice("Template: ".length), baseColor)}`
      if (index === 1 && line.startsWith("Expected: ")) return `    ${color(padLabel("Expected"), "gray")}${styleDiagnosticLine(line.slice("Expected: ".length), undefined)}`
      if (index === 2 && line.startsWith("Actual: ")) return `    ${color(padLabel("Actual"), "gray")}${styleDiagnosticLine(line.slice("Actual: ".length), "white")}`

      return `    ${" ".repeat(11)}${styleDiagnosticLine(line, baseColor)}`
    })
    .join("\n")
}

function styleDiagnosticLine(value: string, baseColor?: keyof Omit<typeof ansi, "reset">): string {
  const parts = value.split(new RegExp(`(${escapeRegex(diagnosticHighlightStart)}|${escapeRegex(diagnosticHighlightEnd)})`))
  let output = baseColor ? ansi[baseColor] : ""

  for (const part of parts) {
    if (part === diagnosticHighlightStart) {
      output += ansi.red
    } else if (part === diagnosticHighlightEnd) {
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

function renderSyntaxRef(): string[] {
  const rows: [string, string][] = [
    ["~", "Optional empty line"],
    ["~[...]", "Optional block"],
    ["*", "Wildcard - matches any text to next concrete symbol"],
    ["**", "Unbounded repeat - any number of lines (any content)"],
    ["**[content]", "Unbounded repeat - any number of lines matching format"],
    ["**[N]", "Bounded repeat - up to N variables"],
    ["_N_", "Capture group - reuse with case-variant matching"],
    ["\\*", "Literal asterisk"],
    ["!", "Exclude - line must NOT match (definitive end)"],
    ["![text]", "Exclude - line must NOT contain text (definitive end)"],
    ["!!", "Require - line MUST match (definitive end)"],
    ["!![text]", "Require - line MUST contain text (definitive end)"],
    ["*![text] / *!![text]", "Wildcard-scoped exclude/require"],
    ["|[A <> B]", "Alternation - one of the listed options"],
  ]

  const colWidth = Math.max(...rows.map(([k]) => k.length)) + 3
  const lines: string[] = []

  for (const [op, desc] of rows) {
    lines.push(`  ${color(op.padEnd(colWidth), "cyan")}${desc}`)
  }

  return lines
}
