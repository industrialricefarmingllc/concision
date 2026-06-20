import { readProjectFilePaths, readTemplateFiles } from "../filesystem/read-project-files"
import { ParallelValidationController } from "../parallel/parallel-validation-controller"
import { renderReport } from "./render-report"

type CliCommand =
  | { kind: "check"; root: string; showAll: boolean }
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

  const root = command.root
  const validator = new ParallelValidationController()
  const templates = await readTemplateFiles(root)
  if (templates.length === 0) {
    console.error("No template tests found. Create them in `.spec/templates/`.")
    return 1
  }

  const parsed = await validator.parseTemplates(templates)
  const paths = await readProjectFilePaths(root, parsed.templates.flatMap((template) => template.paths))
  if (paths.length === 0) {
    console.error("No project files matched the templates in `.spec/templates/`.")
    return 1
  }

  const report = await validator.validateFilePaths(parsed, root, paths)

  console.log(renderReport(report, { showAll: command.showAll }))
  return report.valid ? 0 : 1
}

export function parseCliArgs(args: string[], cwd = process.cwd()): CliCommand {
  const showAll = args.includes("--show-all")
  const positional = args.filter((arg) => arg !== "--show-all")
  const [command, ...rest] = positional

  if (!command) return { kind: "check", root: cwd, showAll }
  if (command === "help" || command === "--help" || command === "-h") return { kind: "help", exitCode: 0 }

  if (command === "check") {
    if (rest.length > 1) return { kind: "error", message: "Too many arguments for check.", exitCode: 1 }
    return { kind: "check", root: rest[0] ?? cwd, showAll }
  }

  if (rest.length === 0) return { kind: "check", root: command, showAll }

  return { kind: "error", message: `Unknown command: ${command}`, exitCode: 1 }
}

function usage(): string {
  return "Usage: concision check [root] [--show-all]"
}
