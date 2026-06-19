import { describe, expect, test } from "bun:test"
import { parseTemplate } from "../src/infrastructure/parser/parse-template"

describe("template parser", () => {
  test("reads metadata and alternation blocks", async () => {
    const template = await Bun.file(".spec/templates/module.spec").text()
    const result = parseTemplate(template, ".spec/templates/module.spec")

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.paths).toEqual(["/test/**/*Module*.ts"])
    expect(result.value.nodes.some((node) => node.kind === "alternation")).toBe(true)
    expect(result.value.nodes.some((node) => node.kind === "optional")).toBe(true)
  })

  test("unescapes template operators", () => {
    const result = parseTemplate("---\npaths: /x\n---\nconst value = \\*", "inline.spec")

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.nodes).toContainEqual({
      kind: "line",
      pattern: { parts: [{ kind: "literal", value: "const value = *" }], repeat: null, constraints: [] },
    })
  })
})
