/**
 * CLI do System Designer: as mesmas operações do servidor MCP, para scripts e para agentes
 * que preferem o terminal.
 *
 *   node bin/sd.mjs help [operação]
 *   node bin/sd.mjs <arquivo.json> create "Nome do cenário"
 *   node bin/sd.mjs <arquivo.json> <operação> ['{"campo": "valor"}']
 */
import { resolve } from 'node:path'
import { inputJsonSchema, operations, operationsByName } from '../src/agent/operations'
import { applyToFile, createScenarioFile } from './scenarioFile'

const USAGE = `Uso:
  sd help [operação]                      lista as operações ou mostra a entrada de uma
  sd <arquivo.json> create "Nome"          cria um cenário vazio
  sd <arquivo.json> <operação> ['{json}']  executa uma operação (padrão: get_scenario)

Exemplos:
  sd loja.json add_component '{"kind":"server","name":"API","technology":"Node 22"}'
  sd loja.json connect '{"source":"web","target":"api","protocol":"http"}'
  sd loja.json get_scenario '{"format":"mermaid"}'`

export async function runCli(args: string[]): Promise<string> {
  const [first, second, ...rest] = args
  if (!first || first === 'help' || first === '--help' || first === '-h') {
    if (second) {
      const op = operationsByName.get(second)
      if (!op) throw new Error(`Operação desconhecida: ${second}`)
      return `${op.name}: ${op.description}\n\nEntrada (JSON Schema):\n${JSON.stringify(inputJsonSchema(op), null, 2)}`
    }
    const list = operations.map((op) => `  ${op.name.padEnd(24)} ${op.description}`).join('\n')
    return `${USAGE}\n\nOperações:\n${list}`
  }

  const file = first
  const operation = second ?? 'get_scenario'
  if (operation === 'create') {
    const s = createScenarioFile(resolve(file), rest.join(' ') || 'Novo sistema')
    return `Cenário "${s.name}" criado em ${resolve(file)}.`
  }
  let input: unknown = {}
  if (rest.length > 0) {
    try {
      input = JSON.parse(rest.join(' '))
    } catch {
      throw new Error(`A entrada precisa ser um objeto JSON, ex.: '{"id": "api"}'.`)
    }
  }
  return (await applyToFile(file, operation, input)).text
}
