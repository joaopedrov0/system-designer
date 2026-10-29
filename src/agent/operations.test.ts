import { describe, expect, it } from 'vitest'
import { createScenario, toMarkdown, type Scenario } from '../core'
import { runOperation } from './operations'

const empty = () => createScenario('Loja', new Date('2026-01-01'))

async function run(s: Scenario, name: string, input: unknown) {
  return runOperation(s, name, input)
}

describe('batch', () => {
  it('executa os passos em ordem, com referências "$N" aos ids criados', async () => {
    const r = await run(empty(), 'batch', {
      steps: [
        { op: 'add_component', input: { kind: 'server', name: 'API' } },
        { op: 'add_component', input: { kind: 'database', name: 'API' } },
        { op: 'connect', input: { source: '$1', target: '$2', protocol: 'sql' } },
        { op: 'add_group', input: { name: 'Backend', componentIds: ['$1', '$2'] } },
      ],
    })
    const s = r.scenario!
    // O segundo "API" ganha outro id: a referência é o que garante a ligação certa.
    const [api, db] = s.components
    expect(api.id).not.toBe(db.id)
    expect(db.kind).toBe('database')
    expect(s.connections).toMatchObject([{ source: api.id, target: db.id, protocol: 'sql' }])
    expect(s.components.every((c) => c.groupId === s.groups[0].id)).toBe(true)
    expect(r.text.split('\n')).toHaveLength(4)
    expect(r.text).toMatch(/^1\. Componente criado/)
  })

  it('tudo ou nada: um passo inválido não devolve cenário e diz qual falhou', async () => {
    const promise = run(empty(), 'batch', {
      steps: [
        { op: 'add_component', input: { kind: 'server' } },
        { op: 'connect', input: { source: '$1', target: 'nao-existe' } },
      ],
    })
    await expect(promise).rejects.toThrow(/Passo 2 \(connect\) falhou; nada foi gravado/)
  })

  it('recusa referências para frente, para passos sem id e batch aninhado', async () => {
    const s = empty()
    await expect(
      run(s, 'batch', { steps: [{ op: 'connect', input: { source: '$1', target: '$1' } }] }),
    ).rejects.toThrow(/precisa citar um passo anterior/)
    await expect(
      run(s, 'batch', {
        steps: [
          { op: 'set_scenario_info', input: { name: 'X' } },
          { op: 'update_component', input: { id: '$1' } },
        ],
      }),
    ).rejects.toThrow(/não criou nenhum elemento/)
    await expect(run(s, 'batch', { steps: [{ op: 'batch', input: {} }] })).rejects.toThrow(
      /não pode conter outro batch/,
    )
  })

  it('"$N" só é trocado quando é o valor inteiro', async () => {
    const r = await run(empty(), 'batch', {
      steps: [{ op: 'add_note', input: { text: 'custa $1 por mês' } }],
    })
    expect(r.scenario!.notes[0].text).toBe('custa $1 por mês')
  })
})

describe('validate_scenario', () => {
  it('cenário montado pelas operações não tem problemas', async () => {
    const r = await run(empty(), 'batch', {
      steps: [
        { op: 'add_component', input: { kind: 'server' } },
        { op: 'add_component', input: { kind: 'database' } },
        { op: 'connect', input: { source: '$1', target: '$2' } },
        { op: 'auto_layout' },
      ],
    })
    const v = await run(r.scenario!, 'validate_scenario', {})
    expect(v.text).toBe('Nenhum problema encontrado.')
    expect(v.scenario).toBeUndefined()
  })
})

describe('protocolos e variáveis', () => {
  it('aceita ipc e file, e descrição nas variáveis (que vai para o resumo)', async () => {
    let s = empty()
    for (const step of [
      { op: 'add_component', input: { kind: 'server', name: 'App' } },
      { op: 'add_component', input: { kind: 'worker', name: 'Helper' } },
      { op: 'add_component', input: { kind: 'storage', name: 'Disco' } },
    ])
      s = (await run(s, step.op, step.input)).scenario!
    s = (await run(s, 'connect', { source: 'app', target: 'helper', protocol: 'ipc' })).scenario!
    s = (await run(s, 'connect', { source: 'app', target: 'disco', protocol: 'file' })).scenario!
    s = (
      await run(s, 'set_component_details', {
        componentId: 'app',
        env: [{ key: 'DATA_DIR', value: '/data', description: 'pasta montada no volume' }],
      })
    ).scenario!
    const md = toMarkdown(s)
    expect(md).toContain('| IPC |')
    expect(md).toContain('| Arquivo |')
    expect(md).toContain('`DATA_DIR` = `/data` — pasta montada no volume')
  })
})
