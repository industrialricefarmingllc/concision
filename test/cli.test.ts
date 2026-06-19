import { describe, expect, test } from "bun:test"
import { parseCliArgs } from "../src/infrastructure/cli/cli-command"

describe("CLI arguments", () => {
  test("runs check by default", () => {
    expect(parseCliArgs([], "/repo")).toEqual({ kind: "check", root: "/repo" })
  })

  test("runs explicit check command", () => {
    expect(parseCliArgs(["check"], "/repo")).toEqual({ kind: "check", root: "/repo" })
    expect(parseCliArgs(["check", "/tmp/project"], "/repo")).toEqual({ kind: "check", root: "/tmp/project" })
  })

  test("keeps the old single root argument form", () => {
    expect(parseCliArgs(["/tmp/project"], "/repo")).toEqual({ kind: "check", root: "/tmp/project" })
  })

  test("rejects unknown multi-argument commands", () => {
    expect(parseCliArgs(["lint", "/repo"], "/cwd")).toEqual({
      kind: "error",
      message: "Unknown command: lint",
      exitCode: 1,
    })
  })
})
