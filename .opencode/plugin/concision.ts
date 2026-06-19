import { spawn } from "node:child_process"

type PluginContext = {
  directory?: string
  project?: { root?: string; path?: string; cwd?: string }
  worktree?: string | { root?: string; path?: string; cwd?: string }
}

type ToolHookInput = {
  tool?: string
  args?: Record<string, unknown>
}

type ToolHookOutput = {
  args?: Record<string, unknown>
}

const MUTATING_TOOLS = new Set(["edit", "write", "patch", "apply_patch"])
const CHECK_TIMEOUT_MS = 30_000
const OUTPUT_LIMIT = 12_000

const plugin = async (ctx: PluginContext) => {
  const root = resolveRoot(ctx)

  return {
    "tool.execute.after": async (input: ToolHookInput, output: ToolHookOutput) => {
      if (!shouldRunCheck(input, output)) return

      await runConcisionCheck(root)
    },
  }
}

export const ConcisionPlugin = plugin
export default plugin

function shouldRunCheck(input: ToolHookInput, output: ToolHookOutput): boolean {
  if (!input.tool) return false
  if (MUTATING_TOOLS.has(input.tool)) return true

  if (input.tool === "bash") {
    const command = String(output.args?.command ?? input.args?.command ?? "")
    return command.trim().length > 0 && !runsConcisionCheck(command)
  }

  return false
}

function runsConcisionCheck(command: string): boolean {
  return /\b(concision\s+check|index\.ts\s+check|bun\s+run\s+check|npm\s+run\s+check|pnpm\s+run\s+check)\b/.test(
    command,
  )
}

async function runConcisionCheck(root: string): Promise<void> {
  const result = await run("bun", ["./index.ts", "check", root], root)
  if (result.code === 0) return

  throw new Error(["concision check failed", result.output.trim()].filter(Boolean).join("\n\n"))
}

function run(command: string, args: string[], cwd: string): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] })
    let output = ""
    let settled = false

    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill("SIGTERM")
      reject(new Error(`concision check timed out after ${CHECK_TIMEOUT_MS}ms`))
    }, CHECK_TIMEOUT_MS)

    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk) => {
      output = appendOutput(output, chunk)
    })
    child.stderr.on("data", (chunk) => {
      output = appendOutput(output, chunk)
    })

    child.on("error", (error) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      reject(error)
    })

    child.on("close", (code) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolve({ code, output })
    })
  })
}

function appendOutput(current: string, chunk: string): string {
  if (current.length >= OUTPUT_LIMIT) return current
  return (current + chunk).slice(0, OUTPUT_LIMIT)
}

function resolveRoot(ctx: PluginContext): string {
  if (typeof ctx.worktree === "string") return ctx.worktree
  const worktree = ctx.worktree
  if (worktree?.root) return worktree.root
  if (worktree?.path) return worktree.path
  if (worktree?.cwd) return worktree.cwd
  if (ctx.project?.root) return ctx.project.root
  if (ctx.project?.path) return ctx.project.path
  if (ctx.project?.cwd) return ctx.project.cwd
  return ctx.directory ?? process.cwd()
}
