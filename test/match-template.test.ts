import { describe, expect, test } from "bun:test"
import { matchTemplate } from "../src/domain/matching/match-template"
import { parseTemplate } from "../src/infrastructure/parser/parse-template"

describe("matchTemplate", () => {
  test("appends sourceLine to the template path", () => {
    const template = parseTemplate("---\npaths: /checked/*.ts\n---\nhello", "template.spec")
    if (!template.ok) throw new Error(template.errors.join("\n"))

    const result = matchTemplate(template.value, { filePath: "/checked/file.ts", content: "bye" })

    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("Template: template.spec:1")
    expect(result.errors[0]).not.toContain("/checked/file.ts:1")
  })
})
