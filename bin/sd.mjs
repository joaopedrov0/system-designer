#!/usr/bin/env node
// CLI do System Designer. Uso: node bin/sd.mjs help
import { register } from 'tsx/esm/api'

register()
const { runCli } = await import('../mcp/cli.ts')
try {
  console.log(await runCli(process.argv.slice(2)))
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
}
