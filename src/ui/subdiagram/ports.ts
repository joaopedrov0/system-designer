import type { Point } from '../../core'
import type { EdgePorts } from '../canvas/edgeGeometry'

/** Distância entre pontas de ligações diferentes que saem pela mesma alça. */
export const SUB_PORT_GAP = 14

export interface SidedLink {
  id: string
  from: string
  to: string
  sides: { source: string; target: string }
}

/**
 * Mesma ideia do canvas principal (portLayout): ligações que dividem a alça de um nó
 * ganham pontos distintos ao longo dela, ordenados pela posição do outro nó, para não
 * saírem todas do mesmo ponto nem se cruzarem logo na saída.
 */
export function subdiagramPorts(
  links: SidedLink[],
  positions: Map<string, Point>,
): Map<string, EdgePorts> {
  const groups = new Map<string, { id: string; end: 'source' | 'target'; other: string }[]>()
  for (const l of links) {
    for (const end of ['source', 'target'] as const) {
      const node = end === 'source' ? l.from : l.to
      const key = `${node}\u0000${l.sides[end]}`
      groups.set(key, [
        ...(groups.get(key) ?? []),
        { id: l.id, end, other: end === 'source' ? l.to : l.from },
      ])
    }
  }
  const ports = new Map<string, EdgePorts>()
  for (const [key, ends] of groups) {
    if (ends.length < 2) continue
    const lateral = /(left|right)$/.test(key)
    const along = (id: string) => {
      const p = positions.get(id) ?? { x: 0, y: 0 }
      return lateral ? p.y : p.x
    }
    const sorted = [...ends].sort(
      (a, b) => along(a.other) - along(b.other) || a.id.localeCompare(b.id),
    )
    sorted.forEach((e, i) => {
      const p = ports.get(e.id) ?? { source: 0, target: 0 }
      p[e.end] = (i - (sorted.length - 1) / 2) * SUB_PORT_GAP
      ports.set(e.id, p)
    })
  }
  return ports
}
