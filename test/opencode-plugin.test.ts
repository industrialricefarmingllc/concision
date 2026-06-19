import { describe, expect, test } from "bun:test"
import plugin from "../index"

describe("OpenCode plugin export", () => {
  test("exports a plugin function from the package root", () => {
    expect(typeof plugin).toBe("function")
  })
})
