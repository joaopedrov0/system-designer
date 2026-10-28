import { useEditor } from '../../store/editor'
import { CommitTextarea, Field } from '../fields'
import { DeleteButton, SectionTitle } from './Inspector'

export default function NoteInspector({ id }: { id: string }) {
  const note = useEditor((s) => s.scenario.notes.find((n) => n.id === id))
  const { updateNote, removeElements } = useEditor.getState()
  if (!note) return null

  return (
    <div className="space-y-4 p-4">
      <SectionTitle>Nota</SectionTitle>
      <Field label="Texto">
        <CommitTextarea value={note.text} onCommit={(text) => updateNote(id, text)} />
      </Field>
      <p className="text-xs text-slate-500">
        Dica: dê um duplo clique na nota para editar no canvas.
      </p>
      <div className="border-t border-slate-100 pt-3">
        <DeleteButton label="Excluir nota" onClick={() => removeElements({ noteIds: [id] })} />
      </div>
    </div>
  )
}
