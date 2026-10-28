import { Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEditor } from '../../store/editor'
import ComponentInspector from './ComponentInspector'
import ConnectionInspector from './ConnectionInspector'
import GroupInspector from './GroupInspector'
import NoteInspector from './NoteInspector'
import ScenarioInspector from './ScenarioInspector'

export default function Inspector() {
  const selection = useEditor((s) => s.selection)
  const scenario = useEditor((s) => s.scenario)
  const removeElements = useEditor((s) => s.removeElements)

  // A seleção pode apontar para algo que um undo removeu; filtra pelo que existe.
  const existing = (ids: string[], list: { id: string }[]) =>
    ids.filter((id) => list.some((x) => x.id === id))
  const ids = {
    componentIds: existing(selection.componentIds, scenario.components),
    connectionIds: existing(selection.connectionIds, scenario.connections),
    groupIds: existing(selection.groupIds, scenario.groups),
    noteIds: existing(selection.noteIds, scenario.notes),
  }
  const total = Object.values(ids).reduce((sum, list) => sum + list.length, 0)

  let content
  if (total === 0) content = <ScenarioInspector />
  else if (total > 1)
    content = (
      <div className="space-y-3 p-4">
        <p className="text-sm text-slate-600">{total} itens selecionados.</p>
        <DeleteButton label="Excluir selecionados" onClick={() => removeElements(ids)} />
      </div>
    )
  else if (ids.componentIds[0])
    content = <ComponentInspector key={ids.componentIds[0]} id={ids.componentIds[0]} />
  else if (ids.connectionIds[0])
    content = <ConnectionInspector key={ids.connectionIds[0]} id={ids.connectionIds[0]} />
  else if (ids.groupIds[0]) content = <GroupInspector key={ids.groupIds[0]} id={ids.groupIds[0]} />
  else content = <NoteInspector key={ids.noteIds[0]} id={ids.noteIds[0]} />

  return (
    <aside className="w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-surface">
      {content}
    </aside>
  )
}

export function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50"
    >
      <Trash2 size={14} />
      {label}
    </button>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{children}</h3>
  )
}
