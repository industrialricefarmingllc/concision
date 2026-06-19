#!/usr/bin/env bun
import { runCli } from "./src/infrastructure/cli/cli-command"

process.exit(await runCli(Bun.argv.slice(2)))
