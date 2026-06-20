import { describe, expect, test } from "bun:test"
import { parseCliArgs } from "../src/infrastructure/cli/cli-command"

describe("CLI arguments", () => {
  test("runs check by default", () => {
    expect(parseCliArgs([], "/repo")).toEqual({ kind: "check", root: "/repo", showAll: false })
  })

  test("runs explicit check command", () => {
    expect(parseCliArgs(["check"], "/repo")).toEqual({ kind: "check", root: "/repo", showAll: false })
    expect(parseCliArgs(["check", "/tmp/project"], "/repo")).toEqual({ kind: "check", root: "/tmp/project", showAll: false })
  })

  test("accepts show all flag", () => {
    expect(parseCliArgs(["check", "--show-all"], "/repo")).toEqual({ kind: "check", root: "/repo", showAll: true })
    expect(parseCliArgs(["--show-all", "/tmp/project"], "/repo")).toEqual({ kind: "check", root: "/tmp/project", showAll: true })
  })

  test("keeps the old single root argument form", () => {
    expect(parseCliArgs(["/tmp/project"], "/repo")).toEqual({ kind: "check", root: "/tmp/project", showAll: false })
  })

  test("rejects unknown multi-argument commands", () => {
    expect(parseCliArgs(["lint", "/repo"], "/cwd")).toEqual({
      kind: "error",
      message: "Unknown command: lint",
      exitCode: 1,
    })
  })
})
