import { Redo2, Undo2, Workflow } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useStore } from 'zustand'
import { redo, undo, useEditor, type SaveStatus } from '../../store/editor'
import ExportMenu from './ExportMenu'
import LayoutButton from './LayoutButton'
import ScenarioMenu from './ScenarioMenu'
import ThemeToggle from './ThemeToggle'
import ViewToggles from './ViewToggles'

const saveLabels: Record<SaveStatus, string> = {
  saved: 'Salvo',
  pending: 'Salvando…',
  error: 'Erro ao salvar',
}

export default function Toolbar() {
  const name = useEditor((s) => s.scenario.name)
  const renameScenario = useEditor((s) => s.renameScenario)
  const saveStatus = useEditor((s) => s.saveStatus)
  const canUndo = useStore(useEditor.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(useEditor.temporal, (s) => s.futureStates.length > 0)

  // Rascunho local enquanto o campo está em edição; só vira command ao confirmar.
  const [draft, setDraft] = useState<string | null>(null)

  const commitName = () => {
    if (draft !== null && draft.trim() && draft.trim() !== name) renameScenario(draft)
    setDraft(null)
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-200 bg-surface px-4">
      <div className="flex items-center gap-2 font-semibold text-slate-900">
        <Workflow size={18} />
        System Designer
      </div>
      <span className="text-slate-300">/</span>
      <input
        aria-label="Nome do cenário"
        className="w-64 rounded px-1.5 py-0.5 text-sm text-slate-700 outline-none hover:bg-slate-100 focus:bg-slate-100"
        value={draft ?? name}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            setDraft(null)
            e.currentTarget.blur()
          }
        }}
      />
      <ScenarioMenu />

      <div className="ml-auto flex items-center gap-1">
        <span
          className={`mr-3 text-xs ${saveStatus === 'error' ? 'text-red-600' : 'text-slate-400'}`}
        >
          {saveLabels[saveStatus]}
        </span>
        <ToolButton label="Desfazer (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
          <Undo2 size={16} />
        </ToolButton>
        <ToolButton label="Refazer (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo}>
          <Redo2 size={16} />
        </ToolButton>
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <ViewToggles />
        <LayoutButton />
        <ExportMenu />
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <ThemeToggle />
      </div>
    </header>
  )
}

function ToolButton(props: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={props.label}
      aria-label={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      className="rounded p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {props.children}
    </button>
  )
}
