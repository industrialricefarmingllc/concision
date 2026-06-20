import { describe, expect, test } from "bun:test"
import { parseCliArgs } from "../src/infrastructure/cli/cli-command"

describe("CLI arguments", () => {
  test("runs check by default", () => {
    expect(parseCliArgs([], "/repo")).toEqual({ kind: "check", root: "/repo", targets: [], showAll: false })
  })

  test("runs explicit check command", () => {
    expect(parseCliArgs(["check"], "/repo")).toEqual({ kind: "check", root: "/repo", targets: [], showAll: false })
    expect(parseCliArgs(["check", "/tmp/project"], "/repo")).toEqual({ kind: "check", root: "/repo", targets: ["/tmp/project"], showAll: false })
    expect(parseCliArgs(["check", "file-a.ts", "file-b.ts"], "/repo")).toEqual({ kind: "check", root: "/repo", targets: ["file-a.ts", "file-b.ts"], showAll: false })
  })

  test("accepts show all flag", () => {
    expect(parseCliArgs(["check", "--show-all"], "/repo")).toEqual({ kind: "check", root: "/repo", targets: [], showAll: true })
    expect(parseCliArgs(["--show-all", "/tmp/project"], "/repo")).toEqual({ kind: "check", root: "/tmp/project", targets: [], showAll: true })
  })

  test("keeps the old single root argument form", () => {
    expect(parseCliArgs(["/tmp/project"], "/repo")).toEqual({ kind: "check", root: "/tmp/project", targets: [], showAll: false })
  })

  test("rejects unknown multi-argument commands", () => {
    expect(parseCliArgs(["lint", "/repo"], "/cwd")).toEqual({
      kind: "error",
      message: "Unknown command: lint",
      exitCode: 1,
    })
  })
})
