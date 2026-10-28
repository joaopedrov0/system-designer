/**
 * Ciclo de vida dos cenários: abrir, criar, duplicar, excluir, importar.
 * Fala com o ScenarioRepository e troca o cenário aberto no editor.
 */
import { createScenario, fromJSON, type Scenario } from '../core'
import type { ScenarioRepository, ScenarioSummary } from '../persistence/repository'
import { createAutosave, type Autosave } from './autosave'
import { useEditor } from './editor'

let repo: ScenarioRepository | undefined
let autosave: Autosave | undefined
let initialized: Promise<void> | undefined

function repository(): ScenarioRepository {
  if (!repo) throw new Error('initScenarios() não foi chamado')
  return repo
}

/**
 * Abre o último cenário usado (ou o mais recente, ou um novo) e liga o autosave, que
 * vive enquanto a página estiver aberta. Idempotente: chamadas repetidas (ex.: efeitos
 * em dobro do StrictMode) reutilizam a mesma inicialização em vez de criar cenários extras.
 */
export function initScenarios(repository: ScenarioRepository): Promise<void> {
  initialized ??= init(repository)
  return initialized
}

async function init(repository: ScenarioRepository): Promise<void> {
  repo = repository
  const lastId = await repository.getLastOpenedId()
  let scenario = lastId ? await repository.load(lastId).catch(() => undefined) : undefined
  if (!scenario) {
    const [recent] = await repository.list()
    scenario = recent ? await repository.load(recent.id).catch(() => undefined) : undefined
  }
  if (!scenario) {
    scenario = createScenario('Meu sistema')
    await repository.save(scenario)
  }
  await show(scenario)
  autosave = createAutosave(repository)
}

export function listScenarios(): Promise<ScenarioSummary[]> {
  return repository().list()
}

export async function openScenario(id: string): Promise<void> {
  if (id === useEditor.getState().scenario.id) return
  await autosave?.flush()
  const scenario = await repository().load(id)
  if (!scenario) throw new Error(`Cenário não encontrado: ${id}`)
  await show(scenario)
}

export async function newScenario(name = 'Novo sistema'): Promise<void> {
  await autosave?.flush()
  const scenario = createScenario(name)
  await repository().save(scenario)
  await show(scenario)
}

export async function duplicateScenario(id: string): Promise<void> {
  await autosave?.flush()
  const original = await repository().load(id)
  if (!original) throw new Error(`Cenário não encontrado: ${id}`)
  const now = new Date().toISOString()
  const copy: Scenario = {
    ...original,
    id: crypto.randomUUID(),
    name: `${original.name} (cópia)`,
    createdAt: now,
    updatedAt: now,
  }
  await repository().save(copy)
  await show(copy)
}

export async function deleteScenario(id: string): Promise<void> {
  const repo = repository()
  await repo.remove(id)
  if (useEditor.getState().scenario.id !== id) return
  // Excluiu o aberto: abre o mais recente que sobrou, ou começa um novo.
  const [recent] = await repo.list()
  const next = recent ? await repo.load(recent.id) : undefined
  if (next) await show(next)
  else await newScenario('Meu sistema')
}

/**
 * Importa um JSON (valida, migra e checa referências). Se já existir um cenário com o
 * mesmo id, importa como cópia em vez de sobrescrever.
 */
export async function importScenario(text: string): Promise<Scenario> {
  await autosave?.flush()
  let scenario = fromJSON(text)
  if (
    await repository()
      .load(scenario.id)
      .catch(() => undefined)
  ) {
    scenario = { ...scenario, id: crypto.randomUUID(), name: `${scenario.name} (importado)` }
  }
  await repository().save(scenario)
  await show(scenario)
  return scenario
}

async function show(scenario: Scenario) {
  useEditor.getState().open(scenario)
  await repository().setLastOpenedId(scenario.id)
}
