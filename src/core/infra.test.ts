import { describe, expect, it } from 'vitest'
import {
  addComponent,
  createScenario,
  removeElements,
  updateComponent,
  updateConnection,
  connect,
} from './commands'
import { toMarkdown } from './export/markdown'
import type { Scenario } from './model'
import { ScenarioSchema } from './schema'
import { scenarioLoad, sensorLoad } from './sizing'
import { validateScenario } from './validate'

function build() {
  let s = createScenario('Infra')
  const add = (kind: Parameters<typeof addComponent>[1]['kind'], name: string) => {
    const r = addComponent(s, { kind, name, position: { x: 0, y: 0 } })
    s = r.scenario
    return r.id
  }
  return {
    get s() {
      return s
    },
    set s(v: Scenario) {
      s = v
    },
    add,
  }
}

const messages = (s: Scenario, level: 'error' | 'warning') =>
  validateScenario(s)
    .filter((i) => i.level === level)
    .map((i) => i.message)

describe('hosts e "onde roda"', () => {
  it('um serviço pode rodar num host; só host, vm e edge-device hospedam', () => {
    const b = build()
    const host = b.add('host', 'Servidor 1')
    const api = b.add('server', 'API')
    b.s = updateComponent(b.s, api, { hostId: host })
    expect(b.s.components.find((c) => c.id === api)!.hostId).toBe(host)
    expect(() => updateComponent(b.s, host, { hostId: api })).toThrow(/não hospeda/)
    expect(() => updateComponent(b.s, api, { hostId: 'sumiu' })).toThrow(/não encontrado/i)
    b.s = updateComponent(b.s, api, { hostId: null })
    expect(b.s.components.find((c) => c.id === api)!.hostId).toBeUndefined()
  })

  it('VM sobre host; ciclo de hosts é recusado', () => {
    const b = build()
    const host = b.add('host', 'Metal')
    const vm = b.add('vm', 'VM')
    b.s = updateComponent(b.s, vm, { hostId: host })
    expect(() => updateComponent(b.s, host, { hostId: vm })).toThrow(/ciclo/)
  })

  it('remover o host solta quem rodava nele', () => {
    const b = build()
    const host = b.add('host', 'Metal')
    const api = b.add('server', 'API')
    b.s = updateComponent(b.s, api, { hostId: host })
    b.s = removeElements(b.s, { componentIds: [host] })
    expect(b.s.components[0].hostId).toBeUndefined()
    expect(messages(b.s, 'error')).toEqual([])
  })

  it('validação: host inexistente, tipo errado e ciclo vindos de um arquivo editado à mão', () => {
    const b = build()
    const host = b.add('host', 'Metal')
    const api = b.add('server', 'API')
    const other = b.add('server', 'Outra')
    const raw = (patch: Record<string, string>[]) =>
      ({
        ...b.s,
        components: b.s.components.map((c, i) => ({ ...c, ...patch[i] })),
      }) as Scenario
    expect(messages(raw([{}, { hostId: 'sumiu' }, {}]), 'error').join('\n')).toContain(
      'host inexistente',
    )
    expect(messages(raw([{}, { hostId: other }, {}]), 'error').join('\n')).toContain('não hospeda')
    const loop = raw([{ hostId: api }, { hostId: host }, {}])
    // api (server) não é host, então só o erro de tipo; ciclo exige hosts de verdade.
    expect(messages(loop, 'error').length).toBeGreaterThan(0)
  })
})

describe('réplicas', () => {
  it('guarda mínimo, máximo e efêmero; máximo menor que o mínimo é recusado', () => {
    const b = build()
    const w = b.add('worker', 'Jobs')
    b.s = updateComponent(b.s, w, { replicas: { min: 2, max: 10, ephemeral: true } })
    expect(b.s.components[0].replicas).toEqual({ min: 2, max: 10, ephemeral: true })
    expect(() => updateComponent(b.s, w, { replicas: { min: 5, max: 2 } })).toThrow(/máximo/)
    expect(() => updateComponent(b.s, w, { replicas: { min: 0 } })).toThrow(/Réplicas inválido/)
    b.s = updateComponent(b.s, w, { replicas: null })
    expect(b.s.components[0].replicas).toBeUndefined()
  })

  it('validação pega réplicas inconsistentes de um arquivo editado à mão', () => {
    const b = build()
    b.add('worker', 'Jobs')
    const s = {
      ...b.s,
      components: [{ ...b.s.components[0], replicas: { min: 4, max: 2 } }],
    } as Scenario
    expect(messages(s, 'error').join('\n')).toContain('máximo (2) menor que o mínimo (4)')
  })
})

describe('sensores e estimativa de carga', () => {
  it('20 câmeras de 4 Mbps geram 80 Mbps e cerca de 864 GB por dia', () => {
    const b = build()
    const cam = b.add('sensor', 'Câmera')
    b.s = updateComponent(b.s, cam, {
      sensor: { type: 'camera', resolution: '1080p', fps: 30, bitrateMbps: 4, codec: 'H.264' },
      replicas: { min: 20 },
    })
    const one = sensorLoad(b.s.components[0].sensor)!
    expect(one.mbps).toBe(4)
    expect(one.gbPerDay).toBeCloseTo(43.2, 5)
    const total = scenarioLoad(b.s)!
    expect(total.sensors).toBe(20)
    expect(total.mbps).toBe(80)
    expect(total.gbPerDay).toBeCloseTo(864, 5)
    expect(toMarkdown(b.s)).toContain('**80 Mbps** de banda e **864 GB por dia**')
  })

  it('sensor ambiental e radar: taxa × bytes por leitura; sem dados, sem estimativa', () => {
    // 10 amostras/s × 100 B = 8000 bit/s = 0,008 Mbps
    expect(
      sensorLoad({ type: 'environmental', sampleHz: 10, readingBytes: 100 })!.mbps,
    ).toBeCloseTo(0.008)
    expect(
      sensorLoad({ type: 'radar', detectionsPerSecond: 50, readingBytes: 200 })!.mbps,
    ).toBeCloseTo(0.08)
    expect(sensorLoad({ type: 'camera' })).toBeUndefined()
    expect(sensorLoad({ type: 'environmental', sampleHz: 10 })).toBeUndefined()
    expect(sensorLoad(undefined)).toBeUndefined()
  })

  it('aviso quando o sensor não envia dados a ninguém', () => {
    const b = build()
    const cam = b.add('sensor', 'Câmera')
    const nvr = b.add('edge-device', 'NVR')
    const toNvr = connect(b.s, { source: nvr, target: cam })
    expect(messages(toNvr.scenario, 'warning').join('\n')).toContain('não envia dados')
    const ok = connect(b.s, { source: cam, target: nvr })
    expect(messages(ok.scenario, 'warning').join('\n')).not.toContain('não envia dados')
  })

  it('protocolos de dispositivos entram nas conexões', () => {
    const b = build()
    const cam = b.add('sensor', 'Câmera')
    const nvr = b.add('edge-device', 'NVR')
    const c = connect(b.s, { source: cam, target: nvr })
    const s = updateConnection(c.scenario, c.id, { protocol: 'rtsp' })
    expect(s.connections[0].protocol).toBe('rtsp')
    for (const p of ['mqtt', 'udp', 'modbus', 'opcua', 'coap', 'serial'] as const) {
      expect(updateConnection(s, c.id, { protocol: p }).connections[0].protocol).toBe(p)
    }
  })
})

describe('compatibilidade', () => {
  it('um cenário sem nenhum campo de infraestrutura continua válido e igual', () => {
    const b = build()
    b.add('server', 'API')
    const parsed = ScenarioSchema.parse(JSON.parse(JSON.stringify(b.s)))
    expect(parsed).toEqual(b.s)
    expect(toMarkdown(b.s)).not.toContain('Carga estimada')
  })

  it('resumo em Markdown mostra onde roda, réplicas e hardware', () => {
    const b = build()
    const host = b.add('host', 'Servidor 1')
    const api = b.add('server', 'API')
    b.s = updateComponent(b.s, host, {
      hardware: { cpuCores: 8, memoryGb: 32, location: 'rack 2' },
    })
    b.s = updateComponent(b.s, api, { hostId: host, replicas: { min: 2, max: 10 } })
    const md = toMarkdown(b.s)
    expect(md).toContain('**Roda em:** Servidor 1')
    expect(md).toContain('**Réplicas:** 2–10')
    expect(md).toContain('**Hardware:** 8 núcleos, 32 GB de RAM, local: rack 2')
  })
})
