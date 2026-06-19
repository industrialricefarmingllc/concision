import { validateFiles } from "../../application/validation/validate-files"
import { templateTargetPatterns } from "../../application/validation/template-target-patterns"
import { readProjectFiles, readTemplateFiles } from "../filesystem/read-project-files"
import { countTypeScriptVariables } from "../language/typescript"
import { parseTemplate } from "../parser/parse-template"
import { renderReport } from "./render-report"

type CliCommand =
  | { kind: "check"; root: string }
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
  const templates = await readTemplateFiles(root)
  const files = await readProjectFiles(root, templateTargetPatterns(templates, parseTemplate))
  const report = validateFiles({ parseTemplate, variableCounter: countTypeScriptVariables, templates, files })

  console.log(renderReport(report))
  return report.valid ? 0 : 1
}

export function parseCliArgs(args: string[], cwd = process.cwd()): CliCommand {
  const [command, ...rest] = args

  if (!command) return { kind: "check", root: cwd }
  if (command === "help" || command === "--help" || command === "-h") return { kind: "help", exitCode: 0 }

  if (command === "check") {
    if (rest.length > 1) return { kind: "error", message: "Too many arguments for check.", exitCode: 1 }
    return { kind: "check", root: rest[0] ?? cwd }
  }

  if (rest.length === 0) return { kind: "check", root: command }

  return { kind: "error", message: `Unknown command: ${command}`, exitCode: 1 }
}

function usage(): string {
  return "Usage: concision check [root]"
}
