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
  const { handles, shifts: ports } = portLayout(connections, components)
  return connections.map((c) => {
    return {
      id: c.id,
      type: 'connection',
      source: c.source,
      target: c.target,
      sourceHandle: handles.get(c.id)!.source,
      targetHandle: handles.get(c.id)!.target,
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
      data: {
        twoWay: c.direction === 'two-way',
        offset: offsets.get(c.id),
        ports: ports.get(c.id),
        async: c.async,
      },
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

/** Espaço extra entre os blocos de nós diferentes numa mesma alça. */
const PORT_GAP = 6
/** Folga entre a faixa da ponta e a quina do componente. */
const PORT_PAD = 12

/**
 * Faixas que cabem numa alça lateral antes de valer a pena desviar conexões para cima ou
 * para baixo (seis faixas, três mãos duplas, já deixam o componente bem mais alto).
 */
export const MAX_SIDE_LANES = 6

/**
 * Quando uma alça lateral fica cheia demais, as conexões de alça automática mais verticais
 * (vizinho mais acima ou abaixo do que ao lado) passam para as alças de cima/baixo, nas duas
 * pontas. Alças escolhidas pelo usuário nunca mudam. Altera `handles` no lugar.
 */
function balanceSides(
  connections: Connection[],
  byId: Map<string, Component>,
  handles: Map<string, { source?: string; target?: string }>,
) {
  const lanes = (c: Connection) => (c.direction === 'two-way' ? 2 : 1)
  const keyOf = (node: string, handle?: string) => `${node}\u0000${handle}`
  const load = new Map<string, number>()
  const add = (key: string, n: number) => load.set(key, (load.get(key) ?? 0) + n)
  for (const c of connections) {
    const h = handles.get(c.id)!
    add(keyOf(c.source, h.source), lanes(c))
    add(keyOf(c.target, h.target), lanes(c))
  }

  const lateral = (handle?: string) => handle === 'left' || handle === 'right'
  // Quanto mais vertical o vizinho, primeiro ele sai da lateral.
  const candidates = connections
    .filter((c) => !c.layout?.sourceHandle && !c.layout?.targetHandle)
    .filter((c) => byId.has(c.source) && byId.has(c.target))
    .map((c) => {
      const a = byId.get(c.source)!.layout
      const b = byId.get(c.target)!.layout
      const dx = b.x - a.x
      const dy = b.y - a.y
      return { c, dy, verticality: Math.abs(dy) / (Math.abs(dx) || 1) }
    })
    .sort((p, q) => q.verticality - p.verticality)

  for (const { c, dy } of candidates) {
    const h = handles.get(c.id)!
    if (!lateral(h.source) || !lateral(h.target)) continue
    const sourceKey = keyOf(c.source, h.source)
    const targetKey = keyOf(c.target, h.target)
    if (
      (load.get(sourceKey)! <= MAX_SIDE_LANES && load.get(targetKey)! <= MAX_SIDE_LANES) ||
      dy === 0
    )
      continue
    add(sourceKey, -lanes(c))
    add(targetKey, -lanes(c))
    const next = dy > 0 ? { source: 'bottom', target: 'top' } : { source: 'top', target: 'bottom' }
    handles.set(c.id, next)
    add(keyOf(c.source, next.source), lanes(c))
    add(keyOf(c.target, next.target), lanes(c))
  }
}

/** Tamanho mínimo de um componente para as faixas das suas alças caberem nele. */
export interface MinSize {
  width?: number
  height?: number
}

/**
 * Onde cada conexão encosta nos componentes:
 * - `handles`: a alça de cada ponta (a escolhida pelo usuário ou a automática);
 * - `shifts`: conexões com nós diferentes que saem pela mesma alça ganham pontos distintos
 *   ao longo dela, em vez de partirem todas do centro (e as faixas de mão dupla de uma
 *   coincidirem com as da outra). Cada nó vizinho ocupa um bloco com as faixas do par
 *   (laneOffsets); os blocos seguem a posição do vizinho ao longo da alça, para os
 *   traçados não se cruzarem. Só aparecem as conexões que dividem alça;
 * - `minSizes`: altura (alças laterais) ou largura (alças de cima e de baixo) que cada
 *   componente precisa para as faixas não ficarem soltas fora dele. Só para alças com
 *   mais de uma faixa.
 */
export function portLayout(connections: Connection[], components: Component[]) {
  const byId = new Map(components.map((c) => [c.id, c]))
  const handles = new Map(
    connections.map((c) => {
      const auto = autoHandles(byId.get(c.source), byId.get(c.target))
      return [
        c.id,
        {
          source: c.layout?.sourceHandle ?? auto.source,
          target: c.layout?.targetHandle ?? auto.target,
        },
      ]
    }),
  )
  balanceSides(connections, byId, handles)

  // Componente -> alça -> vizinho -> conexões (com a ponta que está nesta alça).
  type Ends = { c: Connection; end: 'source' | 'target' }[]
  const ports = new Map<string, { node: string; handle: string; blocks: Map<string, Ends> }>()
  for (const c of connections) {
    const h = handles.get(c.id)
    for (const end of ['source', 'target'] as const) {
      const handle = h?.[end]
      if (!handle) continue
      const node = c[end]
      const key = `${node}\u0000${handle}`
      const other = end === 'source' ? c.target : c.source
      const port = ports.get(key) ?? { node, handle, blocks: new Map<string, Ends>() }
      port.blocks.set(other, [...(port.blocks.get(other) ?? []), { c, end }])
      ports.set(key, port)
    }
  }

  const shifts = new Map<string, { source: number; target: number }>()
  const minSizes = new Map<string, MinSize>()
  for (const { node, handle, blocks } of ports.values()) {
    const vertical = handle === 'left' || handle === 'right' // pontas distribuídas em y
    const along = (id: string) => {
      const l = byId.get(id)?.layout
      return l ? (vertical ? l.y : l.x) : 0
    }
    const ordered = [...blocks.entries()].sort(
      ([a], [b]) => along(a) - along(b) || a.localeCompare(b),
    )
    const widths = ordered.map(([, list]) =>
      list.reduce((n, { c }) => n + (c.direction === 'two-way' ? 2 : 1), 0),
    )
    // Centro de cada bloco, com os blocos encostados e um respiro entre eles.
    const centers: number[] = []
    let cursor = 0
    widths.forEach((w, i) => {
      if (i > 0) cursor += PORT_GAP
      centers.push(cursor + ((w - 1) / 2) * LANE_GAP)
      cursor += w * LANE_GAP
    })
    // Distância entre a primeira e a última faixa da alça.
    const span = cursor - LANE_GAP
    if (span > 0) {
      const size = minSizes.get(node) ?? {}
      const needed = span + 2 * PORT_PAD
      if (vertical) size.height = Math.max(size.height ?? 0, needed)
      else size.width = Math.max(size.width ?? 0, needed)
      minSizes.set(node, size)
    }
    if (blocks.size < 2) continue
    ordered.forEach(([, list], i) => {
      for (const { c, end } of list) {
        const r = shifts.get(c.id) ?? { source: 0, target: 0 }
        r[end] = centers[i] - span / 2
        shifts.set(c.id, r)
      }
    })
  }
  return { handles, shifts, minSizes }
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
