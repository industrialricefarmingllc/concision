#!/usr/bin/env bun
import { runCli } from "./src/infrastructure/cli/cli-command"
export { ConcisionPlugin as default } from "./src/infrastructure/opencode/concision-plugin"

if (import.meta.main) process.exit(await runCli(Bun.argv.slice(2)))
