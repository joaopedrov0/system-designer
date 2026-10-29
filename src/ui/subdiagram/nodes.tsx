import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { AppWindow, KeyRound, Table2 } from 'lucide-react'
import { memo } from 'react'
import type { Entity, Screen } from '../../core'
import { SUB_NODE_WIDTH } from './sizes'

export type ScreenFlowNode = Node<{ item: Screen }, 'screen'>
export type EntityFlowNode = Node<{ item: Entity }, 'entity'>
export type SubFlowNode = ScreenFlowNode | EntityFlowNode

const sides = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
]

// Alças só aparecem no hover, como no canvas principal; arrastar de uma cria a ligação.
function Handles() {
  return sides.map((side) => (
    <Handle
      key={side.id}
      id={side.id}
      type="source"
      position={side.position}
      className="!h-2 !w-2 !border-2 !border-surface !bg-slate-400 opacity-0 transition-opacity group-hover:opacity-100"
    />
  ))
}

const frame = (selected: boolean) =>
  `group rounded-md border bg-surface shadow-sm ${
    selected ? 'border-slate-900 ring-2 ring-slate-900/15' : 'border-slate-200'
  }`

export const ScreenNode = memo(function ScreenNode({ data, selected }: NodeProps<ScreenFlowNode>) {
  const s = data.item
  return (
    <div className={`${frame(selected)} px-2.5 py-2`} style={{ width: SUB_NODE_WIDTH.screen }}>
      <Handles />
      <div className="flex items-center gap-1.5">
        <AppWindow size={13} className="shrink-0 text-blue-500" />
        <span className="truncate text-xs font-medium text-slate-900" title={s.name}>
          {s.name}
        </span>
      </div>
      {s.path && (
        <div className="mt-0.5 truncate font-mono text-[10px] text-slate-500">{s.path}</div>
      )}
    </div>
  )
})

/** Tabela no estilo de diagrama ER: nome no cabeçalho e um campo por linha. */
export const EntityNode = memo(function EntityNode({ data, selected }: NodeProps<EntityFlowNode>) {
  const e = data.item
  return (
    <div className={`${frame(selected)} overflow-hidden`} style={{ width: SUB_NODE_WIDTH.entity }}>
      <Handles />
      <div className="flex items-center gap-1.5 border-b border-slate-200 bg-emerald-50 px-2.5 py-1.5 dark:bg-emerald-950/40">
        <Table2 size={13} className="shrink-0 text-emerald-600" />
        <span className="truncate font-mono text-xs font-semibold text-slate-900" title={e.name}>
          {e.name}
        </span>
      </div>
      {e.fields?.length ? (
        <ul className="px-2.5 py-1">
          {e.fields.map((f, i) => (
            <li key={i} className="flex justify-between gap-2 font-mono text-[10px] leading-4">
              <span className="flex min-w-0 items-center gap-1">
                {f.pk && (
                  <KeyRound
                    size={9}
                    className="shrink-0 text-amber-500"
                    aria-label="chave primária"
                  />
                )}
                {f.fk && (
                  <span
                    className="shrink-0 rounded-sm bg-sky-100 px-0.5 text-[8px] leading-3 font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                    title={`FK → ${f.fk.entity}${f.fk.field ? `.${f.fk.field}` : ''}`}
                  >
                    FK
                  </span>
                )}
                <span className={`truncate ${f.pk ? 'font-semibold' : ''} text-slate-700`}>
                  {f.name}
                </span>
              </span>
              {f.type && <span className="shrink-0 text-slate-400">{f.type}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-2.5 py-1 text-[10px] text-slate-400 italic">sem campos</div>
      )}
    </div>
  )
})
