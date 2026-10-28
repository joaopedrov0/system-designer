import { describe, expect, it } from 'vitest'
import {
  addComponent,
  connect,
  createScenario,
  moveComponents,
  removeElements,
  renameScenario,
  updateComponent,
} from './commands'
import { CommandError } from './errors'
import { ScenarioSchema } from './schema'

const at = { x: 0, y: 0 }

function clientServer() {
  const a = addComponent(createScenario('Teste'), { kind: 'client', position: at })
  const b = addComponent(a.scenario, { kind: 'server', position: { x: 300, y: 0 } })
  return { scenario: b.scenario, client: a.id, server: b.id }
}

describe('createScenario', () => {
  it('cria um cenário vazio e válido', () => {
    const s = createScenario('Meu sistema', new Date('2026-01-01T00:00:00Z'))
    expect(ScenarioSchema.parse(s)).toEqual(s)
    expect(s.createdAt).toBe('2026-01-01T00:00:00.000Z')
    expect(s.components).toEqual([])
  })

  it('rejeita nome vazio', () => {
    expect(() => createScenario('  ')).toThrow(CommandError)
  })
})

describe('addComponent', () => {
  it('usa o nome padrão do catálogo e gera id legível', () => {
    const { scenario, id } = addComponent(createScenario(), { kind: 'database', position: at })
    expect(id).toBe('banco-de-dados')
    expect(scenario.components[0]).toEqual({
      id: 'banco-de-dados',
      kind: 'database',
      name: 'Banco de dados',
      layout: { x: 0, y: 0 },
    })
  })

  it('garante nomes e ids únicos', () => {
    let s = createScenario()
    const ids: string[] = []
    for (let i = 0; i < 3; i++) {
      const r = addComponent(s, { kind: 'server', position: at })
      s = r.scenario
      ids.push(r.id)
    }
    expect(ids).toEqual(['servidor', 'servidor-2', 'servidor-3'])
    expect(s.components.map((c) => c.name)).toEqual(['Servidor', 'Servidor 2', 'Servidor 3'])
  })

  it('aceita nome e tecnologia e não altera o cenário original', () => {
    const original = createScenario()
    const { scenario } = addComponent(original, {
      kind: 'database',
      position: at,
      name: 'Postgres Principal',
      technology: ' PostgreSQL 16 ',
    })
    expect(scenario.components[0]).toMatchObject({
      id: 'postgres-principal',
      technology: 'PostgreSQL 16',
    })
    expect(original.components).toHaveLength(0)
  })
})

describe('updateComponent', () => {
  it('renomeia sem mudar o id', () => {
    const { scenario, server } = clientServer()
    const next = updateComponent(scenario, server, { name: 'API' })
    expect(next.components[1]).toMatchObject({ id: server, name: 'API' })
  })

  it('remove campos opcionais vazios', () => {
    const { scenario, server } = clientServer()
    const withTech = updateComponent(scenario, server, { technology: 'Node.js' })
    expect(withTech.components[1].technology).toBe('Node.js')
    const cleared = updateComponent(withTech, server, { technology: '' })
    expect('technology' in cleared.components[1]).toBe(false)
  })

  it('rejeita nome vazio e id inexistente', () => {
    const { scenario, server } = clientServer()
    expect(() => updateComponent(scenario, server, { name: '' })).toThrow(CommandError)
    expect(() => updateComponent(scenario, 'nao-existe', { name: 'x' })).toThrow(CommandError)
  })
})

describe('moveComponents', () => {
  it('move vários componentes de uma vez', () => {
    const { scenario, client, server } = clientServer()
    const next = moveComponents(scenario, [
      { id: client, x: 10, y: 20 },
      { id: server, x: 30, y: 40 },
    ])
    expect(next.components.map((c) => c.layout)).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ])
  })
})

describe('connect', () => {
  it('conecta dois componentes', () => {
    const { scenario, client, server } = clientServer()
    const { scenario: next, id } = connect(scenario, {
      source: client,
      target: server,
      protocol: 'http',
    })
    expect(id).toBe('cliente-servidor')
    expect(next.connections).toEqual([{ id, source: client, target: server, protocol: 'http' }])
  })

  it('permite várias conexões entre o mesmo par, com ids distintos', () => {
    const { scenario, client, server } = clientServer()
    const a = connect(scenario, { source: client, target: server })
    const b = connect(a.scenario, { source: client, target: server, protocol: 'websocket' })
    expect(a.id).not.toBe(b.id)
  })

  it('rejeita auto-conexão e componentes inexistentes', () => {
    const { scenario, client } = clientServer()
    expect(() => connect(scenario, { source: client, target: client })).toThrow(CommandError)
    expect(() => connect(scenario, { source: client, target: 'x' })).toThrow(CommandError)
  })
})

describe('removeElements', () => {
  it('remove componente junto com suas conexões', () => {
    const { scenario, client, server } = clientServer()
    const { scenario: connected } = connect(scenario, { source: client, target: server })
    const next = removeElements(connected, { componentIds: [server] })
    expect(next.components.map((c) => c.id)).toEqual([client])
    expect(next.connections).toEqual([])
  })

  it('remove só a conexão', () => {
    const { scenario, client, server } = clientServer()
    const { scenario: connected, id } = connect(scenario, { source: client, target: server })
    const next = removeElements(connected, { connectionIds: [id] })
    expect(next.components).toHaveLength(2)
    expect(next.connections).toEqual([])
  })
})

describe('renameScenario', () => {
  it('renomeia e rejeita vazio', () => {
    const s = createScenario()
    expect(renameScenario(s, ' Loja ').name).toBe('Loja')
    expect(() => renameScenario(s, '')).toThrow(CommandError)
  })
})
