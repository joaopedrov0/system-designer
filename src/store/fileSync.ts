/**
 * Sincronização do cenário aberto com um arquivo .json no disco, nos dois sentidos:
 * - mudanças feitas no editor são gravadas no arquivo (com debounce);
 * - mudanças feitas por fora (um agente de IA via MCP/CLI, um editor de texto, o git)
 *   são detectadas por polling e aplicadas no editor, como um passo de desfazer.
 *
 * Não depende da File System Access API: recebe um `LinkedFile` (ver
 * persistence/fileHandles.ts para a implementação do navegador).
 */
import { create } from 'zustand'
import { fromJSON, toJSON, type Scenario } from '../core'
import { useEditor } from './editor'

export interface FileSnapshot {
  text: string
  /** Data da última modificação (ms). */
  modified: number
}

export interface LinkedFile {
  readonly name: string
  read(): Promise<FileSnapshot>
  write(text: string): Promise<FileSnapshot>
}

export type FileLinkStatus =
  | { kind: 'none' }
  | { kind: 'synced'; name: string }
  | { kind: 'needs-permission'; name: string }
  /** O arquivo mudou por fora mas não é um cenário válido; nada é aplicado. */
  | { kind: 'invalid'; name: string; message: string }
  | { kind: 'error'; name: string; message: string }

export const useFileLink = create<{ status: FileLinkStatus }>(() => ({ status: { kind: 'none' } }))
export const setFileLinkStatus = (status: FileLinkStatus) => useFileLink.setState({ status })

export interface FileSync {
  /** Grava agora qualquer mudança pendente. */
  flush: () => Promise<void>
  /** Para de sincronizar (gravando antes o que estiver pendente). */
  stop: () => Promise<void>
}

export interface FileSyncOptions {
  /**
   * Primeiro contato com o arquivo: `pull` (padrão) aplica o conteúdo do arquivo se
   * diferir do editor — ele pode ter sido editado com a página fechada; `push` grava o
   * cenário do editor por cima (ao vincular um arquivo novo).
   */
  initial?: 'pull' | 'push'
  writeDelayMs?: number
  pollMs?: number
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

export function startFileSync(file: LinkedFile, options: FileSyncOptions = {}): FileSync {
  const { initial = 'pull', writeDelayMs = 400, pollMs = 1000 } = options
  const scenarioId = useEditor.getState().scenario.id
  /** Última modificação conhecida do arquivo e o texto que corresponde a ela. */
  let known: number | undefined
  let lastText: string | undefined
  let invalid = false
  let applying = false
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined

  // Leituras e escritas nunca se intercalam.
  let queue = Promise.resolve()
  const run = (task: () => Promise<void>) => {
    queue = queue.then(task).catch((err) => {
      setFileLinkStatus({ kind: 'error', name: file.name, message: message(err) })
    })
    return queue
  }

  const synced = () => {
    if (!stopped) setFileLinkStatus({ kind: 'synced', name: file.name })
  }

  /** Aplica no editor o conteúdo vindo do arquivo. Devolve se o arquivo era válido. */
  const applyExternal = (snap: FileSnapshot): boolean => {
    known = snap.modified
    lastText = snap.text
    let incoming: Scenario
    try {
      // O id é o do cenário aberto: o arquivo é este cenário, mesmo se alguém mudou o id.
      incoming = { ...fromJSON(snap.text), id: scenarioId }
    } catch (err) {
      invalid = true
      setFileLinkStatus({ kind: 'invalid', name: file.name, message: message(err) })
      return false
    }
    invalid = false
    const editor = useEditor.getState()
    if (editor.scenario.id === scenarioId && toJSON(incoming) !== toJSON(editor.scenario)) {
      applying = true
      try {
        editor.replaceScenario(incoming)
      } finally {
        applying = false
      }
      editor.showNotice(`Cenário atualizado a partir de ${file.name}.`)
    }
    synced()
    return true
  }

  const writeNow = async () => {
    timer = undefined
    const { scenario } = useEditor.getState()
    if (scenario.id !== scenarioId) return
    const snap = await file.read()
    // Mudou por fora desde o último contato: o arquivo vence (o editor guarda o passo
    // anterior no histórico, então a alteração local pode ser recuperada com Desfazer).
    if (snap.modified !== known && snap.text !== lastText && snap.text.trim()) {
      if (applyExternal(snap)) return
      // Arquivo inválido: quem está editando no editor sobrescreve.
    }
    const text = toJSON(scenario)
    if (text === snap.text) {
      known = snap.modified
      lastText = text
    } else {
      const written = await file.write(text)
      known = written.modified
      lastText = text
    }
    invalid = false
    synced()
  }

  const poll = async () => {
    const snap = await file.read()
    if (snap.modified === known) {
      if (!invalid) synced() // recuperado de um erro de leitura
      return
    }
    if (snap.text === lastText) {
      known = snap.modified
      return
    }
    applyExternal(snap)
  }

  const unsubscribe = useEditor.subscribe((state, prev) => {
    if (stopped || applying || state.scenario === prev.scenario) return
    if (state.scenario.id !== scenarioId) return
    clearTimeout(timer)
    timer = setTimeout(() => void run(writeNow), writeDelayMs)
  })

  void run(async () => {
    const snap = await file.read()
    if (initial === 'push' || !snap.text.trim()) {
      known = snap.modified
      lastText = snap.text
      await writeNow()
    } else {
      applyExternal(snap)
    }
  })
  let polling = false
  const interval = setInterval(() => {
    // Sem acumular leituras se o disco estiver lento.
    if (stopped || polling) return
    polling = true
    void run(poll).finally(() => (polling = false))
  }, pollMs)

  const flush = () => {
    if (timer === undefined) return queue
    clearTimeout(timer)
    return run(writeNow)
  }

  return {
    flush,
    stop: async () => {
      if (stopped) return
      unsubscribe()
      clearInterval(interval)
      await flush()
      stopped = true
    },
  }
}
