import { ArrowLeftRight, ArrowRight } from 'lucide-react'
import {
  detailItems,
  detailSectionInfo,
  ITEM_SECTIONS,
  PROTOCOLS,
  protocolLabels,
  type Connection,
  type Protocol,
} from '../../core'
import { useEditor } from '../../store/editor'
import { CommitInput, Field, Select } from '../fields'
import { DeleteButton, SectionTitle } from './Inspector'

const protocolOptions = PROTOCOLS.map((p) => ({ value: p, label: protocolLabels[p] }))
const directionOptions: { value: NonNullable<Connection['direction']>; label: string }[] = [
  { value: 'one-way', label: 'Unidirecional (→)' },
  { value: 'two-way', label: 'Bidirecional (↔)' },
]

export default function ConnectionInspector({ id }: { id: string }) {
  const connection = useEditor((s) => s.scenario.connections.find((c) => c.id === id))
  const components = useEditor((s) => s.scenario.components)
  const { updateConnection, reverseConnection, removeElements } = useEditor.getState()
  if (!connection) return null

  const source = components.find((c) => c.id === connection.source)
  const target = components.find((c) => c.id === connection.target)
  const targetItems = target ? detailItems(target) : []
  const uses = new Set(connection.uses ?? [])

  const toggleUse = (itemId: string) => {
    const next = new Set(uses)
    if (next.has(itemId)) next.delete(itemId)
    else next.add(itemId)
    updateConnection(id, { uses: targetItems.map((i) => i.id).filter((i) => next.has(i)) })
  }

  return (
    <div className="space-y-4 p-4">
      <SectionTitle>Conexão</SectionTitle>
      <div className="flex items-center gap-2 rounded-md bg-slate-50 p-2 text-sm">
        <span className="min-w-0 flex-1 truncate font-medium">{source?.name}</span>
        {connection.direction === 'two-way' ? (
          <ArrowLeftRight size={14} className="shrink-0 text-slate-400" />
        ) : (
          <ArrowRight size={14} className="shrink-0 text-slate-400" />
        )}
        <span className="min-w-0 flex-1 truncate text-right font-medium">{target?.name}</span>
      </div>
      <button
        type="button"
        onClick={() => reverseConnection(id)}
        className="text-xs text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
      >
        Inverter sentido
      </button>

      <Field label="Protocolo">
        <Select<Protocol>
          value={connection.protocol ?? 'generic'}
          options={protocolOptions}
          onChange={(protocol) =>
            updateConnection(id, { protocol: protocol === 'generic' ? undefined : protocol })
          }
        />
      </Field>
      <Field label="Rótulo">
        <CommitInput
          value={connection.label ?? ''}
          onCommit={(label) => updateConnection(id, { label })}
          placeholder="ex.: autentica usuário (opcional)"
        />
      </Field>
      <Field label="Sentido">
        <Select
          value={connection.direction ?? 'one-way'}
          options={directionOptions}
          onChange={(direction) => updateConnection(id, { direction })}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={!!connection.async}
          onChange={(e) => updateConnection(id, { async: e.target.checked })}
        />
        Assíncrona (fila, evento, fire-and-forget)
      </label>

      <div className="space-y-2 border-t border-slate-100 pt-4">
        <SectionTitle>Usa do destino</SectionTitle>
        {targetItems.length === 0 ? (
          <p className="text-xs leading-relaxed text-slate-500">
            Opcional. Adicione rotas, tabelas, modelos ou tópicos em “{target?.name}” para indicar
            quais esta conexão usa.
          </p>
        ) : (
          ITEM_SECTIONS.filter((s) => targetItems.some((i) => i.section === s)).map((section) => (
            <div key={section} className="space-y-1">
              <p className="text-xs text-slate-500">{detailSectionInfo[section].label}</p>
              {targetItems
                .filter((i) => i.section === section)
                .map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={uses.has(item.id)}
                      onChange={() => toggleUse(item.id)}
                    />
                    <span className={section === 'routes' ? 'font-mono text-[13px]' : ''}>
                      {item.label}
                    </span>
                  </label>
                ))}
            </div>
          ))
        )}
      </div>

      <div className="border-t border-slate-100 pt-3">
        <DeleteButton
          label="Excluir conexão"
          onClick={() => removeElements({ connectionIds: [id] })}
        />
      </div>
    </div>
  )
}
