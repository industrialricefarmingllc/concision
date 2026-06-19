import { validateFiles } from "../../application/validation/validate-files"
import { templateTargetPatterns } from "../../application/validation/template-target-patterns"
import { readProjectFiles, readTemplateFiles } from "../filesystem/read-project-files"
import { countTypeScriptVariables } from "../language/typescript"
import { parseTemplate } from "../parser/parse-template"
import { renderReport } from "./render-report"

export async function runCli(args: string[]): Promise<number> {
  const root = args[0] ?? process.cwd()
  const templates = await readTemplateFiles(root)
  const files = await readProjectFiles(root, templateTargetPatterns(templates, parseTemplate))
  const report = validateFiles({ parseTemplate, variableCounter: countTypeScriptVariables, templates, files })

  console.log(renderReport(report))
  return report.valid ? 0 : 1
}
