import { describe, expect, test } from "bun:test"
import { highlightDiagnostic } from "../src/domain/matching/diagnostic-highlight"
import { matchTemplate } from "../src/domain/matching/match-template"
import { parseTemplate } from "../src/infrastructure/parser/parse-template"

describe("matchTemplate", () => {
  test("keeps template diagnostics separate from the source line", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\nhello", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "bye" })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("Template: template.spec")
    expect(result.sourceLine).toBe(1)
  })

  test("shows the actual source block for multi-line alternation failures", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\ndomain = {} | domain = {\n  *: use*(*) **\n}|", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "domain = {\nbroken\n}" })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("Expected: domain = {} | domain = { ↵ *: use*(*)** ↵ }")
    expect(result.errors[0]).toContain(`Actual: domain = { ↵ ${highlightDiagnostic("broken")}`)
  })

  test("extends actual source blocks through repeated lines to the first violation", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\ndomain = {} | domain = {\n  *: use*(*), **\n}|", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, {
      filePath: "/checked/file.ts",
      content: [
        "domain = {",
        "containerSize: useContainerSize(),",
        "now: useNow(),",
        "scaleMs: useScaleMs(),",
        "situation: useSituation(),",
        "timelineData: {} as Record<string, any>,",
        "}",
      ].join("\n"),
    })

    expect(result.valid).toBe(false)
    expect(result.sourceLine).toBe(6)
    expect(result.errors[0]).toContain(
      `Actual: domain = { ↵ containerSize: useContainerSize(), ↵ now: useNow(), ↵ scaleMs: useScaleMs(), ↵ situation: useSituation(), ↵ ${highlightDiagnostic("timelineData: {} as Record<string, any>,")}`,
    )
  })
})
