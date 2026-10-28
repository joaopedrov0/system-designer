import { ChevronDown, Copy, FilePlus2, FolderOpen, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import type { ScenarioSummary } from '../../persistence/repository'
import { useEditor } from '../../store/editor'
import {
  deleteScenario,
  duplicateScenario,
  importScenario,
  listScenarios,
  newScenario,
  openScenario,
} from '../../store/scenarios'
import Popover, { MenuItem } from './Popover'

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export default function ScenarioMenu() {
  const currentId = useEditor((s) => s.scenario.id)
  const showError = useEditor((s) => s.showError)
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([])
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const refresh = () => {
    setConfirmDelete(null)
    listScenarios().then(setScenarios, showError)
  }
  const run = (action: () => Promise<unknown>, close?: () => void) => {
    close?.()
    action().then(refresh, showError)
  }

  const onImportFile = async (file: File | undefined) => {
    if (!file) return
    try {
      await importScenario(await file.text())
    } catch (err) {
      showError(err)
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        className="hidden"
        data-testid="import-input"
        onChange={(e) => void onImportFile(e.target.files?.[0])}
      />
      <Popover
        label="Cenários"
        onOpen={refresh}
        trigger={() => (
          <>
            <FolderOpen size={16} />
            <ChevronDown size={12} />
          </>
        )}
      >
        {(close) => (
          <>
            <MenuItem
              icon={<FilePlus2 size={15} />}
              onClick={() => run(() => newScenario(), close)}
            >
              Novo cenário
            </MenuItem>
            <MenuItem
              icon={<Upload size={15} />}
              onClick={() => {
                close()
                fileInput.current?.click()
              }}
            >
              Importar JSON…
            </MenuItem>
            <div className="my-1 border-t border-slate-100" />
            <p className="px-3 pt-1 pb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Meus cenários
            </p>
            <ul className="max-h-80 overflow-y-auto">
              {scenarios.map((s) => (
                <li
                  key={s.id}
                  className={`group flex items-center gap-1 px-2 ${s.id === currentId ? 'bg-slate-100' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => run(() => openScenario(s.id), close)}
                    className="min-w-0 flex-1 rounded px-1 py-1.5 text-left hover:bg-slate-100"
                  >
                    <div className="truncate text-sm text-slate-800">{s.name}</div>
                    <div className="text-[11px] text-slate-400">
                      {dateFormat.format(new Date(s.updatedAt))}
                    </div>
                  </button>
                  <button
                    type="button"
                    title="Duplicar"
                    aria-label={`Duplicar ${s.name}`}
                    onClick={() => run(() => duplicateScenario(s.id), close)}
                    className="rounded p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-200 hover:text-slate-700"
                  >
                    <Copy size={14} />
                  </button>
                  {confirmDelete === s.id ? (
                    <button
                      type="button"
                      onClick={() => run(() => deleteScenario(s.id))}
                      className="rounded bg-red-600 px-1.5 py-0.5 text-xs text-white hover:bg-red-700"
                    >
                      Excluir?
                    </button>
                  ) : (
                    <button
                      type="button"
                      title="Excluir"
                      aria-label={`Excluir ${s.name}`}
                      onClick={() => setConfirmDelete(s.id)}
                      className="rounded p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Popover>
    </>
  )
}
