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

  test("does not diagnose skipped optional content as extra source", () => {
    const template = parseTemplate("---\npaths: /checked/*.svelte\n---\n~<style>\n</style>~", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/file.svelte", content: "<script>" })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).not.toContain("Expected: end of template")
    expect(result.errors[0]).toContain("Expected: <style> ↵ </style>")
    expect(result.sourceLine).toBe(1)
  })

  test("does not skip an optional block after the source starts it", () => {
    const template = parseTemplate("---\npaths: /checked/*.svelte\n---\n~<script>\nconst module = *Module.getInstance(*)\n</script>~", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/file.svelte", content: "<script>\n</script>" })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).not.toContain("Expected: end of template")
    expect(result.errors[0]).toContain("Expected: const module = *Module.getInstance(*)")
    expect(result.sourceLine).toBe(2)
  })

  test("allows inline repeat patterns to span multiple source lines", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\ncall(**)", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "call(\n  first,\n  second\n)" })

    expect(result.valid).toBe(true)
  })

  test("applies inline repeat exclusions across consumed source lines", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\ncall(**)!forbidden", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "call(\n  forbidden\n)" })

    expect(result.valid).toBe(false)
  })
})
