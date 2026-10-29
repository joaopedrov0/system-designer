import type { Component, Scenario, Sensor } from './model'

export interface SensorLoad {
  /** Banda gerada, em megabits por segundo. */
  mbps: number
  /** Armazenamento por dia se tudo for gravado, em gigabytes (decimais). */
  gbPerDay: number
}

const SECONDS_PER_DAY = 86_400

/**
 * Carga de um sensor, ou `undefined` se faltam dados para estimar. Câmera: o bitrate.
 * Ambiental: amostras por segundo × bytes por leitura. Radar: detecções por segundo × bytes.
 * Genérico: usa qualquer um dos dois pares que estiver completo.
 */
export function sensorLoad(sensor: Sensor | undefined): SensorLoad | undefined {
  if (!sensor) return undefined
  let mbps: number | undefined
  if (sensor.type === 'camera') mbps = sensor.bitrateMbps
  else {
    const rate =
      sensor.type === 'radar'
        ? sensor.detectionsPerSecond
        : sensor.type === 'environmental'
          ? sensor.sampleHz
          : (sensor.sampleHz ?? sensor.detectionsPerSecond)
    if (rate && sensor.readingBytes) mbps = (rate * sensor.readingBytes * 8) / 1e6
    else if (sensor.type === 'generic') mbps = sensor.bitrateMbps
  }
  if (mbps === undefined) return undefined
  return { mbps, gbPerDay: (mbps * SECONDS_PER_DAY) / 8 / 1000 }
}

/** Quantas cópias o componente tem no mínimo (1 se não há réplicas declaradas). */
export const replicaCount = (c: Component) => c.replicas?.min ?? 1

export interface ScenarioLoad extends SensorLoad {
  /** Sensores que entraram na soma (cada um conta `replicaCount` vezes). */
  sensors: number
  /** Sensores sem dados suficientes para estimar. */
  unknown: string[]
}

/** Soma a carga de todos os sensores do cenário, ou `undefined` se não há nenhum. */
export function scenarioLoad(s: Pick<Scenario, 'components'>): ScenarioLoad | undefined {
  const sensors = s.components.filter((c) => c.kind === 'sensor')
  if (sensors.length === 0) return undefined
  const total: ScenarioLoad = { mbps: 0, gbPerDay: 0, sensors: 0, unknown: [] }
  for (const c of sensors) {
    const load = sensorLoad(c.sensor)
    if (!load) {
      total.unknown.push(c.id)
      continue
    }
    const n = replicaCount(c)
    total.mbps += load.mbps * n
    total.gbPerDay += load.gbPerDay * n
    total.sensors += n
  }
  return total
}
