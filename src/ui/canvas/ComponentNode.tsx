import { Handle, Position, useConnection, type Node, type NodeProps } from '@xyflow/react'
import { ChevronDown, ChevronRight, Lock } from 'lucide-react'
import { memo, useState } from 'react'
import {
  componentCatalog,
  DETAIL_SECTIONS,
  detailCount,
  detailSectionInfo,
  type Component,
} from '../../core'
import { useEditor } from '../../store/editor'
import { CatalogIcon } from '../icons'

export type ComponentFlowNode = Node<
  {
    component: Component
    /** Cresce para caberem as faixas das conexões que dividem uma alça (ver portLayout). */
    minSize?: { width?: number; height?: number }
  },
  'component'
>

export const NODE_WIDTH = 200

const sides = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
]

function ComponentNode({ data, selected }: NodeProps<ComponentFlowNode>) {
  const c = data.component
  const def = componentCatalog[c.kind]
  const [editing, setEditing] = useState(false)
  const updateComponent = useEditor((s) => s.updateComponent)
  const setComponentExpanded = useEditor((s) => s.setComponentExpanded)
  // Sem hover no toque: as alças ficam à vista no nó selecionado e, enquanto uma conexão
  // está sendo feita, em todos (para tocar no destino).
  const connecting = useConnection((c) => c.inProgress)
  const showHandles = selected || connecting

  const badges = DETAIL_SECTIONS.map((section) => ({
    section,
    count: detailCount(c, section),
  })).filter((b) => b.count > 0)
  const expanded = !!c.layout.expanded && badges.length > 0
  const replicated = !!c.replicas && (c.replicas.max ?? c.replicas.min) > 1
  const hostName = useEditor((s) =>
    c.hostId ? s.scenario.components.find((x) => x.id === c.hostId)?.name : undefined,
  )

  const commit = (value: string) => {
    setEditing(false)
    if (value.trim() && value.trim() !== c.name) updateComponent(c.id, { name: value })
  }

  return (
    <div
      // Coluna centralizada: se o nó crescer para caber as conexões, o conteúdo fica no meio.
      className={`group relative flex flex-col justify-center rounded-lg border bg-surface px-3 py-2.5 transition-shadow ${
        // Réplicas: nó "empilhado" (como um baralho); efêmero: borda tracejada.
        replicated
          ? 'shadow-[4px_4px_0_-1px_var(--color-surface),4px_4px_0_0_var(--color-slate-300),8px_8px_0_-1px_var(--color-surface),8px_8px_0_0_var(--color-slate-300)]'
          : 'shadow-sm'
      } ${c.replicas?.ephemeral ? 'border-dashed' : ''} ${
        selected ? 'border-slate-900 ring-2 ring-slate-900/15' : 'border-slate-200 hover:shadow-md'
      }`}
      style={{
        width: Math.max(NODE_WIDTH, data.minSize?.width ?? 0),
        minHeight: data.minSize?.height,
      }}
      onDoubleClick={() => setEditing(true)}
    >
      {c.replicas && (
        <span
          data-testid="replicas-badge"
          className="absolute -top-2 -right-2 z-10 rounded-full bg-slate-900 px-1.5 py-px text-[10px] font-semibold text-slate-50"
          title={c.replicas.ephemeral ? 'Réplicas efêmeras' : 'Réplicas'}
        >
          ×
          {c.replicas.max !== undefined && c.replicas.max !== c.replicas.min
            ? `${c.replicas.min}–${c.replicas.max}`
            : c.replicas.min}
        </span>
      )}
      {sides.map((side) => (
        <Handle
          key={side.id}
          id={side.id}
          type="source"
          position={side.position}
          className={`!h-2.5 !w-2.5 !border-2 !border-surface !bg-slate-400 transition-opacity group-hover:opacity-100 ${
            showHandles ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}

      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white"
          style={{ backgroundColor: def.color }}
        >
          <CatalogIcon name={def.icon} size={18} strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              className="nodrag w-full rounded border border-slate-300 px-1 text-sm font-medium outline-none focus:border-slate-500"
              defaultValue={c.name}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              onBlur={(e) => commit(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') setEditing(false)
              }}
            />
          ) : (
            <div className="truncate text-sm font-medium text-slate-900" title={c.name}>
              {c.name}
            </div>
          )}
          <div className="truncate text-xs text-slate-500">{c.technology ?? def.label}</div>
          {hostName && (
            <div className="truncate text-[10px] text-slate-400" title={`Roda em ${hostName}`}>
              em {hostName}
            </div>
          )}
        </div>
      </div>

      {badges.length > 0 && (
        <button
          type="button"
          className="nodrag mt-2 flex w-full flex-wrap items-center gap-1 text-left"
          title={expanded ? 'Recolher detalhes' : 'Mostrar detalhes'}
          onClick={() => setComponentExpanded(c.id, !expanded)}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {expanded ? (
            <ChevronDown size={12} className="text-slate-400" />
          ) : (
            <ChevronRight size={12} className="text-slate-400" />
          )}
          {badges.map(({ section, count }) => {
            const info = detailSectionInfo[section]
            return (
              <span
                key={section}
                className="rounded bg-slate-100 px-1.5 py-px text-[11px] text-slate-600"
              >
                {count} {count === 1 ? info.singular : info.plural}
              </span>
            )
          })}
        </button>
      )}

      {expanded && <ExpandedDetails component={c} />}
    </div>
  )
}

function ExpandedDetails({ component: c }: { component: Component }) {
  const d = c.details ?? {}
  const line = 'truncate text-[11px] leading-5 text-slate-600'
  return (
    <div className="mt-1.5 space-y-px border-t border-slate-100 pt-1.5">
      {d.routes?.map((r) => (
        <div key={r.id} className={`${line} font-mono`} title={r.description}>
          <span className="font-semibold text-slate-800">{r.method}</span> {r.path}
        </div>
      ))}
      {d.entities?.map((e) => (
        <div key={e.id} className={line} title={e.fields?.map((f) => f.name).join(', ')}>
          <span className="font-mono">{e.name}</span>
          {e.fields?.length ? (
            <span className="text-slate-400"> · {e.fields.length} campos</span>
          ) : null}
        </div>
      ))}
      {d.models?.map((m) => (
        <div key={m.id} className={line} title={m.purpose}>
          <span className="font-mono">{m.name}</span>
          {m.purpose && <span className="text-slate-400"> · {m.purpose}</span>}
        </div>
      ))}
      {d.topics?.map((t) => (
        <div key={t.id} className={`${line} font-mono`}>
          {t.name}
        </div>
      ))}
      {d.screens?.map((t) => (
        <div key={t.id} className={line} title={t.description}>
          {t.name}
          {t.path && <span className="font-mono text-slate-400"> {t.path}</span>}
        </div>
      ))}
      {d.env?.map((v) => (
        <div key={v.key} className={`${line} flex items-center gap-1 font-mono text-slate-500`}>
          <span className="truncate">
            {v.key}
            {!v.secret && v.value ? `=${v.value}` : ''}
          </span>
          {v.secret && <Lock size={10} className="shrink-0 text-amber-600" />}
        </div>
      ))}
    </div>
  )
}

export default memo(ComponentNode)
