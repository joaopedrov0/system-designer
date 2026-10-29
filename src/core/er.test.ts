import { describe, expect, it } from 'vitest'
import { derivedRelations, junctionTables } from './er'
import { toMarkdown } from './export/markdown'
import { createScenario } from './commands'
import type { ComponentDetails, Scenario } from './model'
import { validateScenario } from './validate'

const users = { id: 'users', name: 'users', fields: [{ name: 'id', type: 'uuid', pk: true }] }
const roles = { id: 'roles', name: 'roles', fields: [{ name: 'id', pk: true }] }

describe('relacionamentos deduzidos de chaves estrangeiras', () => {
  it('FK simples vira 1:N, da tabela referenciada para a que guarda a FK', () => {
    const d: ComponentDetails = {
      entities: [
        users,
        { id: 'orders', name: 'orders', fields: [{ name: 'user_id', fk: { entity: 'users' } }] },
      ],
    }
    expect(derivedRelations(d)).toEqual([
      {
        id: 'fk:orders.user_id',
        from: 'users',
        to: 'orders',
        cardinality: '1:N',
        label: 'user_id',
      },
    ])
  })

  it('FK única, ou que é a única PK, vira 1:1', () => {
    const d: ComponentDetails = {
      entities: [
        users,
        {
          id: 'profiles',
          name: 'profiles',
          fields: [{ name: 'user_id', pk: true, fk: { entity: 'users' } }],
        },
        {
          id: 'passports',
          name: 'passports',
          fields: [{ name: 'user_id', unique: true, fk: { entity: 'users' } }],
        },
      ],
    }
    expect(derivedRelations(d).map((r) => r.cardinality)).toEqual(['1:1', '1:1'])
  })

  it('relação manual entre as mesmas tabelas tem prioridade; FK para si mesma e para tabela inexistente são ignoradas', () => {
    const d: ComponentDetails = {
      entities: [
        users,
        {
          id: 'orders',
          name: 'orders',
          fields: [
            { name: 'user_id', fk: { entity: 'users' } },
            { name: 'parent_id', fk: { entity: 'orders' } },
            { name: 'x', fk: { entity: 'sumiu' } },
          ],
        },
      ],
      relations: [{ id: 'r', from: 'orders', to: 'users', cardinality: 'N:N' }],
    }
    expect(derivedRelations(d)).toEqual([])
  })

  it('tabela de junção: duas FKs formando a PK, ou só as duas FKs', () => {
    const composite = {
      id: 'user_roles',
      name: 'user_roles',
      fields: [
        { name: 'user_id', pk: true, fk: { entity: 'users' } },
        { name: 'role_id', pk: true, fk: { entity: 'roles' } },
        { name: 'since', type: 'date' },
      ],
    }
    const bare = {
      id: 'links',
      name: 'links',
      fields: [
        { name: 'id', pk: true },
        { name: 'user_id', fk: { entity: 'users' } },
        { name: 'role_id', fk: { entity: 'roles' } },
      ],
    }
    const withData = {
      id: 'orders',
      name: 'orders',
      fields: [
        { name: 'user_id', fk: { entity: 'users' } },
        { name: 'role_id', fk: { entity: 'roles' } },
        { name: 'total', type: 'numeric' },
      ],
    }
    const d: ComponentDetails = { entities: [users, roles, composite, bare, withData] }
    expect([...junctionTables(d)]).toEqual([
      ['user_roles', ['users', 'roles']],
      ['links', ['users', 'roles']],
    ])
    // Cada junção continua ligada às duas tabelas por 1:N (a junção é um nó do diagrama).
    const rels = derivedRelations(d).filter((r) => r.to === 'user_roles')
    expect(rels.map((r) => [r.from, r.cardinality])).toEqual([
      ['users', '1:N'],
      ['roles', '1:N'],
    ])
  })
})

function dbScenario(entities: NonNullable<ComponentDetails['entities']>): Scenario {
  const s = createScenario('T')
  return {
    ...s,
    components: [
      { id: 'db', kind: 'database', name: 'DB', layout: { x: 0, y: 0 }, details: { entities } },
    ],
  }
}

describe('validação de chaves', () => {
  const messages = (s: Scenario, level: 'error' | 'warning') =>
    validateScenario(s)
      .filter((i) => i.level === level)
      .map((i) => i.message)

  it('FK para tabela ou campo inexistente é erro', () => {
    const s = dbScenario([
      users,
      {
        id: 'orders',
        name: 'orders',
        fields: [
          { name: 'a', fk: { entity: 'sumiu' } },
          { name: 'b', fk: { entity: 'users', field: 'nada' } },
          { name: 'c', fk: { entity: 'users', field: 'id' } },
        ],
      },
    ])
    const errors = messages(s, 'error')
    expect(errors).toHaveLength(2)
    expect(errors[0]).toContain('"sumiu"')
    expect(errors[1]).toContain('users.nada')
  })

  it('tabela sem PK só avisa quando o banco já marca PKs', () => {
    const noPk = { id: 'logs', name: 'logs', fields: [{ name: 'msg' }] }
    expect(messages(dbScenario([noPk]), 'warning').filter((m) => m.includes('chave'))).toEqual([])
    expect(
      messages(dbScenario([users, noPk]), 'warning').filter((m) => m.includes('chave')),
    ).toHaveLength(1)
  })
})

describe('resumo em Markdown', () => {
  it('marca PK/FK, lista o relacionamento deduzido e gera o erDiagram', () => {
    const md = toMarkdown(
      dbScenario([
        users,
        {
          id: 'orders',
          name: 'orders',
          fields: [
            { name: 'id', pk: true },
            { name: 'user_id', type: 'uuid', fk: { entity: 'users', field: 'id' } },
          ],
        },
      ]),
    )
    expect(md).toContain('id (uuid, PK)')
    expect(md).toContain('user_id (uuid, FK → users.id)')
    expect(md).toContain('- users 1:N orders (user_id)')
    expect(md).toContain('erDiagram')
    expect(md).toContain('users ||--o{ orders : "user_id"')
  })
})
