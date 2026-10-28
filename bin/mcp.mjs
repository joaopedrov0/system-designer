#!/usr/bin/env node
// Servidor MCP do System Designer (stdio). Uso: node bin/mcp.mjs [arquivo-padrão.json]
// Roda o TypeScript direto (via tsx), de qualquer diretório.
import { register } from 'tsx/esm/api'

register()
const { serveStdio } = await import('../mcp/server.ts')
serveStdio(process.argv[2])
