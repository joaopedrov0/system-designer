import { describe, expect, it } from 'vitest'
import { addComponent, addDetailItem, createScenario, updateComponentDetails } from './commands'
import { toMarkdown } from './export/markdown'
import type { Scenario } from './model'
import {
  addSubdiagramLink,
  moveSubdiagramNodes,
  removeSubdiagramLinks,
  removeSubdiagramNodes,
  subdiagramOf,
  updateSubdiagramLink,
} from './subdiagram'
import { validateScenario } from './validate'

function withItems(kind: 'client' | 'database', section: 'screens' | 'entities', names: string[]) {
  const created = addComponent(createScenario('T'), { kind, position: { x: 0, y: 0 } })
  const id = created.id
  let s = created.scenario
  const ids: string[] = []
  for (const name of names) {
    const r = addDetailItem(s, id, section, { name })
    s = r.scenario
    ids.push(r.id)
  }
  return { s, id, ids }
}

const comp = (s: Scenario, id: string) => s.components.find((c) => c.id === id)!

describe('diagrama interno', () => {
  it('cliente: navegação entre telas, com seta e ação', () => {
    const { s, id, ids } = withItems('client', 'screens', ['Home', 'Login'])
    const r = addSubdiagramLink(s, id, { from: ids[0], to: ids[1], label: ' entrar ' })
    const sub = subdiagramOf(comp(r.scenario, id))!
    expect(sub.def.directed).toBe(true)
    expect(sub.links).toEqual([{ id: r.id, from: 'home', to: 'login', label: 'entrar' }])
    expect(toMarkdown(r.scenario)).toContain('- Home → Login (entrar)')
  })

  it('banco: relacionamento com cardinalidade; cliente ignora cardinalidade', () => {
    const db = withItems('database', 'entities', ['pedidos', 'itens'])
    const r = addSubdiagramLink(db.s, db.id, { from: 'pedidos', to: 'itens', cardinality: '1:N' })
    expect(subdiagramOf(comp(r.scenario, db.id))!.links[0].cardinality).toBe('1:N')
    expect(toMarkdown(r.scenario)).toContain('- pedidos 1:N itens')

    const cli = withItems('client', 'screens', ['A', 'B'])
    const c = addSubdiagramLink(cli.s, cli.id, { from: 'a', to: 'b', cardinality: 'N:N' })
    expect(subdiagramOf(comp(c.scenario, cli.id))!.links[0]).not.toHaveProperty('cardinality')
  })

  it('recusa pontas inexistentes e tipos sem diagrama interno', () => {
    const { s, id } = withItems('client', 'screens', ['Home'])
    expect(() => addSubdiagramLink(s, id, { from: 'home', to: 'nada' })).toThrow(
      /não tem a tela "nada"/,
    )
    const srv = addComponent(s, { kind: 'cache', position: { x: 0, y: 0 } })
    expect(() => addSubdiagramLink(srv.scenario, srv.id, { from: 'a', to: 'b' })).toThrow(
      /não tem diagrama interno/,
    )
  })

  it('ids das ligações são únicos (duas navegações iguais ganham ids diferentes)', () => {
    const { s, id } = withItems('client', 'screens', ['A', 'B'])
    const one = addSubdiagramLink(s, id, { from: 'a', to: 'b', label: 'x' })
    const two = addSubdiagramLink(one.scenario, id, { from: 'a', to: 'b', label: 'y' })
    expect(one.id).not.toBe(two.id)
  })

  it('remover uma tabela leva os relacionamentos dela junto (também pela lista)', () => {
    const { s, id } = withItems('database', 'entities', ['a', 'b', 'c'])
    let next = addSubdiagramLink(s, id, { from: 'a', to: 'b' }).scenario
    next = addSubdiagramLink(next, id, { from: 'b', to: 'c' }).scenario
    const byNode = removeSubdiagramNodes(next, id, ['a'])
    expect(subdiagramOf(comp(byNode, id))!.links.map((l) => l.from)).toEqual(['b'])
    // Pelo inspector (lista de tabelas), a limpeza é a mesma.
    const byList = updateComponentDetails(next, id, { entities: [] })
    expect(comp(byList, id).details).toBeUndefined()
    expect(validateScenario(byNode).filter((i) => i.level === 'error')).toEqual([])
  })

  it('editar, inverter e remover ligações; mover nós', () => {
    const { s, id } = withItems('database', 'entities', ['a', 'b'])
    const r = addSubdiagramLink(s, id, { from: 'a', to: 'b', cardinality: '1:1', label: 'tem' })
    let next = updateSubdiagramLink(r.scenario, id, r.id, {
      reverse: true,
      label: '',
      cardinality: 'N:N',
    })
    expect(subdiagramOf(comp(next, id))!.links[0]).toEqual({
      id: r.id,
      from: 'b',
      to: 'a',
      cardinality: 'N:N',
    })
    next = moveSubdiagramNodes(next, id, [{ id: 'b', x: 10.4, y: 20.6 }])
    expect(comp(next, id).details!.entities![1].layout).toEqual({ x: 10, y: 21 })
    next = removeSubdiagramLinks(next, id, [r.id])
    expect(comp(next, id).details!.relations).toBeUndefined()
    expect(() => removeSubdiagramLinks(next, id, ['x'])).toThrow(/não encontradas/)
  })

  it('validação aponta ligação quebrada vinda de um arquivo editado à mão', () => {
    const { s, id } = withItems('client', 'screens', ['A'])
    const broken: Scenario = {
      ...s,
      components: s.components.map((c) =>
        c.id === id
          ? { ...c, details: { ...c.details, navigation: [{ id: 'x', from: 'a', to: 'z' }] } }
          : c,
      ),
    }
    expect(validateScenario(broken).map((i) => i.message)).toContain(
      `A ligação "x" de "${id}" aponta para tela inexistente: z.`,
    )
  })
})
