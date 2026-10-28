import type { Scenario } from './model'

export interface FlowLane {
  /** Em que "tempo" o sinal de ida percorre a conexão. */
  forward: number
  /** Em conexões de mão dupla: o tempo da volta (logo depois da ida). */
  backward?: number
}

export interface FlowSchedule {
  /** Quantidade de tempos de um ciclo completo. */
  slots: number
  lanes: Map<string, FlowLane>
}

/**
 * Agenda os sinais da visualização de fluxo: um sinal parte dos pontos de entrada
 * (componentes sem conexões chegando) e avança uma conexão por tempo, seguindo o sentido
 * das conexões. Na mão dupla, a volta acontece no tempo seguinte à ida.
 */
export function flowSchedule(s: Pick<Scenario, 'components' | 'connections'>): FlowSchedule {
  const outgoing = new Map<string, string[]>()
  const incoming = new Set<string>()
  for (const c of s.connections) {
    outgoing.set(c.source, [...(outgoing.get(c.source) ?? []), c.target])
    incoming.add(c.target)
  }

  // BFS a partir das entradas; componentes que só existem em ciclos viram novas entradas.
  const depth = new Map<string, number>()
  const visit = (roots: string[]) => {
    const queue = roots.filter((r) => !depth.has(r))
    for (const r of queue) depth.set(r, 0)
    while (queue.length > 0) {
      const id = queue.shift()!
      for (const next of outgoing.get(id) ?? []) {
        if (depth.has(next)) continue
        depth.set(next, depth.get(id)! + 1)
        queue.push(next)
      }
    }
  }
  visit(s.components.filter((c) => !incoming.has(c.id)).map((c) => c.id))
  for (const c of s.components) if (!depth.has(c.id)) visit([c.id])

  const lanes = new Map<string, FlowLane>()
  let slots = 1
  for (const c of s.connections) {
    const forward = depth.get(c.source) ?? 0
    const lane: FlowLane = { forward }
    if (c.direction === 'two-way') lane.backward = forward + 1
    lanes.set(c.id, lane)
    slots = Math.max(slots, (lane.backward ?? forward) + 1)
  }
  return { slots, lanes }
}
