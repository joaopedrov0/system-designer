import { describe, expect, it } from 'vitest'
import type { Component, Connection } from '../../core'
import { LANE_GAP } from './ConnectionEdge'
import { laneOffsets, portLayout } from './mapping'

const conn = (id: string, source: string, target: string, twoWay = false): Connection => ({
  id,
  source,
  target,
  ...(twoWay ? { direction: 'two-way' as const } : {}),
})

describe('laneOffsets', () => {
  it('conexão única fica centralizada', () => {
    expect(laneOffsets([conn('a', 'x', 'y')]).get('a')).toBe(0)
  })

  it('ida e volta separadas ficam em faixas paralelas', () => {
    const o = laneOffsets([conn('ida', 'x', 'y'), conn('volta', 'y', 'x')])
    expect([o.get('ida'), o.get('volta')]).toEqual([-LANE_GAP / 2, LANE_GAP / 2])
  })

  it('mão dupla ocupa duas faixas', () => {
    const o = laneOffsets([conn('dupla', 'x', 'y', true), conn('extra', 'x', 'y')])
    // faixas: [dupla, dupla, extra] centradas em 0 -> dupla em -0.5, extra em +1
    expect([o.get('dupla'), o.get('extra')]).toEqual([-LANE_GAP / 2, LANE_GAP])
  })

  it('pares diferentes não interferem', () => {
    const o = laneOffsets([conn('a', 'x', 'y'), conn('b', 'y', 'z')])
    expect([o.get('a'), o.get('b')]).toEqual([0, 0])
  })
})

describe('portLayout: tamanho mínimo dos componentes', () => {
  const node = (id: string, x: number, y: number): Component => ({
    id,
    kind: 'server',
    name: id,
    layout: { x, y },
  })
  const nodes = [node('a', 0, 0), node('b', 500, -200), node('c', 500, 0), node('d', 500, 200)]

  it('uma conexão por alça não pede nada', () => {
    expect(portLayout([conn('ab', 'a', 'b')], nodes).minSizes.size).toBe(0)
  })

  it('faixas numa alça lateral aumentam a altura do componente', () => {
    const { minSizes } = portLayout(
      [conn('ab', 'a', 'b', true), conn('ac', 'a', 'c', true), conn('ad', 'a', 'd', true)],
      nodes,
    )
    // 6 faixas (3 pares), 2 respiros entre blocos, folga nas duas quinas.
    expect(minSizes.get('a')).toEqual({ height: 5 * LANE_GAP + 2 * 6 + 2 * 12 })
    // Do outro lado, cada vizinho só tem as 2 faixas do seu par.
    expect(minSizes.get('b')).toEqual({ height: LANE_GAP + 2 * 12 })
  })

  it('faixas nas alças de cima/baixo aumentam a largura', () => {
    const below = [node('a', 0, 0), node('x', -300, 400), node('y', 300, 400)]
    const { minSizes } = portLayout([conn('ax', 'a', 'x', true), conn('ay', 'a', 'y', true)], below)
    expect(minSizes.get('a')).toEqual({ width: 3 * LANE_GAP + 6 + 2 * 12 })
  })
})

describe('portLayout: lateral cheia demais', () => {
  const node = (id: string, x: number, y: number): Component => ({
    id,
    kind: 'server',
    name: id,
    layout: { x, y },
  })
  // Quatro vizinhos à direita, todos ligados em mão dupla: 8 faixas na lateral do hub.
  const nodes = [
    node('hub', 0, 300),
    node('n1', 500, 0),
    node('n2', 500, 250),
    node('n3', 500, 350),
    node('n4', 500, 600),
  ]
  const conns = ['n1', 'n2', 'n3', 'n4'].map((n) => conn(`hub-${n}`, 'hub', n, true))

  it('desvia as conexões mais verticais para cima/baixo até caberem', () => {
    const { handles, minSizes } = portLayout(conns, nodes)
    // n1 está bem acima e é o mais vertical: sai por cima e chega por baixo.
    expect(handles.get('hub-n1')).toEqual({ source: 'top', target: 'bottom' })
    // Com ele fora, sobram 6 faixas: o limite. Os demais seguem pela lateral.
    for (const id of ['hub-n2', 'hub-n3', 'hub-n4'])
      expect(handles.get(id)).toEqual({ source: 'right', target: 'left' })
    expect(minSizes.get('hub')!.height).toBeLessThan(5 * LANE_GAP + 2 * 6 + 2 * 12 + 1)
  })

  it('alças escolhidas pelo usuário nunca mudam', () => {
    const fixed = conns.map((c) => ({
      ...c,
      layout: { sourceHandle: 'right', targetHandle: 'left' },
    }))
    const { handles } = portLayout(fixed, nodes)
    for (const c of fixed) expect(handles.get(c.id)).toEqual({ source: 'right', target: 'left' })
  })

  it('até o limite, nada muda', () => {
    const { handles } = portLayout(conns.slice(1), nodes)
    for (const c of conns.slice(1))
      expect(handles.get(c.id)).toEqual({ source: 'right', target: 'left' })
  })
})
