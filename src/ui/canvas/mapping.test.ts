import { describe, expect, it } from 'vitest'
import type { Connection } from '../../core'
import { LANE_GAP } from './ConnectionEdge'
import { laneOffsets } from './mapping'

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
