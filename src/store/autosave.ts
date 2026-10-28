import type { ScenarioRepository } from '../persistence/repository'
import { useEditor } from './editor'

const SAVE_DELAY_MS = 400

export interface Autosave {
  /** Salva imediatamente qualquer mudança pendente. */
  flush: () => Promise<void>
  stop: () => void
}

/** Salva o cenário aberto (com debounce) a cada mudança. */
export function createAutosave(repo: ScenarioRepository): Autosave {
  let timer: ReturnType<typeof setTimeout> | undefined

  const flush = async () => {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
    const { scenario, setSaveStatus } = useEditor.getState()
    try {
      await repo.save(scenario)
      setSaveStatus('saved')
    } catch (err) {
      console.error('Falha ao salvar o cenário', err)
      setSaveStatus('error')
    }
  }

  const unsubscribe = useEditor.subscribe((state, prev) => {
    if (state.scenario === prev.scenario) return
    // Trocar de cenário (open) não precisa salvar; o cenário aberto já está persistido.
    if (state.scenario.id !== prev.scenario.id) return
    state.setSaveStatus('pending')
    clearTimeout(timer)
    timer = setTimeout(flush, SAVE_DELAY_MS)
  })

  const onHide = () => void flush()
  window.addEventListener('pagehide', onHide)

  return {
    flush,
    stop: () => {
      unsubscribe()
      window.removeEventListener('pagehide', onHide)
      void flush()
    },
  }
}
