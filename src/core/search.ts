import { componentCatalog } from './catalog'
import { detailItems } from './details'
import type { Component, ComponentKind } from './model'

const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/**
 * Ids dos componentes que casam com o texto e o tipo. Procura em nome, id, tecnologia,
 * descrição, tags, rótulo do tipo e detalhes (rotas, tabelas, modelos, tópicos, variáveis).
 * Retorna `null` quando não há filtro ativo.
 */
export function searchComponents(
  components: Component[],
  text: string,
  kind: ComponentKind | 'all' = 'all',
): Set<string> | null {
  const terms = normalize(text).split(/\s+/).filter(Boolean)
  if (terms.length === 0 && kind === 'all') return null

  const matches = new Set<string>()
  for (const c of components) {
    if (kind !== 'all' && c.kind !== kind) continue
    const haystack = normalize(
      [
        c.name,
        c.id,
        c.technology,
        c.description,
        componentCatalog[c.kind].label,
        ...(c.tags ?? []),
        ...detailItems(c).map((i) => i.label),
        ...(c.details?.env ?? []).map((e) => e.key),
      ]
        .filter(Boolean)
        .join(' '),
    )
    if (terms.every((t) => haystack.includes(t))) matches.add(c.id)
  }
  return matches
}
