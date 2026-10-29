import type { Entity } from '../../core'

/** Campos de tabela como texto editável: "id: uuid, email: text". */
export function formatFields(e: Entity): string {
  return (e.fields ?? []).map((f) => (f.type ? `${f.name}: ${f.type}` : f.name)).join(', ')
}

/** "id: uuid, email: text, nome" -> [{name:'id',type:'uuid'}, ...] */
export function parseFields(text: string): NonNullable<Entity['fields']> {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, ...type] = part.split(':')
      const t = type.join(':').trim()
      return t ? { name: name.trim(), type: t } : { name: name.trim() }
    })
    .filter((f) => f.name)
}

export function withFields(e: Entity, fields: NonNullable<Entity['fields']>): Entity {
  const next: Entity = { ...e, fields }
  if (fields.length === 0) delete next.fields
  return next
}
