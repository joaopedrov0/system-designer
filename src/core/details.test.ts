import { describe, expect, it } from 'vitest'
import {
  addComponent,
  addDetailItem,
  connect,
  createScenario,
  reverseConnection,
  setComponentExpanded,
  updateComponentDetails,
  updateConnection,
} from './commands'
import { detailItems } from './details'
import { CommandError } from './errors'
import { fromJSON, toJSON } from './export/json'

function apiWithClient() {
  const client = addComponent(createScenario(), { kind: 'client', position: { x: 0, y: 0 } })
  const api = addComponent(client.scenario, { kind: 'server', position: { x: 300, y: 0 } })
  const conn = connect(api.scenario, { source: client.id, target: api.id, protocol: 'http' })
  return { scenario: conn.scenario, client: client.id, api: api.id, conn: conn.id }
}

describe('addDetailItem', () => {
  it('adiciona rotas com ids legíveis e únicos', () => {
    const { scenario, api } = apiWithClient()
    const a = addDetailItem(scenario, api, 'routes', { method: 'GET', path: '/users' })
    const b = addDetailItem(a.scenario, api, 'routes', { method: 'GET', path: '/users' })
    expect([a.id, b.id]).toEqual(['get-users', 'get-users-2'])
    expect(detailItems(b.scenario.components[1]).map((i) => i.label)).toEqual([
      'GET /users',
      'GET /users',
    ])
  })

  it('ids são únicos entre seções do mesmo componente', () => {
    const { scenario, api } = apiWithClient()
    const a = addDetailItem(scenario, api, 'topics', { name: 'pedidos' })
    const b = addDetailItem(a.scenario, api, 'entities', { name: 'pedidos' })
    expect(b.id).toBe('pedidos-2')
  })
})

describe('updateComponentDetails', () => {
  it('remove seções vazias e o objeto details quando tudo fica vazio', () => {
    const { scenario, api } = apiWithClient()
    const withRoute = addDetailItem(scenario, api, 'routes', { method: 'GET', path: '/' }).scenario
    const cleared = updateComponentDetails(withRoute, api, { routes: [], notes: '  ' })
    expect('details' in cleared.components[1]).toBe(false)
  })

  it('valida o conteúdo', () => {
    const { scenario, api } = apiWithClient()
    expect(() =>
      updateComponentDetails(scenario, api, { env: [{ key: 'A' }, { key: 'A' }] }),
    ).toThrow(/duplicada/)
    expect(() =>
      // @ts-expect-error método inválido de propósito
      updateComponentDetails(scenario, api, { routes: [{ id: 'x', method: 'FETCH', path: '/' }] }),
    ).toThrow(CommandError)
  })

  it('limpa referências uses para itens removidos', () => {
    const { scenario, api, conn } = apiWithClient()
    const r = addDetailItem(scenario, api, 'routes', { method: 'POST', path: '/login' })
    const used = updateConnection(r.scenario, conn, { uses: [r.id] })
    expect(used.connections[0].uses).toEqual([r.id])
    const pruned = updateComponentDetails(used, api, { routes: [] })
    expect('uses' in pruned.connections[0]).toBe(false)
  })
})

describe('updateConnection', () => {
  it('atualiza e remove campos com valores padrão', () => {
    const { scenario, conn } = apiWithClient()
    const s = updateConnection(scenario, conn, {
      protocol: 'websocket',
      label: 'tempo real',
      direction: 'two-way',
      async: true,
    })
    expect(s.connections[0]).toMatchObject({
      protocol: 'websocket',
      label: 'tempo real',
      direction: 'two-way',
      async: true,
    })
    const reset = updateConnection(s, conn, {
      protocol: undefined,
      label: '',
      direction: 'one-way',
      async: false,
    })
    expect(reset.connections[0]).toEqual({ id: conn, source: 'cliente', target: 'servidor' })
  })

  it('rejeita uses que não existem no destino', () => {
    const { scenario, conn } = apiWithClient()
    expect(() => updateConnection(scenario, conn, { uses: ['fantasma'] })).toThrow(/fantasma/)
  })
})

describe('reverseConnection', () => {
  it('troca origem/destino e handles, descartando uses', () => {
    const { scenario, api, client } = apiWithClient()
    const c = connect(scenario, {
      source: client,
      target: api,
      sourceHandle: 'right',
      targetHandle: 'left',
    })
    const r = addDetailItem(c.scenario, api, 'routes', { method: 'GET', path: '/' })
    const used = updateConnection(r.scenario, c.id, { uses: [r.id] })
    const reversed = reverseConnection(used, c.id).connections.find((x) => x.id === c.id)
    expect(reversed).toEqual({
      id: c.id,
      source: api,
      target: client,
      layout: { sourceHandle: 'left', targetHandle: 'right' },
    })
  })
})

describe('setComponentExpanded', () => {
  it('liga e desliga sem deixar resíduo', () => {
    const { scenario, api } = apiWithClient()
    const on = setComponentExpanded(scenario, api, true)
    expect(on.components[1].layout.expanded).toBe(true)
    expect('expanded' in setComponentExpanded(on, api, false).components[1].layout).toBe(false)
  })
})

it('importação preserva o nó expandido', () => {
  const { scenario, api } = apiWithClient()
  const r = addDetailItem(scenario, api, 'routes', { method: 'GET', path: '/x' })
  const s = setComponentExpanded(r.scenario, api, true)
  expect(fromJSON(toJSON(s)).components[1].layout.expanded).toBe(true)
})

it('cenário com detalhes sobrevive a exportar/importar', () => {
  const { scenario, api, conn } = apiWithClient()
  const r = addDetailItem(scenario, api, 'routes', { method: 'GET', path: '/health' })
  const s = updateConnection(r.scenario, conn, { uses: [r.id] })
  expect(fromJSON(toJSON(s))).toEqual(s)
})
