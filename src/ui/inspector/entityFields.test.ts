import { describe, expect, it } from 'vitest'
import type { Entity } from '../../core'
import { formatFields, parseFields } from './entityFields'

describe('campos de tabela em texto', () => {
  it('mantém o formato antigo: nome e tipo', () => {
    expect(parseFields('id: uuid, email: text, nome')).toEqual([
      { name: 'id', type: 'uuid' },
      { name: 'email', type: 'text' },
      { name: 'nome' },
    ])
  })

  it('lê pk, unique, nullable e fk depois do tipo, em qualquer ordem', () => {
    expect(
      parseFields('id: uuid pk, user_id: uuid fk users.id, mail: text unique nullable'),
    ).toEqual([
      { name: 'id', type: 'uuid', pk: true },
      { name: 'user_id', type: 'uuid', fk: { entity: 'users', field: 'id' } },
      { name: 'mail', type: 'text', unique: true, nullable: true },
    ])
    expect(parseFields('x: fk users pk double precision')).toEqual([
      { name: 'x', type: 'double precision', pk: true, fk: { entity: 'users' } },
    ])
  })

  it('resolve o nome da tabela para o id', () => {
    const entities = [{ id: 'usuarios-1', name: 'Usuarios' }]
    expect(parseFields('u: uuid fk usuarios.id', entities)[0].fk).toEqual({
      entity: 'usuarios-1',
      field: 'id',
    })
  })

  it('formatar e ler de volta dá o mesmo resultado', () => {
    const e: Entity = {
      id: 'orders',
      name: 'orders',
      fields: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'user_id', type: 'uuid', fk: { entity: 'users', field: 'id' }, nullable: true },
        { name: 'code', unique: true },
      ],
    }
    expect(formatFields(e)).toBe('id: uuid pk, user_id: uuid fk users.id nullable, code: unique')
    expect(parseFields(formatFields(e))).toEqual(e.fields)
  })
})
