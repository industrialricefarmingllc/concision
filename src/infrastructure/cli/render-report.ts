import type { ValidationReport } from "../../application/validation/types"

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
    lines.push("", "Template errors", ...report.errors.map((error) => styleMultiline(error, "  ", "gray")))
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
    lines.push("", `Warnings (${report.warnings.length})`, ...report.warnings.map((warning) => styleMultiline(warning, "  ", "gray")))
  }

  lines.push("", `Summary: ${formatSummaryCount(passed, "passed", "green")}, ${formatSummaryCount(failed.length, "failed", "red")}, ${report.files.length} checked`)

  return lines.join("\n")
}

function renderFailedFile(file: ValidationReport["files"][number]): string[] {
  return [`  ${color(file.path, "red")}`, ...file.errors.map((error) => styleMultiline(error, "    ", "gray"))]
}

function styleMultiline(value: string, prefix: string, colorName: keyof Omit<typeof ansi, "reset">): string {
  return value
    .split("\n")
    .map((line) => `${prefix}${color(line, colorName)}`)
    .join("\n")
}

function color(value: string, name: keyof Omit<typeof ansi, "reset">): string {
  return `${ansi[name]}${value}${ansi.reset}`
}

function formatSummaryCount(count: number, label: string, colorName: keyof Omit<typeof ansi, "reset">): string {
  return `${color(String(count), colorName)} ${label}`
}
