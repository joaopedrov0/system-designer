import { MarkerType } from '@xyflow/react'
import {
  detailItems,
  protocolLabels,
  type Component,
  type Connection,
  type Group,
  type Note,
} from '../../core'
import type { ComponentFlowNode } from './ComponentNode'
import { LANE_GAP, type ConnectionFlowEdge } from './ConnectionEdge'
import type { GroupFlowNode } from './GroupNode'
import type { NoteFlowNode } from './NoteNode'
import { NOTE_SIZE } from './sizes'

export type FlowNode = ComponentFlowNode | GroupFlowNode | NoteFlowNode

interface Layoutable {
  components: Component[]
  groups: Group[]
  notes: Note[]
}

/**
 * Converte o modelo para nós do React Flow, preservando estado de UI (seleção, medidas).
 * O modelo guarda coordenadas absolutas; o React Flow quer filhos de grupo relativos ao pai.
 * Grupos vêm primeiro no array porque o React Flow exige pais antes dos filhos.
 */
export function toNodes(model: Layoutable, previous: FlowNode[] = []): FlowNode[] {
  const prev = new Map(previous.map((n) => [n.id, n]))
  const ui = (id: string) => ({
    selected: prev.get(id)?.selected,
    measured: prev.get(id)?.measured,
  })
  const groups = new Map(model.groups.map((g) => [g.id, g]))

  const groupNodes: GroupFlowNode[] = model.groups.map((g) => ({
    id: g.id,
    type: 'boundary',
    position: { x: g.layout.x, y: g.layout.y },
    width: g.layout.w,
    height: g.layout.h,
    data: { group: g },
    ...ui(g.id),
  }))

  const componentNodes: ComponentFlowNode[] = model.components.map((c) => {
    const parent = c.groupId ? groups.get(c.groupId) : undefined
    return {
      id: c.id,
      type: 'component',
      position: parent
        ? { x: c.layout.x - parent.layout.x, y: c.layout.y - parent.layout.y }
        : { x: c.layout.x, y: c.layout.y },
      parentId: parent?.id,
      data: { component: c },
      ...ui(c.id),
    }
  })

  const noteNodes: NoteFlowNode[] = model.notes.map((n) => ({
    id: n.id,
    type: 'note',
    position: { x: n.layout.x, y: n.layout.y },
    width: n.layout.w ?? NOTE_SIZE.w,
    height: n.layout.h ?? NOTE_SIZE.h,
    data: { note: n },
    ...ui(n.id),
  }))

  return [...groupNodes, ...componentNodes, ...noteNodes]
}

export function toEdges(
  connections: Connection[],
  components: Component[],
  previous: ConnectionFlowEdge[] = [],
): ConnectionFlowEdge[] {
  const prev = new Map(previous.map((e) => [e.id, e]))
  const byId = new Map(components.map((c) => [c.id, c]))
  const offsets = laneOffsets(connections)
  return connections.map((c) => {
    const auto = autoHandles(byId.get(c.source), byId.get(c.target))
    return {
      id: c.id,
      type: 'connection',
      source: c.source,
      target: c.target,
      sourceHandle: c.layout?.sourceHandle ?? auto.source,
      targetHandle: c.layout?.targetHandle ?? auto.target,
      label: edgeLabel(c, byId.get(c.target)),
      // Mão dupla vira duas faixas, cada uma com sua seta (ver ConnectionEdge).
      // Cor via variável CSS (estilo inline) para acompanhar o tema claro/escuro.
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: 'var(--color-slate-400)',
      },
      animated: c.async,
      data: { twoWay: c.direction === 'two-way', offset: offsets.get(c.id), async: c.async },
      selected: prev.get(c.id)?.selected,
    }
  })
}

/**
 * Conexões entre o mesmo par de componentes (em qualquer sentido) ganham faixas
 * paralelas em vez de se sobreporem. Uma conexão de mão dupla ocupa duas faixas.
 * Devolve o deslocamento do centro de cada conexão.
 */
export function laneOffsets(connections: Connection[]): Map<string, number> {
  const pairs = new Map<string, Connection[]>()
  for (const c of connections) {
    const key = [c.source, c.target].sort().join('\u0000')
    pairs.set(key, [...(pairs.get(key) ?? []), c])
  }
  const offsets = new Map<string, number>()
  for (const group of pairs.values()) {
    const widths = group.map((c) => (c.direction === 'two-way' ? 2 : 1))
    const total = widths.reduce((a, b) => a + b, 0)
    let lane = 0
    group.forEach((c, i) => {
      const center = lane + (widths[i] - 1) / 2
      offsets.set(c.id, (center - (total - 1) / 2) * LANE_GAP)
      lane += widths[i]
    })
  }
  return offsets
}

/**
 * Conexões sem alça definida (vindas de JSON, de uma IA ou do auto-layout) saem pelo
 * lado voltado para o destino, em vez de sempre pela alça de cima.
 */
function autoHandles(
  source: Component | undefined,
  target: Component | undefined,
): { source?: string; target?: string } {
  if (!source || !target) return {}
  const dx = target.layout.x - source.layout.x
  const dy = target.layout.y - source.layout.y
  // Nós são mais largos que altos; pondera para preferir ligações horizontais.
  if (Math.abs(dx) >= Math.abs(dy) * 1.5) {
    return dx >= 0 ? { source: 'right', target: 'left' } : { source: 'left', target: 'right' }
  }
  return dy >= 0 ? { source: 'bottom', target: 'top' } : { source: 'top', target: 'bottom' }
}

/** "HTTP · POST /login", "SQL · 3 itens", "autentica"... */
function edgeLabel(c: Connection, target: Component | undefined): string | undefined {
  const parts: string[] = []
  if (c.label) parts.push(c.label)
  else if (c.protocol && c.protocol !== 'generic') parts.push(protocolLabels[c.protocol])
  if (c.uses?.length && target) {
    const items = detailItems(target).filter((i) => c.uses!.includes(i.id))
    parts.push(items.length === 1 ? items[0].label : `${items.length} itens`)
  }
  return parts.length ? parts.join(' · ') : undefined
}

/** Grupo (o menor) que contém o centro de um retângulo, ignorando os ids informados. */
export function containingGroup(
  groups: Group[],
  rect: { x: number; y: number; width: number; height: number },
  ignore: Set<string> = new Set(),
): Group | undefined {
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  return groups
    .filter((g) => !ignore.has(g.id))
    .filter((g) => cx >= g.layout.x && cx <= g.layout.x + g.layout.w)
    .filter((g) => cy >= g.layout.y && cy <= g.layout.y + g.layout.h)
    .sort((a, b) => a.layout.w * a.layout.h - b.layout.w * b.layout.h)[0]
}
