import { describe, expect, it } from 'vitest'
import type { Component, Connection } from './model'
import { flowSchedule } from './flow'

const comp = (id: string): Component => ({ id, kind: 'generic', name: id, layout: { x: 0, y: 0 } })
const conn = (source: string, target: string, extra: Partial<Connection> = {}): Connection => ({
  id: `${source}-${target}`,
  source,
  target,
  ...extra,
})

describe('flowSchedule', () => {
  it('propaga em cascata a partir das entradas', () => {
    const s = flowSchedule({
      components: ['web', 'api', 'db'].map(comp),
      connections: [conn('api', 'db'), conn('web', 'api')],
    })
    expect(s.lanes.get('web-api')).toEqual({ forward: 0 })
    expect(s.lanes.get('api-db')).toEqual({ forward: 1 })
    expect(s.slots).toBe(2)
  })

  it('mão dupla volta no tempo seguinte', () => {
    const s = flowSchedule({
      components: ['web', 'api'].map(comp),
      connections: [conn('web', 'api', { direction: 'two-way' })],
    })
    expect(s.lanes.get('web-api')).toEqual({ forward: 0, backward: 1 })
    expect(s.slots).toBe(2)
  })

  it('ciclos sem entrada começam pelo primeiro componente', () => {
    const s = flowSchedule({
      components: ['a', 'b', 'c'].map(comp),
      connections: [conn('a', 'b'), conn('b', 'c'), conn('c', 'a')],
    })
    expect([...s.lanes.values()].map((l) => l.forward)).toEqual([0, 1, 2])
    expect(s.slots).toBe(3)
  })

  it('cenário sem conexões tem um tempo', () => {
    expect(flowSchedule({ components: [comp('a')], connections: [] }).slots).toBe(1)
  })
})
