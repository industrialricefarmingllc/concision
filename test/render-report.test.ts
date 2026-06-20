import { describe, expect, test } from "bun:test"
import type { ValidationReport } from "../src/application/validation/types"
import { renderReport, renderReportWithOptions } from "../src/infrastructure/cli/render-report"

describe("CLI report rendering", () => {
  test("limits failures by default and reports how many were omitted", () => {
    const output = renderReport({
      valid: false,
      errors: [],
      warnings: [],
      files: Array.from({ length: 6 }, (_, index) => ({
        path: `/fail-${index + 1}.ts`,
        valid: false,
        templates: ["/.spec/templates/simple.spec"],
        errors: [
          [
            `Template: /fail-${index + 1}.ts:3`,
            "Expected: export function *(*) {",
            "Actual: const value = 1",
            "The rule does not match the source line. Change the source line to match `export function *(*) {`.",
          ].join("\n"),
        ],
        warnings: [],
      })),
    } satisfies ValidationReport)

    expect(output).not.toContain("/fail-1.ts")
    expect(output).toContain("/fail-2.ts")
    expect(output).toContain("/fail-6.ts")
    expect(output).toContain("Failed files (5 shown of 6)")
    expect(output).toContain("Omitted 1 additional failure. Use --show-all to display all.")
  })

  test("groups passing files in the summary instead of listing them", () => {
    const output = renderReportWithOptions(
      {
        valid: false,
        errors: [],
        warnings: [],
        files: [
          { path: "/passes.ts", valid: true, templates: ["/.spec/templates/simple.spec"], errors: [], warnings: [] },
          {
            path: "/fails.ts",
            valid: false,
            templates: ["/.spec/templates/simple.spec"],
            errors: [
              [
                "Template: /fails.ts:3",
                "Expected: export function *(*) {",
                "Actual: const value = 1",
                "The rule does not match the source line. Change the source line to match `export function *(*) {`.",
              ].join("\n"),
            ],
            warnings: [],
          },
        ],
      } satisfies ValidationReport,
      { showAll: true },
    )

    expect(output).toContain("Concision check failed")
    expect(output).toContain("Failed files (1)")
    expect(output).not.toContain("/passes.ts")
    expect(output).toContain("\u001b[31m/fails.ts\u001b[0m")
    expect(output).toContain("Expected: export function *(*) {")
    expect(output).toContain("    \u001b[90mThe rule does not match the source line. Change the source line")
    expect(output).toContain("Summary: \u001b[32m1\u001b[0m passed, \u001b[31m1\u001b[0m failed, 2 checked")
  })

  test("renders a clean passing summary", () => {
    const output = renderReportWithOptions(
      {
        valid: true,
        errors: [],
        warnings: [],
        files: [{ path: "/passes.ts", valid: true, templates: ["/.spec/templates/simple.spec"], errors: [], warnings: [] }],
      } satisfies ValidationReport,
      { showAll: true },
    )

    expect(output).toBe("Concision check passed\n\nSummary: \u001b[32m1\u001b[0m passed, \u001b[31m0\u001b[0m failed, 1 checked")
  })
})
