import type { Entity } from '../../core'

type Field = NonNullable<Entity['fields']>[number]

/**
 * Campos de tabela como texto editável: "id: uuid pk, user_id: uuid fk users.id,
 * email: text unique nullable". Depois do tipo vêm marcas opcionais, em qualquer ordem.
 */
export function formatFields(e: Entity): string {
  return (e.fields ?? [])
    .map((f) => {
      const rest = [
        f.type,
        f.pk && 'pk',
        f.fk && `fk ${f.fk.entity}${f.fk.field ? `.${f.fk.field}` : ''}`,
        f.unique && 'unique',
        f.nullable && 'nullable',
      ].filter(Boolean)
      return rest.length ? `${f.name}: ${rest.join(' ')}` : f.name
    })
    .join(', ')
}

/**
 * "id: uuid pk, user_id: uuid fk users.id, nome" -> campos. O alvo de `fk` é o id da tabela
 * ou, se `entities` for informado, o nome dela (sem diferenciar maiúsculas).
 */
export function parseFields(text: string, entities: Pick<Entity, 'id' | 'name'>[] = []): Field[] {
  const resolve = (token: string) => {
    const [name, ...field] = token.split('.')
    const hit =
      entities.find((x) => x.id === name) ??
      entities.find((x) => x.name.toLowerCase() === name.toLowerCase())
    return { entity: hit?.id ?? name, ...(field.length ? { field: field.join('.') } : {}) }
  }
  return text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, ...rest] = part.split(':')
      const field: Field = { name: name.trim() }
      const type: string[] = []
      const tokens = rest.join(':').trim().split(/\s+/).filter(Boolean)
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i]
        const flag = token.toLowerCase()
        if (flag === 'pk') field.pk = true
        else if (flag === 'unique') field.unique = true
        else if (flag === 'nullable') field.nullable = true
        else if (flag === 'fk' && tokens[i + 1]) field.fk = resolve(tokens[++i])
        else type.push(token)
      }
      if (type.length) field.type = type.join(' ')
      return field
    })
    .filter((f) => f.name)
}

export function withFields(e: Entity, fields: NonNullable<Entity['fields']>): Entity {
  const next: Entity = { ...e, fields }
  if (fields.length === 0) delete next.fields
  return next
}
