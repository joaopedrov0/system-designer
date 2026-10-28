import { describe, expect, it } from 'vitest'
import { addComponent, connect, createScenario } from '../commands'
import { ImportError } from '../errors'
import { fromJSON, toJSON } from './json'

function sample() {
  const a = addComponent(createScenario('Loja'), { kind: 'client', position: { x: 0, y: 0 } })
  const b = addComponent(a.scenario, {
    kind: 'server',
    position: { x: 300, y: 0 },
    technology: 'Node',
  })
  return connect(b.scenario, { source: a.id, target: b.id, protocol: 'http' }).scenario
}

describe('JSON', () => {
  it('exportar e importar devolve o mesmo cenário', () => {
    const s = sample()
    expect(fromJSON(toJSON(s))).toEqual(s)
  })

  it('aceita um JSON mínimo escrito à mão (sem schemaVersion nem listas vazias)', () => {
    const s = fromJSON(
      JSON.stringify({
        id: 'x',
        name: 'Mínimo',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        components: [{ id: 'api', kind: 'server', name: 'API', layout: { x: 0, y: 0 } }],
      }),
    )
    expect(s.schemaVersion).toBe(1)
    expect(s.connections).toEqual([])
    expect(s.components[0].name).toBe('API')
  })

  it('rejeita texto que não é JSON', () => {
    expect(() => fromJSON('{nope')).toThrow(ImportError)
  })

  it('rejeita forma inválida', () => {
    const bad = {
      ...sample(),
      components: [{ id: 'a', kind: 'nave-espacial', name: 'A', layout: { x: 0, y: 0 } }],
    }
    expect(() => fromJSON(JSON.stringify(bad))).toThrow(/Cenário inválido/)
  })

  it('rejeita conexão para componente inexistente', () => {
    const s = sample()
    const bad = { ...s, connections: [{ id: 'c', source: 'cliente', target: 'fantasma' }] }
    expect(() => fromJSON(JSON.stringify(bad))).toThrow(/destino "fantasma" não existe/)
  })

  it('rejeita ids duplicados', () => {
    const s = sample()
    const bad = { ...s, components: [...s.components, s.components[0]] }
    expect(() => fromJSON(JSON.stringify(bad))).toThrow(/Id duplicado/)
  })

  it('rejeita versão do formato mais nova que a suportada', () => {
    expect(() => fromJSON(JSON.stringify({ ...sample(), schemaVersion: 99 }))).toThrow(/mais nova/)
  })
})
