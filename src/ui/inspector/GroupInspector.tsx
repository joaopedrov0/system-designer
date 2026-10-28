import { componentCatalog } from '../../core'
import { useEditor } from '../../store/editor'
import { CommitInput, CommitTextarea, Field } from '../fields'
import { CatalogIcon } from '../icons'
import { DeleteButton, SectionTitle } from './Inspector'

export default function GroupInspector({ id }: { id: string }) {
  const group = useEditor((s) => s.scenario.groups.find((g) => g.id === id))
  const components = useEditor((s) => s.scenario.components)
  const { updateGroup, removeElements } = useEditor.getState()
  if (!group) return null
  const members = components.filter((c) => c.groupId === id)

  return (
    <div className="space-y-4 p-4">
      <SectionTitle>Grupo</SectionTitle>
      <Field label="Nome">
        <CommitInput value={group.name} onCommit={(name) => updateGroup(id, { name })} />
      </Field>
      <Field label="Descrição">
        <CommitTextarea
          value={group.description ?? ''}
          onCommit={(description) => updateGroup(id, { description })}
          placeholder="ex.: rede privada, serviços de terceiros (opcional)"
        />
      </Field>

      <div className="space-y-1.5">
        <SectionTitle>Membros ({members.length})</SectionTitle>
        {members.length === 0 ? (
          <p className="text-xs text-slate-500">Arraste componentes para dentro do grupo.</p>
        ) : (
          members.map((c) => (
            <div key={c.id} className="flex items-center gap-2 text-sm text-slate-700">
              <span
                className="flex h-5 w-5 items-center justify-center rounded text-white"
                style={{ backgroundColor: componentCatalog[c.kind].color }}
              >
                <CatalogIcon name={componentCatalog[c.kind].icon} size={11} />
              </span>
              {c.name}
            </div>
          ))
        )}
      </div>

      <div className="border-t border-slate-100 pt-3">
        <DeleteButton label="Excluir grupo" onClick={() => removeElements({ groupIds: [id] })} />
        <p className="mt-1 px-2 text-[11px] text-slate-400">
          Os componentes do grupo são mantidos.
        </p>
      </div>
    </div>
  )
}
