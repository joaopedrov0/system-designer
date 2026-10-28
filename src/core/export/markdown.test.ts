import { describe, expect, it } from 'vitest'
import {
  addComponent,
  addDetailItem,
  addGroup,
  addNote,
  connect,
  createScenario,
  updateComponent,
  updateComponentDetails,
  updateConnection,
} from '../commands'
import { toMarkdown } from './markdown'
import { toMermaid } from './mermaid'

function sample() {
  let s = createScenario('Loja')
  s = { ...s, description: 'Uma loja simples.' }
  const g = addGroup(s, { name: 'Backend', layout: { x: 200, y: -50, w: 400, h: 300 } })
  const web = addComponent(g.scenario, { kind: 'client', position: { x: 0, y: 0 }, name: 'Web' })
  const api = addComponent(web.scenario, {
    kind: 'server',
    position: { x: 300, y: 0 },
    name: 'API "v2"',
    technology: 'Node 22',
    groupId: g.id,
  })
  const db = addComponent(api.scenario, { kind: 'database', position: { x: 600, y: 0 } })
  const end = addComponent(db.scenario, { kind: 'queue', position: { x: 0, y: 300 }, name: 'end' })
  s = end.scenario
  const route = addDetailItem(s, api.id, 'routes', { method: 'GET', path: '/a|b' })
  s = updateComponentDetails(route.scenario, api.id, {
    env: [
      { key: 'DATABASE_URL', secret: true },
      { key: 'PORT', value: '3000' },
    ],
  })
  s = updateComponent(s, api.id, { tags: ['core'] })
  const c1 = connect(s, { source: web.id, target: api.id, protocol: 'http', label: 'pedidos' })
  s = updateConnection(c1.scenario, c1.id, { uses: [route.id], direction: 'two-way' })
  const c2 = connect(s, { source: api.id, target: end.id, protocol: 'event' })
  s = updateConnection(c2.scenario, c2.id, { async: true })
  s = addNote(s, { layout: { x: 0, y: 500 }, text: 'Revisar\ncache' }).scenario
  return { s, ids: { web: web.id, api: api.id, db: db.id, end: end.id, group: g.id } }
}

describe('Mermaid', () => {
  it('gera nós por tipo, subgraphs de grupo e setas por sentido/assincronia', () => {
    const { s } = sample()
    const m = toMermaid(s)
    expect(m.startsWith('flowchart LR\n')).toBe(true)
    expect(m).toContain('subgraph g_backend["Backend"]')
    // Aspas e < > do nome escapados; tecnologia numa segunda linha.
    expect(m).toContain('c_api_v2["API #quot;v2#quot;<br/><small>Node 22</small>"]')
    expect(m).toContain('c_banco_de_dados[("Banco de dados")]')
    // "end" é palavra reservada do Mermaid: o prefixo evita o conflito.
    expect(m).toContain('c_end[["end"]]')
    expect(m).toContain('c_web <-->|"HTTP · pedidos"| c_api_v2')
    expect(m).toContain('c_api_v2 -.->|"Evento"| c_end')
  })

  it('o componente do grupo fica dentro do subgraph', () => {
    const lines = toMermaid(sample().s).split('\n')
    const open = lines.findIndex((l) => l.includes('subgraph g_backend'))
    const close = lines.indexOf('  end', open)
    const api = lines.findIndex((l) => l.includes('c_api_v2['))
    expect(api).toBeGreaterThan(open)
    expect(api).toBeLessThan(close)
  })
})

describe('Markdown', () => {
  it('resume componentes, detalhes, conexões, grupos e notas com os ids', () => {
    const { s, ids } = sample()
    const md = toMarkdown(s)
    expect(md).toMatch(/^# Loja\n\nUma loja simples\./)
    expect(md).toContain('```mermaid\nflowchart LR')
    expect(md).toContain('### API "v2"')
    expect(md).toContain(`- **Id:** \`${ids.api}\``)
    expect(md).toContain('- **Tecnologia:** Node 22')
    expect(md).toContain('- **Grupo:** Backend')
    expect(md).toContain('- **Tags:** core')
    // `|` dentro da célula é escapado.
    expect(md).toContain('| GET | `/a\\|b` |')
    // Segredo sem valor; variável comum com valor.
    expect(md).toContain('- `DATABASE_URL` (segredo)')
    expect(md).toContain('- `PORT` = `3000`')
    expect(md).toMatch(/\| Web \| ↔ \| API "v2" \| HTTP \| pedidos; mão dupla \| GET \/a\\\|b \|/)
    expect(md).toMatch(/\| API "v2" \| → \| end \| Evento \| assíncrona \|/)
    expect(md).toContain('- **Backend** `backend`: API "v2"')
    expect(md).toContain('- Revisar cache')
  })

  it('cenário vazio', () => {
    expect(toMarkdown(createScenario('Nada'))).toBe('# Nada\n\n_Cenário vazio._\n')
  })
})
