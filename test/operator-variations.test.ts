import { describe, expect, test } from "bun:test"
import { matchTemplate } from "../src/domain/matching/match-template"
import { parseTemplate } from "../src/infrastructure/parser/parse-template"

const TEMPLATE = [
  "---",
  "paths: /**/use*.svelte.ts",
  "---",
  "~[import **]",
  "~",
  "export function use_1_(*) {",
  "  |[",
  "    let _1_ = $state(*)",
  "    <> let _1_ = $derived(*)",
  "    <> let _1_ = $state(",
  "      **",
  "    )",
  "  ]",
  "  ~**[3]",
  "",
  "  return state({",
  "    get value() {",
  "      return _1_",
  "    },",
  "    set value(v) {",
  "      _1_ = v",
  "    },",
  "    ~**",
  "  })",
  "}",
].join("\n")

const VALID_SOURCE = [
  "import { state } from \"@mx/svelte\"",
  "export function useBloomPass() {",
  "  let bloomPass = $state(false)",
  "",
  "  return state({",
  "    get value() {",
  "      return bloomPass",
  "    },",
  "    set value(v) {",
  "      bloomPass = v",
  "    },",
  "  })",
  "}",
].join("\n")

const INVALID_SOURCE = [
  "export function useBloomPass() {",
  "  let wrong = $state(false)",
  "}",
].join("\n")

describe("all operators together", () => {
  test("parses without error", () => {
    const result = parseTemplate(TEMPLATE, "test.spec")
    expect(result.ok).toBe(true)
  })

  test("matches valid source", () => {
    const template = parseTemplate(TEMPLATE, "test.spec")
    if (!template.ok) throw new Error(template.errors.map((e) => e.message).join("\n"))
    const result = matchTemplate(template.value, { filePath: "/test/useBloomPass.svelte.ts", content: VALID_SOURCE })
    expect(result.valid).toBe(true)
  })

  test("rejects invalid source", () => {
    const template = parseTemplate(TEMPLATE, "test.spec")
    if (!template.ok) throw new Error(template.errors.map((e) => e.message).join("\n"))
    const result = matchTemplate(template.value, { filePath: "/test/useBloomPass.svelte.ts", content: INVALID_SOURCE })
    expect(result.valid).toBe(false)
  })
})
