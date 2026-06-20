import { stat } from "node:fs/promises"
import { isAbsolute, relative, resolve } from "node:path"
import { readProjectFilePaths, readTemplateFiles } from "../filesystem/read-project-files"
import { ParallelValidationController } from "../parallel/parallel-validation-controller"
import { renderReport } from "./render-report"

type CliCommand =
  | { kind: "check"; root: string; targets: string[]; showAll: boolean }
  | { kind: "help"; exitCode: 0 }
  | { kind: "error"; message: string; exitCode: 1 }

export async function runCli(args: string[]): Promise<number> {
  const command = parseCliArgs(args)
  if (command.kind === "help") {
    console.log(usage())
    return command.exitCode
  }

  if (command.kind === "error") {
    console.error(`${command.message}\n\n${usage()}`)
    return command.exitCode
  }

  const scope = await checkScope(resolve(command.root), command.targets)
  const validator = new ParallelValidationController()
  const templates = await readTemplateFiles(scope.root)
  if (templates.length === 0) {
    console.error("No template tests found. Create them in `.spec/templates/`.")
    return 1
  }

  const parsed = await validator.parseTemplates(templates)
  let paths: string[]
  try {
    paths = await checkPaths(scope.root, scope.targets, parsed.templates.flatMap((template) => template.paths))
  } catch (error) {
    console.error(errorMessage(error))
    return 1
  }

  if (paths.length === 0) {
    console.error("No project files matched the templates in `.spec/templates/`.")
    return 1
  }

  const report = await validator.validateFilePaths(parsed, scope.root, paths)

  console.log(renderReport(report, { showAll: command.showAll }))
  return report.valid ? 0 : 1
}

export function parseCliArgs(args: string[], cwd = process.cwd()): CliCommand {
  const showAll = args.includes("--show-all")
  const positional = args.filter((arg) => arg !== "--show-all")
  const [command, ...rest] = positional

  if (!command) return { kind: "check", root: cwd, targets: [], showAll }
  if (command === "help" || command === "--help" || command === "-h") return { kind: "help", exitCode: 0 }

  if (command === "check") {
    return { kind: "check", root: cwd, targets: rest, showAll }
  }

  if (rest.length === 0) return { kind: "check", root: command, targets: [], showAll }

  return { kind: "error", message: `Unknown command: ${command}`, exitCode: 1 }
}

function usage(): string {
  return "Usage: concision check [root | file ...] [--show-all]"
}

async function checkScope(root: string, targets: string[]): Promise<{ root: string; targets: string[] }> {
  if (targets.length === 1 && (await isDirectory(resolve(root, targets[0] ?? "")))) {
    return { root: resolve(root, targets[0] ?? ""), targets: [] }
  }

  return { root, targets }
}

async function checkPaths(root: string, targets: string[], patterns: string[]): Promise<string[]> {
  if (targets.length > 0) return Promise.all(targets.map((target) => explicitProjectPath(root, target)))
  return readProjectFilePaths(root, patterns)
}

async function explicitProjectPath(root: string, target: string): Promise<string> {
  const absolute = resolve(root, target)
  const info = await stat(absolute).catch(() => null)
  if (!info?.isFile()) throw new Error(`Project file not found: ${target}`)

  const projectRelative = relative(root, absolute)
  if (projectRelative.startsWith("..") || isAbsolute(projectRelative)) throw new Error(`Project file is outside root: ${target}`)
  return `/${projectRelative}`
}

async function isDirectory(path: string): Promise<boolean> {
  return (await stat(path).catch(() => null))?.isDirectory() ?? false
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}
