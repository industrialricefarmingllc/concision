export const diagnosticHighlightStart = "__CONCISION_HIGHLIGHT_START__"
export const diagnosticHighlightEnd = "__CONCISION_HIGHLIGHT_END__"

export function highlightDiagnostic(value: string): string {
  return `${diagnosticHighlightStart}${value}${diagnosticHighlightEnd}`
}
