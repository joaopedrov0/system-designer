import type { Scenario } from '../core'

export interface ScenarioSummary {
  id: string
  name: string
  updatedAt: string
}

/**
 * Onde os cenários moram. Hoje: IndexedDB no navegador. Depois: HTTP (cliente-servidor)
 * ou sistema de arquivos (Tauri / File System Access API), sem mudar o resto da app.
 */
export interface ScenarioRepository {
  list(): Promise<ScenarioSummary[]>
  load(id: string): Promise<Scenario | undefined>
  save(scenario: Scenario): Promise<void>
  remove(id: string): Promise<void>
  getLastOpenedId(): Promise<string | undefined>
  setLastOpenedId(id: string): Promise<void>
}
