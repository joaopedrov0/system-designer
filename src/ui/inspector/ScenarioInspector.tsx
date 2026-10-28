import { useEditor } from '../../store/editor'
import { CommitInput, CommitTextarea, Field } from '../fields'
import { SectionTitle } from './Inspector'

export default function ScenarioInspector() {
  const scenario = useEditor((s) => s.scenario)
  const { renameScenario, updateScenarioDescription } = useEditor.getState()

  return (
    <div className="space-y-4 p-4">
      <SectionTitle>Cenário</SectionTitle>
      <Field label="Nome">
        <CommitInput value={scenario.name} onCommit={renameScenario} />
      </Field>
      <Field label="Descrição">
        <CommitTextarea
          value={scenario.description ?? ''}
          onCommit={updateScenarioDescription}
          placeholder="O que este sistema faz? (opcional)"
        />
      </Field>
      <p className="text-xs text-slate-500">
        {scenario.components.length} componentes · {scenario.connections.length} conexões
      </p>
      <p className="rounded-md bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
        Selecione um componente ou uma conexão para ver e editar seus detalhes. Tudo além do nome é
        opcional: acrescente rotas, tabelas ou modelos só quando fizer sentido.
      </p>
    </div>
  )
}
