import { ReactFlowProvider } from '@xyflow/react'
import { useEffect, useState } from 'react'
import { IndexedDbRepository } from './persistence/indexeddb'
import { redo, undo, useEditor } from './store/editor'
import { initFileLinks } from './store/fileLinks'
import { initScenarios } from './store/scenarios'
import { useResolvedTheme, useView } from './store/view'
import Canvas from './ui/canvas/Canvas'
import Inspector from './ui/inspector/Inspector'
import Palette from './ui/palette/Palette'
import Toolbar from './ui/toolbar/Toolbar'

const repository = new IndexedDbRepository()

export default function App() {
  const [ready, setReady] = useState(false)
  const scenarioId = useEditor((s) => s.scenario.id)
  const lastError = useEditor((s) => s.lastError)
  const clearError = useEditor((s) => s.clearError)
  const notice = useEditor((s) => s.notice)
  const clearNotice = useEditor((s) => s.clearNotice)

  const theme = useResolvedTheme()
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    initScenarios(repository).then(
      () => {
        setReady(true)
        initFileLinks()
      },
      (err) => useEditor.getState().showError(err),
    )
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return
      if (!(e.ctrlKey || e.metaKey || e.altKey)) {
        // Atalhos de uma tecla para os modos de visualização.
        const view = useView.getState()
        if (e.key === 'Escape' && view.laser) view.setLaser(false)
        else if (e.key.toLowerCase() === 'l') view.setLaser(!view.laser)
        else if (e.key.toLowerCase() === 'f') view.toggleFlow()
        return
      }
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) undo()
      else if ((key === 'z' && e.shiftKey) || key === 'y') redo()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!lastError) return
    const t = setTimeout(clearError, lastError.length > 120 ? 10000 : 4000)
    return () => clearTimeout(t)
  }, [lastError, clearError])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(clearNotice, 3500)
    return () => clearTimeout(t)
  }, [notice, clearNotice])

  return (
    <ReactFlowProvider>
      <div className="flex h-screen flex-col bg-slate-50 text-slate-900">
        <Toolbar />
        <div className="flex min-h-0 flex-1">
          <Palette />
          <main className="relative min-w-0 flex-1">
            {ready ? (
              <Canvas key={scenarioId} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Carregando…
              </div>
            )}
            {lastError && (
              <div
                role="alert"
                onClick={clearError}
                className="absolute bottom-4 left-1/2 z-10 max-h-64 max-w-xl -translate-x-1/2 cursor-pointer overflow-y-auto rounded-md bg-red-600 px-4 py-2 text-sm whitespace-pre-line text-white shadow-lg"
              >
                {lastError}
              </div>
            )}
            {notice && !lastError && (
              <div
                role="status"
                onClick={clearNotice}
                className="absolute bottom-4 left-1/2 z-10 max-w-xl -translate-x-1/2 cursor-pointer rounded-md bg-slate-800 px-4 py-2 text-sm text-slate-50 shadow-lg"
              >
                {notice}
              </div>
            )}
          </main>
          <Inspector />
        </div>
      </div>
    </ReactFlowProvider>
  )
}
