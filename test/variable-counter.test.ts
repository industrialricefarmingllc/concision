import { describe, expect, test } from "bun:test"
import { countTypeScriptVariables } from "../src/infrastructure/language/typescript"

describe("TypeScript variable counter", () => {
  test("counts variables and skips function calls and raw values", () => {
    const result = countTypeScriptVariables({
      filePath: "/sample.ts",
      content: "const doubled = value * 2\nreturn add(doubled, 1)",
    })

    expect(result).toEqual({ supported: true, count: 2 })
  })
})
