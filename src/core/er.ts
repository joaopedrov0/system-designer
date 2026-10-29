import type { Cardinality } from './subdiagram'
import type { ComponentDetails, Entity } from './model'

/**
 * Relacionamento deduzido de uma chave estrangeira. Não é guardado: é calculado a partir
 * dos campos, então nunca fica dessincronizado. `relations` continua valendo para o que
 * não é FK, e uma relação manual entre as mesmas tabelas tem prioridade.
 */
export interface DerivedRelation {
  id: string
  /** Tabela referenciada (o lado "1"). */
  from: string
  /** Tabela que guarda a FK. */
  to: string
  cardinality: Cardinality
  /** Nome do campo que guarda a FK. */
  label: string
}

/**
 * FK simples: 1:N (uma linha referenciada, muitas que a referenciam). FK `unique`, ou que é a
 * única PK da tabela, vira 1:1. FKs de uma tabela para ela mesma não entram: o mini canvas
 * não desenha laço, e a validação ainda confere a referência.
 */
export function derivedRelations(
  d: Pick<ComponentDetails, 'entities' | 'relations'>,
): DerivedRelation[] {
  const entities = d.entities ?? []
  const ids = new Set(entities.map((e) => e.id))
  const manual = new Set(
    (d.relations ?? []).flatMap((r) => [`${r.from}\u0000${r.to}`, `${r.to}\u0000${r.from}`]),
  )
  const out: DerivedRelation[] = []
  for (const e of entities) {
    const pks = (e.fields ?? []).filter((f) => f.pk)
    for (const f of e.fields ?? []) {
      if (!f.fk || f.fk.entity === e.id || !ids.has(f.fk.entity)) continue
      if (manual.has(`${f.fk.entity}\u0000${e.id}`)) continue
      const oneToOne = f.unique || (f.pk && pks.length === 1)
      out.push({
        id: `fk:${e.id}.${f.name}`,
        from: f.fk.entity,
        to: e.id,
        cardinality: oneToOne ? '1:1' : '1:N',
        label: f.name,
      })
    }
  }
  return out
}

/**
 * Tabelas de junção (N:N): exatamente duas FKs para tabelas diferentes e nada além delas,
 * a não ser uma PK própria; ou as duas FKs formam a PK composta. Devolve id da junção -> as
 * duas tabelas que ela liga.
 */
export function junctionTables(
  d: Pick<ComponentDetails, 'entities'>,
): Map<string, [string, string]> {
  const entities = d.entities ?? []
  const ids = new Set(entities.map((e) => e.id))
  const out = new Map<string, [string, string]>()
  for (const e of entities) {
    const fields = e.fields ?? []
    const fks = fields.filter((f) => f.fk && ids.has(f.fk.entity))
    if (fks.length !== 2 || fks[0].fk!.entity === fks[1].fk!.entity) continue
    const others = fields.filter((f) => !f.fk)
    const compositePk = fks.every((f) => f.pk)
    if (compositePk || others.every((f) => f.pk))
      out.set(e.id, [fks[0].fk!.entity, fks[1].fk!.entity])
  }
  return out
}

/** Campo que uma FK referencia: o indicado, senão a PK da tabela referenciada. */
export function referencedField(target: Entity, field?: string) {
  const fields = target.fields ?? []
  return field ? fields.find((f) => f.name === field) : fields.find((f) => f.pk)
}
