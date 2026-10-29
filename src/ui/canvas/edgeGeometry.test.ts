import { Position } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import type { Component, Connection } from '../../core'
import { LANE_GAP } from './ConnectionEdge'
import { lanePath, reverseEnds, reversePorts, type EdgeEnds } from './edgeGeometry'
import { toEdges } from './mapping'

type Pt = [number, number]

/** Vértices do caminho (pontos de controle das curvas incluídos): boa aproximação do traçado. */
function vertices(path: string): Pt[] {
  const nums = path.match(/-?\d+(\.\d+)?/g)!.map(Number)
  const pts: Pt[] = []
  for (let i = 0; i < nums.length; i += 2) pts.push([nums[i], nums[i + 1]])
  return pts
}

const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
const onSegment = (p: Pt, a: Pt, b: Pt) =>
  Math.min(a[0], b[0]) - 1e-6 <= p[0] &&
  p[0] <= Math.max(a[0], b[0]) + 1e-6 &&
  Math.min(a[1], b[1]) - 1e-6 <= p[1] &&
  p[1] <= Math.max(a[1], b[1]) + 1e-6

/** Segmentos se tocam (inclui sobreposição colinear, que é justamente o bug). */
function touches(a1: Pt, a2: Pt, b1: Pt, b2: Pt): boolean {
  const d1 = cross(b1, b2, a1)
  const d2 = cross(b1, b2, a2)
  const d3 = cross(a1, a2, b1)
  const d4 = cross(a1, a2, b2)
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0)))
    return true
  return (
    (d1 === 0 && onSegment(a1, b1, b2)) ||
    (d2 === 0 && onSegment(a2, b1, b2)) ||
    (d3 === 0 && onSegment(b1, a1, a2)) ||
    (d4 === 0 && onSegment(b2, a1, a2))
  )
}

function pathsTouch(p: string, q: string): boolean {
  const a = vertices(p)
  const b = vertices(q)
  for (let i = 1; i < a.length; i++)
    for (let j = 1; j < b.length; j++) if (touches(a[i - 1], a[i], b[j - 1], b[j])) return true
  return false
}

const GAP = 12
const cases: [string, EdgeEnds][] = [
  [
    'baixo -> cima, para a direita',
    {
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Bottom,
      targetX: 300,
      targetY: 200,
      targetPosition: Position.Top,
    },
  ],
  [
    'baixo -> cima, para a esquerda',
    {
      sourceX: 300,
      sourceY: 0,
      sourcePosition: Position.Bottom,
      targetX: 0,
      targetY: 200,
      targetPosition: Position.Top,
    },
  ],
  [
    'cima -> baixo, subindo',
    {
      sourceX: 0,
      sourceY: 300,
      sourcePosition: Position.Top,
      targetX: 300,
      targetY: 0,
      targetPosition: Position.Bottom,
    },
  ],
  [
    'direita -> esquerda, descendo',
    {
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 300,
      targetY: 200,
      targetPosition: Position.Left,
    },
  ],
  [
    'direita -> esquerda, subindo',
    {
      sourceX: 0,
      sourceY: 200,
      sourcePosition: Position.Right,
      targetX: 300,
      targetY: 0,
      targetPosition: Position.Left,
    },
  ],
  [
    'esquerda -> direita, voltando',
    {
      sourceX: 300,
      sourceY: 0,
      sourcePosition: Position.Left,
      targetX: 0,
      targetY: 200,
      targetPosition: Position.Right,
    },
  ],
  [
    'reta horizontal',
    {
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 300,
      targetY: 0,
      targetPosition: Position.Left,
    },
  ],
]

describe('lanePath', () => {
  it.each(cases)('mão dupla não se sobrepõe nem cruza: %s', (_, ends) => {
    const [go] = lanePath(ends, GAP / 2)
    const [back] = lanePath(reverseEnds(ends), -GAP / 2)
    expect(pathsTouch(go, back)).toBe(false)
  })

  it.each(cases)('duas conexões opostas separadas não se sobrepõem: %s', (_, ends) => {
    const [there] = lanePath(ends, -GAP / 2)
    const [back] = lanePath(reverseEnds(ends), GAP / 2)
    expect(pathsTouch(there, back)).toBe(false)
  })

  it('sem deslocamento, as duas faixas coincidiriam (o teste pega sobreposição)', () => {
    const ends = cases[0][1]
    expect(pathsTouch(lanePath(ends, 0)[0], lanePath(reverseEnds(ends), 0)[0])).toBe(true)
  })
})

/** Nós em grade: altura aproximada de um componente no canvas. */
const W = 200
const H = 58
const node = (id: string, x: number, y: number): Component => ({
  id,
  kind: 'server',
  name: id,
  layout: { x, y },
})
const handlePoint = (c: Component, side: string): [number, number, Position] => {
  const { x, y } = c.layout
  if (side === 'left') return [x, y + H / 2, Position.Left]
  if (side === 'right') return [x + W, y + H / 2, Position.Right]
  if (side === 'top') return [x + W / 2, y, Position.Top]
  return [x + W / 2, y + H, Position.Bottom]
}

/** Traça as conexões como o ConnectionEdge: ida e, na mão dupla, volta. */
function drawn(components: Component[], connections: Connection[], usePorts = true) {
  const byId = new Map(components.map((c) => [c.id, c]))
  return toEdges(connections, components).map((e) => {
    const [sourceX, sourceY, sourcePosition] = handlePoint(byId.get(e.source)!, e.sourceHandle!)
    const [targetX, targetY, targetPosition] = handlePoint(byId.get(e.target)!, e.targetHandle!)
    const ends = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition }
    const offset = e.data!.offset ?? 0
    const half = e.data!.twoWay ? LANE_GAP / 2 : 0
    const ports = usePorts ? e.data!.ports : undefined
    const paths = [lanePath(ends, offset + half, ports)[0]]
    if (e.data!.twoWay)
      paths.push(lanePath(reverseEnds(ends), offset - half, ports && reversePorts(ports))[0])
    return paths
  })
}

function anyOverlap(edges: string[][]): boolean {
  const all = edges.flat()
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) if (pathsTouch(all[i], all[j])) return true
  return false
}

const twoWay = (id: string, source: string, target: string): Connection => ({
  id,
  source,
  target,
  direction: 'two-way',
})

describe('conexões que dividem a mesma alça', () => {
  // Um nó com mão dupla para dois vizinhos do mesmo lado: todas saem da alça direita.
  const fan = [node('a', 0, 0), node('b', 500, -200), node('c', 500, 200)]
  const fanOut = [twoWay('ab', 'a', 'b'), twoWay('ac', 'a', 'c')]
  // E o inverso: dois nós chegando à alça esquerda do mesmo destino.
  const fanIn = [twoWay('ba', 'b', 'a'), twoWay('ca', 'c', 'a')]
  const fanInNodes = [node('a', 500, 0), node('b', 0, -200), node('c', 0, 200)]

  it('saindo de um nó para vizinhos diferentes, nenhum traçado se sobrepõe', () => {
    expect(anyOverlap(drawn(fan, fanOut))).toBe(false)
  })

  it('chegando a um nó vindo de vizinhos diferentes, nenhum traçado se sobrepõe', () => {
    expect(anyOverlap(drawn(fanInNodes, fanIn))).toBe(false)
  })

  it('com mais de uma conexão por par e vizinhos alinhados na vertical', () => {
    const nodes = [node('a', 0, 0), node('b', 500, -100), node('c', 500, 100), node('d', 500, 300)]
    const conns = [
      twoWay('ab', 'a', 'b'),
      { id: 'ab2', source: 'a', target: 'b' },
      twoWay('ac', 'a', 'c'),
      { id: 'da', source: 'd', target: 'a' },
    ]
    expect(anyOverlap(drawn(nodes, conns))).toBe(false)
  })

  it('alças de cima e de baixo, com vizinhos dos dois lados', () => {
    const nodes = [node('a', 0, 0), node('b', -300, 300), node('c', 0, 320), node('d', 300, 300)]
    const conns = [twoWay('ab', 'a', 'b'), twoWay('ac', 'a', 'c'), twoWay('ad', 'a', 'd')]
    expect(anyOverlap(drawn(nodes, conns))).toBe(false)
  })

  it('sem os pontos distribuídos, os traçados se sobreporiam (o teste pega o bug)', () => {
    expect(anyOverlap(drawn(fan, fanOut, false))).toBe(true)
  })
})
