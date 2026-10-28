import { createStore, del, entries, get, set } from 'idb-keyval'
import { parseScenario, type Scenario } from '../core'
import type { ScenarioRepository, ScenarioSummary } from './repository'

const SCENARIO_PREFIX = 'scenario:'
const LAST_OPENED_KEY = 'meta:lastOpened'

export class IndexedDbRepository implements ScenarioRepository {
  private store = createStore('system-designer', 'kv')

  async list(): Promise<ScenarioSummary[]> {
    const all = await entries<string, Scenario>(this.store)
    return all
      .filter(([key]) => key.startsWith(SCENARIO_PREFIX))
      .map(([, s]) => ({ id: s.id, name: s.name, updatedAt: s.updatedAt }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async load(id: string): Promise<Scenario | undefined> {
    const raw = await get(SCENARIO_PREFIX + id, this.store)
    // Passa pelo mesmo caminho de validação/migração de um import.
    return raw === undefined ? undefined : parseScenario(raw)
  }

  async save(scenario: Scenario): Promise<void> {
    const stamped = { ...scenario, updatedAt: new Date().toISOString() }
    await set(SCENARIO_PREFIX + scenario.id, stamped, this.store)
  }

  async remove(id: string): Promise<void> {
    await del(SCENARIO_PREFIX + id, this.store)
  }

  getLastOpenedId(): Promise<string | undefined> {
    return get(LAST_OPENED_KEY, this.store)
  }

  async setLastOpenedId(id: string): Promise<void> {
    await set(LAST_OPENED_KEY, id, this.store)
  }
}
