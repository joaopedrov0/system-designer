import { ImportError } from './errors'
import { SCHEMA_VERSION } from './schema'

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>

/** migrations[n] converte um cenário da versão n para a versão n + 1. */
const migrations: Record<number, Migration> = {}

/**
 * Leva um cenário bruto (de qualquer versão conhecida) até SCHEMA_VERSION.
 * Sem `schemaVersion`, assume a versão atual — útil para JSON escrito à mão ou por LLMs.
 */
export function migrate(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ImportError('O cenário deve ser um objeto JSON.')
  }
  let current = raw as Record<string, unknown>
  const version = current.schemaVersion ?? SCHEMA_VERSION

  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new ImportError(`schemaVersion inválido: ${JSON.stringify(version)}`)
  }
  if (version > SCHEMA_VERSION) {
    throw new ImportError(
      `Este cenário usa a versão ${version} do formato, mais nova que a suportada (${SCHEMA_VERSION}).`,
    )
  }

  for (let v = version; v < SCHEMA_VERSION; v++) {
    const step = migrations[v]
    if (!step) throw new ImportError(`Não há migração da versão ${v} para ${v + 1}.`)
    current = step(current)
  }
  return { ...current, schemaVersion: SCHEMA_VERSION }
}
