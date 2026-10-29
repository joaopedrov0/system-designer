import { componentCatalog, componentKindList, type ComponentKind } from '../../core'
import { useEditor } from '../../store/editor'
import { CommitInput, CommitTextarea, Field, Select } from '../fields'
import { CatalogIcon } from '../icons'
import ErrorBoundary from '../ErrorBoundary'
import SubdiagramSection from '../subdiagram/SubdiagramSection'
import DetailSections from './DetailSections'
import InfraSection from './InfraSection'
import { DeleteButton } from './Inspector'

const kindOptions = componentKindList.map((d) => ({ value: d.kind, label: d.label }))

export default function ComponentInspector({ id }: { id: string }) {
  const component = useEditor((s) => s.scenario.components.find((c) => c.id === id))
  const { updateComponent, removeElements } = useEditor.getState()
  if (!component) return null
  const def = componentCatalog[component.kind]

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white"
          style={{ backgroundColor: def.color }}
        >
          <CatalogIcon name={def.icon} size={18} />
        </div>
        <Select<ComponentKind>
          aria-label="Tipo do componente"
          value={component.kind}
          options={kindOptions}
          onChange={(kind) => updateComponent(id, { kind })}
        />
      </div>

      <Field label="Nome">
        <CommitInput value={component.name} onCommit={(name) => updateComponent(id, { name })} />
      </Field>
      <Field label="Tecnologia">
        <CommitInput
          value={component.technology ?? ''}
          onCommit={(technology) => updateComponent(id, { technology })}
          placeholder="ex.: PostgreSQL 16, Node.js, OpenAI (opcional)"
        />
      </Field>
      <Field label="Descrição">
        <CommitTextarea
          value={component.description ?? ''}
          onCommit={(description) => updateComponent(id, { description })}
          placeholder="Responsabilidade deste componente (opcional)"
        />
      </Field>
      <Field label="Tags">
        <CommitInput
          value={(component.tags ?? []).join(', ')}
          onCommit={(text) => updateComponent(id, { tags: text.split(',') })}
          placeholder="ex.: core, pagamentos (separe por vírgula)"
        />
      </Field>

      <InfraSection component={component} />
      <DetailSections component={component} />
      <ErrorBoundary label="Diagrama interno">
        <SubdiagramSection component={component} />
      </ErrorBoundary>

      <div className="border-t border-slate-100 pt-3">
        <DeleteButton
          label="Excluir componente"
          onClick={() => removeElements({ componentIds: [id] })}
        />
      </div>
      <p className="text-[11px] text-slate-400">
        id: <code>{component.id}</code>
      </p>
    </div>
  )
}
