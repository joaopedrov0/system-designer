import type { Scenario } from './model'

/** "Banco de Dados (principal)" -> "banco-de-dados-principal" */
export function slugify(text: string): string {
  const slug = text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'item'
}

export function allIds(s: Scenario): Set<string> {
  return new Set([
    ...s.components.map((c) => c.id),
    ...s.connections.map((c) => c.id),
    ...s.groups.map((g) => g.id),
    ...s.notes.map((n) => n.id),
  ])
}

/** Id legível e único dentro do cenário: "servidor", "servidor-2", ... */
export function uniqueId(base: string, taken: Set<string>): string {
  const slug = slugify(base)
  if (!taken.has(slug)) return slug
  let n = 2
  while (taken.has(`${slug}-${n}`)) n++
  return `${slug}-${n}`
}

/** Nome único entre os componentes: "Servidor", "Servidor 2", ... */
export function uniqueName(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base} ${n}`)) n++
  return `${base} ${n}`
}
