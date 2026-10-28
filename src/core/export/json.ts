import { z } from 'zod'
import { ImportError } from '../errors'
import { migrate } from '../migrations'
import type { Scenario } from '../model'
import { ScenarioSchema } from '../schema'

export function toJSON(s: Scenario): string {
  return JSON.stringify(s, null, 2)
}

export function fromJSON(text: string): Scenario {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new ImportError('O arquivo não contém JSON válido.')
  }
  return parseScenario(raw)
}

/** Migra, valida a forma e checa as referências internas de um cenário bruto. */
export function parseScenario(raw: unknown): Scenario {
  const result = ScenarioSchema.safeParse(migrate(raw))
  if (!result.success) {
    throw new ImportError(`Cenário inválido:\n${z.prettifyError(result.error)}`)
  }
  const problems = integrityProblems(result.data)
  if (problems.length > 0) {
    throw new ImportError(`Cenário inconsistente:\n${problems.map((p) => `✖ ${p}`).join('\n')}`)
  }
  return result.data
}

export function integrityProblems(s: Scenario): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  const ids = [
    ...s.components.map((c) => c.id),
    ...s.connections.map((c) => c.id),
    ...s.groups.map((g) => g.id),
    ...s.notes.map((n) => n.id),
  ]
  for (const id of ids) {
    if (seen.has(id)) problems.push(`Id duplicado: "${id}"`)
    seen.add(id)
  }

  const components = new Set(s.components.map((c) => c.id))
  for (const c of s.connections) {
    if (!components.has(c.source))
      problems.push(`Conexão "${c.id}": origem "${c.source}" não existe`)
    if (!components.has(c.target))
      problems.push(`Conexão "${c.id}": destino "${c.target}" não existe`)
  }

  const groups = new Set(s.groups.map((g) => g.id))
  for (const c of s.components) {
    if (c.groupId && !groups.has(c.groupId)) {
      problems.push(`Componente "${c.id}": grupo "${c.groupId}" não existe`)
    }
  }
  return problems
}
