/**
 * Servidor MCP (Model Context Protocol) do System Designer, via stdio. Expõe as operações
 * de src/agent/operations.ts sobre um arquivo .json de cenário, para agentes como Claude
 * Code ou Antigravity. Se o mesmo arquivo estiver vinculado no editor (botão "Arquivo"),
 * as mudanças do agente aparecem no canvas na hora.
 *
 * Uso: node bin/mcp.mjs [arquivo-padrão.json]
 */
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'
import { inputJsonSchema, operations } from '../src/agent/operations'
import { applyToFile, createScenarioFile } from './scenarioFile'

const SERVER_INFO = { name: 'system-designer', version: '0.1.0' }
const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']

const INSTRUCTIONS = `Edita cenários do System Designer: diagramas de arquitetura de software guardados num arquivo .json.
Comece com get_scenario (resumo em Markdown com todos os ids). Prefira o mínimo: um componente com nome e tipo já é válido; rotas, tabelas, modelos e tópicos (add_detail_item) só quando agregarem.
Os ids são gerados a partir dos nomes e devolvidos por cada operação; use-os nas seguintes.
Depois de adicionar vários componentes, chame auto_layout para organizar o desenho.
Cada operação relê e regrava o arquivo; o editor no navegador, se vinculado ao arquivo, atualiza sozinho.`

type Json = Record<string, unknown>

interface Request {
  jsonrpc: '2.0'
  id?: string | number | null
  method: string
  params?: Json
}

const fileProperty = (defaultFile: string | undefined) => ({
  type: 'string',
  description: defaultFile
    ? `Caminho do arquivo .json do cenário (padrão: ${defaultFile}).`
    : 'Caminho do arquivo .json do cenário.',
})

export function createServer(defaultFile?: string) {
  const tools = [
    {
      name: 'create_scenario',
      description: 'Cria um arquivo .json com um cenário novo e vazio.',
      inputSchema: {
        type: 'object',
        properties: {
          file: fileProperty(defaultFile),
          name: { type: 'string', description: 'Nome do cenário.' },
          overwrite: { type: 'boolean', description: 'Substituir se o arquivo já existir.' },
        },
        required: ['name', ...(defaultFile ? [] : ['file'])],
      },
    },
    ...operations.map((op) => {
      const schema = inputJsonSchema(op)
      const properties = (schema.properties ?? {}) as Json
      const required = (schema.required ?? []) as string[]
      delete schema.$schema
      return {
        name: op.name,
        description: op.description,
        inputSchema: {
          ...schema,
          properties: { file: fileProperty(defaultFile), ...properties },
          required: defaultFile ? required : ['file', ...required],
        },
      }
    }),
  ]

  async function callTool(name: string, args: Json) {
    const { file: rawFile, ...input } = args
    const file = typeof rawFile === 'string' && rawFile ? rawFile : defaultFile
    if (!file) throw new Error('Informe "file": o caminho do arquivo .json do cenário.')
    if (name === 'create_scenario') {
      const s = createScenarioFile(
        resolve(file),
        String(input.name ?? ''),
        input.overwrite === true,
      )
      return `Cenário "${s.name}" criado em ${resolve(file)}.`
    }
    return (await applyToFile(file, name, input)).text
  }

  /** Trata uma mensagem JSON-RPC; devolve a resposta (ou nada, para notificações). */
  async function handle(message: Request): Promise<Json | undefined> {
    const { id, method, params = {} } = message
    if (id === undefined) return undefined // notificação (ex.: notifications/initialized)
    const reply = (result: Json) => ({ jsonrpc: '2.0', id, result })
    switch (method) {
      case 'initialize': {
        const requested = String(params.protocolVersion ?? '')
        return reply({
          protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        })
      }
      case 'ping':
        return reply({})
      case 'tools/list':
        return reply({ tools })
      case 'tools/call': {
        const name = String(params.name ?? '')
        if (!tools.some((t) => t.name === name)) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: `Ferramenta desconhecida: ${name}` },
          }
        }
        try {
          const text = await callTool(name, (params.arguments ?? {}) as Json)
          return reply({ content: [{ type: 'text', text }] })
        } catch (err) {
          // Erros da operação voltam para o agente corrigir a chamada, não como falha do protocolo.
          const text = err instanceof Error ? err.message : String(err)
          return reply({ content: [{ type: 'text', text }], isError: true })
        }
      }
      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Método desconhecido: ${method}` },
        }
    }
  }

  return { tools, handle }
}

/** Laço stdio: uma mensagem JSON por linha. Logs vão para stderr (stdout é do protocolo). */
export function serveStdio(defaultFile?: string) {
  const server = createServer(defaultFile && resolve(defaultFile))
  const send = (message: Json) => process.stdout.write(JSON.stringify(message) + '\n')
  // Uma chamada por vez: duas operações nunca fazem ler-alterar-gravar no arquivo ao mesmo tempo.
  let queue = Promise.resolve()
  createInterface({ input: process.stdin }).on('line', (line) => {
    if (!line.trim()) return
    queue = queue.then(async () => {
      let message: Request
      try {
        message = JSON.parse(line)
      } catch {
        send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido' } })
        return
      }
      try {
        const response = await server.handle(message)
        if (response) send(response)
      } catch (err) {
        console.error(err)
        if (message.id !== undefined) {
          send({ jsonrpc: '2.0', id: message.id, error: { code: -32603, message: String(err) } })
        }
      }
    })
  })
  console.error(
    `system-designer MCP pronto${defaultFile ? ` (arquivo: ${resolve(defaultFile)})` : ''}`,
  )
}
