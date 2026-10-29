import { describe, expect, it } from 'vitest'
import type { Component, Scenario } from './model'
import { formatValidation, validateScenario } from './validate'

const comp = (id: string, x: number, extra: Partial<Component> = {}): Component => ({
  id,
  kind: 'server',
  name: id,
  layout: { x, y: 0 },
  ...extra,
})

const scenario = (patch: Partial<Scenario>): Scenario => ({
  schemaVersion: 1,
  id: 's',
  name: 'S',
  createdAt: '',
  updatedAt: '',
  components: [],
  connections: [],
  groups: [],
  notes: [],
  ...patch,
})

const messages = (s: Scenario, level: 'error' | 'warning') =>
  validateScenario(s)
    .filter((i) => i.level === level)
    .map((i) => i.message)

describe('validateScenario', () => {
  it('cenário consistente não gera nada', () => {
    const s = scenario({
      components: [comp('a', 0), comp('b', 400)],
      connections: [{ id: 'ab', source: 'a', target: 'b' }],
    })
    expect(validateScenario(s)).toEqual([])
    expect(formatValidation([])).toBe('Nenhum problema encontrado.')
  })

  it('erros: referências quebradas, ids repetidos, segredo com valor, ciclo de grupos', () => {
    const s = scenario({
      components: [
        comp('a', 0, { groupId: 'sumiu' }),
        comp('b', 400, {
          details: {
            routes: [
              { id: 'r', method: 'GET', path: '/' },
              { id: 'r', method: 'POST', path: '/' },
            ],
            env: [{ key: 'TOKEN', value: 'abc', secret: true }],
          },
        }),
      ],
      connections: [
        { id: 'ab', source: 'a', target: 'b', uses: ['r', 'x'] },
        { id: 'ab', source: 'a', target: 'nada' },
      ],
      groups: [
        { id: 'g1', name: 'G1', parentId: 'g2', layout: { x: 0, y: 0, w: 1, h: 1 } },
        { id: 'g2', name: 'G2', parentId: 'g1', layout: { x: 0, y: 0, w: 1, h: 1 } },
      ],
      notes: [{ id: 'a', text: '', layout: { x: 0, y: 500 } }],
    })
    const errors = messages(s, 'error')
    expect(errors).toEqual(
      expect.arrayContaining([
        'Id repetido entre componentes/grupos/notas: "a".',
        'Id de conexão repetido: "ab".',
        '"a" aponta para um grupo inexistente: "sumiu".',
        'A conexão "ab" chega a um componente inexistente: "nada".',
        'A conexão "ab" usa itens que "b" não tem: x.',
        '"b" tem dois itens em routes com o id "r".',
        'A variável secreta "TOKEN" de "b" guarda um valor; segredos não devem ter valor.',
        'Os grupos formam um ciclo de pais a partir de "g1".',
      ]),
    )
  })

  it('avisos: conexão repetida, sem conexão, fora do grupo, sobreposição, seção do tipo', () => {
    const s = scenario({
      components: [
        comp('a', 0, { groupId: 'g' }),
        comp('b', 400),
        comp('c', 410),
        comp('solto', 2000, {
          kind: 'client',
          details: { routes: [], models: [{ id: 'm', name: 'gpt' }] },
        }),
      ],
      connections: [
        { id: 'ab', source: 'a', target: 'b', protocol: 'http' },
        { id: 'ab-2', source: 'a', target: 'b', protocol: 'http' },
        { id: 'bc', source: 'b', target: 'c' },
      ],
      groups: [{ id: 'g', name: 'G', layout: { x: 1000, y: 1000, w: 300, h: 200 } }],
    })
    expect(messages(s, 'error')).toEqual([])
    expect(messages(s, 'warning')).toEqual(
      expect.arrayContaining([
        'As conexões "ab" e "ab-2" repetem origem, destino e protocolo; talvez sejam a mesma.',
        '"solto" não tem nenhuma conexão.',
        '"a" pertence ao grupo "g", mas está desenhado fora dele.',
        '"b" e "c" estão sobrepostos no desenho (use auto_layout).',
        '"solto" (Cliente) tem models, que esse tipo não usa.',
      ]),
    )
    expect(formatValidation(validateScenario(s))).toMatch(/^Avisos \(5\):\n- /)
  })
})
