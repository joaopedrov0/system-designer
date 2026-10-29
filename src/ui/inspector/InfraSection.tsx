import { Plus, X } from 'lucide-react'
import {
  HOST_KINDS,
  SENSOR_TYPES,
  sensorLoad,
  type Component,
  type Hardware,
  type Sensor,
} from '../../core'
import { useEditor } from '../../store/editor'
import { CommitInput, Field, Select } from '../fields'
import { SectionTitle } from './Inspector'

const isHostKind = (kind: Component['kind']) => (HOST_KINDS as readonly string[]).includes(kind)

const sensorLabels: Record<(typeof SENSOR_TYPES)[number], string> = {
  camera: 'Câmera',
  environmental: 'Sensor ambiental (temperatura, umidade…)',
  radar: 'Radar',
  generic: 'Sensor genérico',
}

/** Campo numérico opcional: vazio remove; texto inválido avisa e não grava. */
function NumberField(props: {
  label: string
  value: number | undefined
  onChange: (value: number | undefined) => void
  placeholder?: string
  integer?: boolean
}) {
  const showError = useEditor((s) => s.showError)
  return (
    <Field label={props.label}>
      <CommitInput
        aria-label={props.label}
        value={props.value === undefined ? '' : String(props.value)}
        placeholder={props.placeholder}
        onCommit={(text) => {
          if (!text.trim()) return props.onChange(undefined)
          const n = Number(text.replace(',', '.'))
          if (!Number.isFinite(n) || n <= 0 || (props.integer && !Number.isInteger(n))) {
            return showError(
              `${props.label}: use um número ${props.integer ? 'inteiro ' : ''}maior que zero.`,
            )
          }
          props.onChange(n)
        }}
      />
    </Field>
  )
}

/** Remove chaves `undefined`; `null` quando não sobra nada (o comando então remove o campo). */
function compact<T extends object>(value: T): T | null {
  const entries = Object.entries(value).filter(([, v]) => v !== undefined && v !== '')
  return entries.length ? (Object.fromEntries(entries) as T) : null
}

/**
 * Infraestrutura opcional do componente: onde roda, réplicas, hardware (host/VM/borda) e
 * atributos de sensor. Nada disso aparece até ser pedido (complexidade progressiva).
 */
export default function InfraSection({ component: c }: { component: Component }) {
  // Seleciona o array estável da store e filtra depois: um filter() dentro do seletor
  // devolve um array novo a cada render e o Zustand entra em loop.
  const components = useEditor((s) => s.scenario.components)
  const hosts = components.filter((x) => x.id !== c.id && isHostKind(x.kind))
  const { updateComponent } = useEditor.getState()
  const host = isHostKind(c.kind)

  return (
    <div className="space-y-4">
      {!host && hosts.length > 0 && (
        <Field label="Roda em">
          <Select
            aria-label="Roda em"
            value={c.hostId ?? ''}
            options={[
              { value: '', label: '(não informado)' },
              ...hosts.map((h) => ({ value: h.id, label: h.name })),
            ]}
            onChange={(hostId) => updateComponent(c.id, { hostId: hostId || null })}
          />
        </Field>
      )}

      {c.replicas ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <SectionTitle>Réplicas</SectionTitle>
            <button
              type="button"
              aria-label="Remover réplicas"
              title="Remover réplicas"
              onClick={() => updateComponent(c.id, { replicas: null })}
              className="rounded p-1 text-slate-400 hover:bg-slate-100"
            >
              <X size={13} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Mínimo"
              integer
              value={c.replicas.min}
              onChange={(min) =>
                min && updateComponent(c.id, { replicas: { ...c.replicas!, min } })
              }
            />
            <NumberField
              label="Máximo"
              integer
              value={c.replicas.max}
              placeholder="fixo"
              onChange={(max) => {
                const replicas = { ...c.replicas! }
                delete replicas.max
                updateComponent(c.id, { replicas: max ? { ...replicas, max } : replicas })
              }}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={!!c.replicas.ephemeral}
              onChange={(e) =>
                updateComponent(c.id, {
                  replicas: { ...c.replicas!, ephemeral: e.target.checked || undefined },
                })
              }
            />
            Efêmero (nasce e morre: job, cron, contêiner)
          </label>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => updateComponent(c.id, { replicas: { min: 2 } })}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
        >
          <Plus size={12} /> Réplicas (opcional)
        </button>
      )}

      {host && <HardwareFields component={c} />}
      {c.kind === 'sensor' && <SensorFields component={c} />}
    </div>
  )
}

function HardwareFields({ component: c }: { component: Component }) {
  const { updateComponent } = useEditor.getState()
  const hw: Hardware = c.hardware ?? {}
  const set = (patch: Partial<Hardware>) =>
    updateComponent(c.id, { hardware: compact({ ...hw, ...patch }) })
  const text = (label: string, key: 'gpu' | 'os' | 'location' | 'address', placeholder: string) => (
    <Field label={label}>
      <CommitInput
        aria-label={label}
        value={hw[key] ?? ''}
        placeholder={placeholder}
        onCommit={(value) => set({ [key]: value.trim() || undefined })}
      />
    </Field>
  )
  return (
    <div className="space-y-3">
      <SectionTitle>Hardware</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Núcleos de CPU"
          integer
          value={hw.cpuCores}
          onChange={(cpuCores) => set({ cpuCores })}
        />
        <NumberField
          label="Memória (GB)"
          value={hw.memoryGb}
          onChange={(memoryGb) => set({ memoryGb })}
        />
        <NumberField label="Disco (GB)" value={hw.diskGb} onChange={(diskGb) => set({ diskGb })} />
        <NumberField
          label="Consumo (W)"
          value={hw.powerWatts}
          onChange={(powerWatts) => set({ powerWatts })}
        />
      </div>
      {text('GPU', 'gpu', 'ex.: RTX 4060 (opcional)')}
      {text('Sistema operacional', 'os', 'ex.: Ubuntu 24.04')}
      {text('Local', 'location', 'ex.: rack 2, datacenter SP, casa')}
      {text('IP / hostname', 'address', 'ex.: 10.0.0.12')}
    </div>
  )
}

function SensorFields({ component: c }: { component: Component }) {
  const { updateComponent } = useEditor.getState()
  const sensor: Sensor = c.sensor ?? { type: 'generic' }
  const set = (patch: Partial<Sensor>) =>
    updateComponent(c.id, { sensor: { ...sensor, ...patch } as Sensor })
  const load = sensorLoad(c.sensor)
  const text = (label: string, key: 'resolution' | 'codec', placeholder: string) => (
    <Field label={label}>
      <CommitInput
        aria-label={label}
        value={sensor[key] ?? ''}
        placeholder={placeholder}
        onCommit={(value) => set({ [key]: value.trim() || undefined })}
      />
    </Field>
  )
  const rate = sensor.type === 'radar' ? 'detectionsPerSecond' : 'sampleHz'
  return (
    <div className="space-y-3">
      <SectionTitle>Sensor</SectionTitle>
      <Field label="Tipo de sensor">
        <Select
          aria-label="Tipo de sensor"
          value={sensor.type}
          options={SENSOR_TYPES.map((t) => ({ value: t, label: sensorLabels[t] }))}
          onChange={(type) => set({ type })}
        />
      </Field>
      {sensor.type === 'camera' ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Bitrate (Mbps)"
              value={sensor.bitrateMbps}
              onChange={(bitrateMbps) => set({ bitrateMbps })}
            />
            <NumberField
              label="Quadros por segundo"
              value={sensor.fps}
              onChange={(fps) => set({ fps })}
            />
          </div>
          {text('Resolução', 'resolution', 'ex.: 1080p')}
          {text('Codec', 'codec', 'ex.: H.264')}
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label={sensor.type === 'radar' ? 'Detecções por segundo' : 'Amostras por segundo'}
            value={sensor[rate]}
            onChange={(value) => set({ [rate]: value })}
          />
          <NumberField
            label="Bytes por leitura"
            value={sensor.readingBytes}
            onChange={(readingBytes) => set({ readingBytes })}
          />
        </div>
      )}
      <p className="text-xs text-slate-500" data-testid="sensor-load">
        {load
          ? `≈ ${Number(load.mbps.toFixed(2))} Mbps · ${Number(load.gbPerDay.toFixed(1))} GB por dia (se tudo for gravado)`
          : 'Informe os dados acima para estimar banda e armazenamento.'}
      </p>
    </div>
  )
}
