import { protocolLabels } from '../catalog'
import type { Component, ComponentKind, Connection, Group, Scenario } from '../model'

/** Formato do nó por tipo: [abre, fecha] em volta do rótulo entre aspas. */
const shapes: Record<ComponentKind, [string, string]> = {
  client: ['([', '])'],
  server: ['[', ']'],
  database: ['[(', ')]'],
  cache: ['[(', ')]'],
  queue: ['[[', ']]'],
  worker: ['[/', '/]'],
  gateway: ['{{', '}}'],
  storage: ['[(', ')]'],
  'ai-provider': ['(', ')'],
  'external-api': ['>', ']'],
  generic: ['[', ']'],
}

/** Texto seguro dentro de um rótulo entre aspas do Mermaid. */
function text(value: string): string {
  return value
    .replace(/"/g, '#quot;')
    .replace(/</g, '#lt;')
    .replace(/>/g, '#gt;')
    .replace(/\r?\n/g, ' ')
}

/**
 * Ids do Mermaid só aceitam alguns caracteres e algumas palavras são reservadas (`end`);
 * os ids do cenário viram identificadores seguros, com prefixo e únicos.
 */
function idMapper() {
  const used = new Set<string>()
  const map = new Map<string, string>()
  return (prefix: string, id: string) => {
    const key = `${prefix}:${id}`
    const known = map.get(key)
    if (known) return known
    const base = `${prefix}_${id.replace(/[^A-Za-z0-9_]/g, '_')}`
    let safe = base
    for (let i = 2; used.has(safe); i++) safe = `${base}_${i}`
    used.add(safe)
    map.set(key, safe)
    return safe
  }
}

export function connectionText(c: Connection): string {
  return [c.protocol && c.protocol !== 'generic' ? protocolLabels[c.protocol] : '', c.label ?? '']
    .filter(Boolean)
    .join(' · ')
}

/** Fluxograma Mermaid do cenário: componentes, grupos (subgraphs) e conexões. */
export function toMermaid(s: Scenario): string {
  const safeId = idMapper()
  const lines = ['flowchart LR']

  const node = (c: Component, indent: string) => {
    const [open, close] = shapes[c.kind] ?? shapes.generic
    const label = c.technology
      ? `${text(c.name)}<br/><small>${text(c.technology)}</small>`
      : text(c.name)
    lines.push(`${indent}${safeId('c', c.id)}${open}"${label}"${close}`)
  }

  const groupIds = new Set(s.groups.map((g) => g.id))
  const childGroups = (parent: string | undefined) =>
    s.groups.filter((g) =>
      parent ? g.parentId === parent : !g.parentId || !groupIds.has(g.parentId),
    )
  const group = (g: Group, indent: string, seen: Set<string>) => {
    if (seen.has(g.id)) return // ciclo de parentId: ignora
    seen.add(g.id)
    lines.push(`${indent}subgraph ${safeId('g', g.id)}["${text(g.name)}"]`)
    for (const child of childGroups(g.id)) group(child, `${indent}  `, seen)
    for (const c of s.components.filter((c) => c.groupId === g.id)) node(c, `${indent}  `)
    lines.push(`${indent}end`)
  }

  const seen = new Set<string>()
  for (const g of childGroups(undefined)) group(g, '  ', seen)
  for (const c of s.components.filter((c) => !c.groupId || !groupIds.has(c.groupId))) {
    node(c, '  ')
  }

  const components = new Set(s.components.map((c) => c.id))
  for (const c of s.connections) {
    if (!components.has(c.source) || !components.has(c.target)) continue
    const head = c.direction === 'two-way' ? '<' : ''
    const arrow = c.async ? `${head}-.->` : `${head}-->`
    const label = connectionText(c)
    lines.push(
      `  ${safeId('c', c.source)} ${arrow}${label ? `|"${text(label)}"|` : ''} ${safeId('c', c.target)}`,
    )
  }
  return lines.join('\n') + '\n'
}
