import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runOperation, type OperationResult } from '../src/agent/operations'
import { createScenario, fromJSON, toJSON, type Scenario } from '../src/core'

export function readScenarioFile(path: string): Scenario {
  if (!existsSync(path)) {
    throw new Error(`Arquivo não encontrado: ${path} (use create_scenario para criar um).`)
  }
  return fromJSON(readFileSync(path, 'utf8'))
}

export function writeScenarioFile(path: string, scenario: Scenario) {
  writeFileSync(path, toJSON(scenario), 'utf8')
}

export function createScenarioFile(path: string, name: string, overwrite = false): Scenario {
  if (existsSync(path) && !overwrite) {
    throw new Error(`O arquivo já existe: ${path}. Use overwrite para substituir.`)
  }
  const scenario = createScenario(name)
  writeScenarioFile(path, scenario)
  return scenario
}

/**
 * Lê o cenário, aplica a operação e grava de volta (só se ela alterou algo). Cada chamada
 * relê o arquivo, então mudanças feitas no editor entre uma chamada e outra são mantidas.
 */
export async function applyToFile(
  file: string,
  operation: string,
  input: unknown,
): Promise<OperationResult> {
  const path = resolve(file)
  const result = await runOperation(readScenarioFile(path), operation, input)
  if (result.scenario) writeScenarioFile(path, result.scenario)
  return result
}
