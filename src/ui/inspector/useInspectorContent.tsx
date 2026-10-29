import { useEditor } from '../../store/editor'
import ComponentInspector from './ComponentInspector'
import ConnectionInspector from './ConnectionInspector'
import GroupInspector from './GroupInspector'
import { DeleteButton } from './Inspector'
import NoteInspector from './NoteInspector'
import ScenarioInspector from './ScenarioInspector'

/** Conteúdo do painel de detalhes para a seleção atual (e quantos itens estão selecionados). */
export function useInspectorContent() {
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

  return { content, total }
}
