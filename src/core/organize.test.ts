import { describe, expect, it } from 'vitest'
import {
  addComponent,
  addGroup,
  addNote,
  applyLayout,
  connect,
  createScenario,
  moveElements,
  removeElements,
  resizeElement,
  updateComponent,
  updateGroup,
  updateNote,
} from './commands'
import { CommandError } from './errors'
import { fromJSON, toJSON } from './export/json'

function backend() {
  const g = addGroup(createScenario(), { layout: { x: 0, y: 0, w: 500, h: 300 }, name: 'Backend' })
  const api = addComponent(g.scenario, { kind: 'server', position: { x: 50, y: 50 } })
  const placed = moveElements(api.scenario, [{ id: api.id, x: 50, y: 50, groupId: g.id }])
  return { scenario: placed, group: g.id, api: api.id }
}

describe('grupos', () => {
  it('cria grupo com nome padrão único e tamanho mínimo', () => {
    const a = addGroup(createScenario(), { layout: { x: 0, y: 0, w: 5, h: 5 } })
    const b = addGroup(a.scenario, { layout: { x: 0, y: 0, w: 100, h: 100 } })
    expect([a.id, b.id]).toEqual(['grupo', 'grupo-2'])
    expect(b.scenario.groups[0].layout).toEqual({ x: 0, y: 0, w: 40, h: 40 })
  })

  it('moveElements coloca e tira componente de um grupo', () => {
    const { scenario, api, group } = backend()
    expect(scenario.components[0].groupId).toBe(group)
    const out = moveElements(scenario, [{ id: api, x: 900, y: 0, groupId: null }])
    expect('groupId' in out.components[0]).toBe(false)
    expect(() => moveElements(scenario, [{ id: api, x: 0, y: 0, groupId: 'x' }])).toThrow(
      CommandError,
    )
  })

  it('mover o grupo arrasta seus membros', () => {
    const { scenario, group } = backend()
    const moved = moveElements(scenario, [{ id: group, x: 100, y: 10 }])
    expect(moved.groups[0].layout).toMatchObject({ x: 100, y: 10 })
    expect(moved.components[0].layout).toEqual({ x: 150, y: 60 })
  })

  it('excluir grupo mantém os membros, sem grupo', () => {
    const { scenario, group } = backend()
    const next = removeElements(scenario, { groupIds: [group] })
    expect(next.groups).toEqual([])
    expect(next.components).toHaveLength(1)
    expect('groupId' in next.components[0]).toBe(false)
  })

  it('renomeia e descreve', () => {
    const { scenario, group } = backend()
    const next = updateGroup(scenario, group, { name: 'API', description: 'serviços internos' })
    expect(next.groups[0]).toMatchObject({ name: 'API', description: 'serviços internos' })
    expect(() => updateGroup(scenario, group, { name: ' ' })).toThrow(CommandError)
  })

  it('redimensiona', () => {
    const { scenario, group } = backend()
    const next = resizeElement(scenario, group, { x: -10, y: 0, w: 800, h: 400 })
    expect(next.groups[0].layout).toEqual({ x: -10, y: 0, w: 800, h: 400 })
  })
})

describe('notas', () => {
  it('cria, edita, move e exclui', () => {
    const n = addNote(createScenario(), { layout: { x: 0, y: 0 }, text: 'lembrar do cache' })
    let s = updateNote(n.scenario, n.id, 'cachear sessões')
    s = moveElements(s, [{ id: n.id, x: 10, y: 20 }])
    expect(s.notes[0]).toEqual({ id: 'nota', text: 'cachear sessões', layout: { x: 10, y: 20 } })
    expect(removeElements(s, { noteIds: [n.id] }).notes).toEqual([])
  })
})

describe('tags', () => {
  it('normaliza e remove quando vazio', () => {
    const { scenario, api } = backend()
    const tagged = updateComponent(scenario, api, { tags: [' core ', 'core', '', 'auth'] })
    expect(tagged.components[0].tags).toEqual(['core', 'auth'])
    expect('tags' in updateComponent(tagged, api, { tags: [] }).components[0]).toBe(false)
  })
})

describe('applyLayout', () => {
  it('posiciona sem arrastar membros e redimensiona grupos', () => {
    const { scenario, group, api } = backend()
    const next = applyLayout(
      scenario,
      { [group]: { x: 1000, y: 0 }, [api]: { x: 1020, y: 40 } },
      { [group]: { w: 300, h: 200 } },
    )
    expect(next.groups[0].layout).toEqual({ x: 1000, y: 0, w: 300, h: 200 })
    expect(next.components[0].layout).toEqual({ x: 1020, y: 40 })
  })

  it('descarta as alças salvas das conexões', () => {
    const { scenario, api } = backend()
    const db = addComponent(scenario, { kind: 'database', position: { x: 0, y: 0 } })
    const c = connect(db.scenario, {
      source: api,
      target: db.id,
      sourceHandle: 'top',
      targetHandle: 'top',
    })
    const next = applyLayout(c.scenario, { [api]: { x: 0, y: 0 } })
    expect('layout' in next.connections[0]).toBe(false)
  })
})

it('cenário com grupos e notas sobrevive a exportar/importar', () => {
  const { scenario } = backend()
  const s = addNote(scenario, { layout: { x: 0, y: 400, w: 200, h: 100 }, text: 'oi' }).scenario
  expect(fromJSON(toJSON(s))).toEqual(s)
})
