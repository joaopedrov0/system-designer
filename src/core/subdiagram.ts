import { componentCatalog } from './catalog'
import { CommandError } from './errors'
import { updateComponentDetails, type Created } from './commands'
import { uniqueId } from './ids'
import type { Component, ComponentKind, Point, Relation, Scenario } from './model'
import type { CARDINALITIES } from './schema'

/**
 * Diagrama interno de um componente (complexidade progressiva): um mini canvas cujos nós
 * são itens de uma seção de detalhes e cujas ligações ficam em outra lista dos detalhes.
 * - cliente: mapa de navegação (telas -> navegação entre telas);
 * - banco de dados: diagrama entidade-relacionamento (tabelas -> relacionamentos).
 * Servidor ainda não tem: ver docs/proposta-diagrama-servidor.md.
 */
export interface SubdiagramDefinition {
  /** Seção cujos itens são os nós. */
  nodes: 'screens' | 'entities'
  /** Lista dos detalhes que guarda as ligações. */
  links: 'navigation' | 'relations'
  title: string
  /** Nome de um nó, no singular ("tela", "tabela"). */
  node: string
  /** Ligações têm sentido (seta) ou são relacionamentos com cardinalidade. */
  directed: boolean
}

export const subdiagrams: Partial<Record<ComponentKind, SubdiagramDefinition>> = {
  client: {
    nodes: 'screens',
    links: 'navigation',
    title: 'Mapa de navegação',
    node: 'tela',
    directed: true,
  },
  database: {
    nodes: 'entities',
    links: 'relations',
    title: 'Diagrama ER',
    node: 'tabela',
    directed: false,
  },
}

export type Cardinality = (typeof CARDINALITIES)[number]

export interface SubdiagramLink {
  id: string
  from: string
  to: string
  label?: string
  cardinality?: Cardinality
}

export interface SubdiagramNode {
  id: string
  name: string
  layout?: Point
}

/** Definição, nós e ligações do diagrama interno; `undefined` se o tipo não tem um. */
export function subdiagramOf(c: Component) {
  const def = subdiagrams[c.kind]
  if (!def) return undefined
  const nodes: SubdiagramNode[] = c.details?.[def.nodes] ?? []
  const links: SubdiagramLink[] = c.details?.[def.links] ?? []
  return { def, nodes, links }
}

function subdiagramFor(s: Scenario, componentId: string) {
  const c = s.components.find((c) => c.id === componentId)
  if (!c) throw new CommandError(`Componente não encontrado: ${componentId}`)
  const sub = subdiagramOf(c)
  if (!sub) {
    const kinds = Object.keys(subdiagrams)
      .map((k) => componentCatalog[k as ComponentKind].label)
      .join(', ')
    throw new CommandError(
      `Um componente do tipo "${componentCatalog[c.kind].label}" não tem diagrama interno (só: ${kinds}).`,
    )
  }
  return sub
}

export interface LinkInput {
  from: string
  to: string
  label?: string
  cardinality?: Cardinality
}

/** Liga dois nós do diagrama interno (navegação entre telas ou relacionamento entre tabelas). */
export function addSubdiagramLink(s: Scenario, componentId: string, input: LinkInput): Created {
  const { def, nodes, links } = subdiagramFor(s, componentId)
  const ids = new Set(nodes.map((n) => n.id))
  for (const end of [input.from, input.to]) {
    if (!ids.has(end)) {
      throw new CommandError(
        `"${componentId}" não tem a ${def.node} "${end}". Disponíveis: ${[...ids].join(', ') || 'nenhuma'}.`,
      )
    }
  }
  const id = uniqueId(`${input.from}-${input.to}`, new Set(links.map((l) => l.id)))
  const link: SubdiagramLink = { id, from: input.from, to: input.to }
  if (input.label?.trim()) link.label = input.label.trim()
  if (!def.directed && input.cardinality) link.cardinality = input.cardinality
  const scenario = updateComponentDetails(s, componentId, { [def.links]: [...links, link] })
  return { scenario, id }
}

export type LinkPatch = Partial<Pick<SubdiagramLink, 'label' | 'cardinality'>> & {
  /** Troca origem e destino. */
  reverse?: boolean
}

export function updateSubdiagramLink(
  s: Scenario,
  componentId: string,
  linkId: string,
  patch: LinkPatch,
): Scenario {
  const { def, links } = subdiagramFor(s, componentId)
  if (!links.some((l) => l.id === linkId)) {
    throw new CommandError(`Ligação não encontrada em "${componentId}": ${linkId}`)
  }
  const next = links.map((l) => {
    if (l.id !== linkId) return l
    const updated: SubdiagramLink = patch.reverse ? { ...l, from: l.to, to: l.from } : { ...l }
    if (patch.label !== undefined) {
      if (patch.label.trim()) updated.label = patch.label.trim()
      else delete updated.label
    }
    if (patch.cardinality !== undefined && !def.directed) {
      updated.cardinality = patch.cardinality as Relation['cardinality']
    }
    return updated
  })
  return updateComponentDetails(s, componentId, { [def.links]: next })
}

export function removeSubdiagramLinks(s: Scenario, componentId: string, ids: string[]): Scenario {
  const { def, links } = subdiagramFor(s, componentId)
  const unknown = ids.filter((id) => !links.some((l) => l.id === id))
  if (unknown.length) throw new CommandError(`Ligações não encontradas: ${unknown.join(', ')}`)
  const remove = new Set(ids)
  return updateComponentDetails(s, componentId, {
    [def.links]: links.filter((l) => !remove.has(l.id)),
  })
}

/** Remove nós (telas/tabelas); as ligações deles vão junto. */
export function removeSubdiagramNodes(s: Scenario, componentId: string, ids: string[]): Scenario {
  const { def, nodes } = subdiagramFor(s, componentId)
  const remove = new Set(ids)
  return updateComponentDetails(s, componentId, {
    [def.nodes]: nodes.filter((n) => !remove.has(n.id)),
  })
}

/** Posiciona nós do diagrama interno (coordenadas do mini canvas). */
export function moveSubdiagramNodes(
  s: Scenario,
  componentId: string,
  moves: ({ id: string } & Point)[],
): Scenario {
  const { def, nodes } = subdiagramFor(s, componentId)
  const at = new Map(moves.map((m) => [m.id, { x: Math.round(m.x), y: Math.round(m.y) }]))
  const unknown = moves.filter((m) => !nodes.some((n) => n.id === m.id)).map((m) => m.id)
  if (unknown.length) throw new CommandError(`Itens não encontrados: ${unknown.join(', ')}`)
  return updateComponentDetails(s, componentId, {
    [def.nodes]: nodes.map((n) => (at.has(n.id) ? { ...n, layout: at.get(n.id)! } : n)),
  })
}

/** Posição padrão de um nó sem layout: grade de 3 colunas, na ordem da lista. */
export function defaultNodePosition(index: number): Point {
  return { x: (index % 3) * 220, y: Math.floor(index / 3) * 170 }
}
