/**
 * Vínculo entre o cenário aberto e um arquivo .json no disco: guarda qual arquivo
 * pertence a cada cenário, reconecta ao abrir e liga/desliga a sincronização.
 */
import { fromJSON, slugify } from '../core'
import {
  fileAccessSupported,
  hasPermission,
  linkedFile,
  loadHandle,
  pickExistingFile,
  pickNewFile,
  removeHandle,
  requestPermission,
  saveHandle,
  type FileHandle,
} from '../persistence/fileHandles'
import { useEditor } from './editor'
import { setFileLinkStatus, startFileSync, type FileSync, type FileSyncOptions } from './fileSync'
import { openFileScenario } from './scenarios'

let current: { scenarioId: string; handle: FileHandle; sync?: FileSync } | undefined
let initialized = false

// Operações em fila: trocar de cenário e vincular nunca se atropelam.
let ops = Promise.resolve()
/** Erros dentro da fila são mostrados aqui; a promessa devolvida nunca rejeita. */
function enqueue(op: () => Promise<void>): Promise<void> {
  ops = ops.then(op).catch((err) => useEditor.getState().showError(err))
  return ops
}

/** Liga o vínculo para o cenário aberto e para cada cenário aberto depois. Idempotente. */
export function initFileLinks() {
  if (initialized || !fileAccessSupported) return
  initialized = true
  void enqueue(() => attach(useEditor.getState().scenario.id))
  useEditor.subscribe((state, prev) => {
    if (state.scenario.id !== prev.scenario.id) void enqueue(() => attach(state.scenario.id))
  })
  // Melhor esforço: grava o que estiver pendente ao fechar a página.
  window.addEventListener('pagehide', () => void current?.sync?.flush())
}

async function detach() {
  const sync = current?.sync
  current = undefined
  await sync?.stop()
  setFileLinkStatus({ kind: 'none' })
}

async function attach(scenarioId: string, known?: FileHandle) {
  if (current?.scenarioId === scenarioId) return
  await detach()
  const handle = known ?? (await loadHandle(scenarioId).catch(() => undefined))
  if (!handle) return
  current = { scenarioId, handle }
  if (await hasPermission(handle)) start()
  else setFileLinkStatus({ kind: 'needs-permission', name: handle.name })
}

function start(options?: FileSyncOptions) {
  if (!current) return
  current.sync = startFileSync(linkedFile(current.handle), options)
}

/** Pede de novo a permissão de escrita (depois de recarregar a página). Exige um clique. */
export function reconnectFile(): Promise<void> {
  // A permissão é pedida já, ainda dentro do gesto do usuário; a fila vem depois.
  const handle = current?.handle
  if (!handle) return Promise.resolve()
  const granted = requestPermission(handle)
  return enqueue(async () => {
    if (!(await granted)) throw new Error('Sem permissão para escrever no arquivo.')
    if (current?.handle === handle && !current.sync) start()
  })
}

/** Grava o cenário aberto num arquivo novo (ou escolhido para ser sobrescrito) e vincula. */
export async function linkNewFile(): Promise<void> {
  const { scenario } = useEditor.getState()
  const handle = await pickNewFile(`${slugify(scenario.name) || 'cenario'}.json`)
  await enqueue(async () => {
    await detach()
    await saveHandle(scenario.id, handle)
    current = { scenarioId: scenario.id, handle }
    start({ initial: 'push' })
  })
}

/** Abre um cenário de um arquivo e passa a sincronizar com ele. */
export async function linkExistingFile(): Promise<void> {
  const handle = await pickExistingFile()
  // O seletor de abrir só dá leitura; a escrita é pedida já, ainda perto do clique. Se
  // o navegador não mostrar o pedido, o vínculo fica aguardando "Reconectar".
  const write = requestPermission(handle).catch(() => false)
  await enqueue(async () => {
    await write
    const scenario = fromJSON(await (await handle.getFile()).text())
    await detach()
    await saveHandle(scenario.id, handle)
    // Se o id mudar, a troca de cenário enfileira attach(), que encontra este handle.
    const sameScenario = scenario.id === useEditor.getState().scenario.id
    await openFileScenario(scenario)
    if (sameScenario) await attach(scenario.id, handle)
  })
}

export function unlinkFile(): Promise<void> {
  return enqueue(async () => {
    const id = current?.scenarioId
    await detach()
    if (id) await removeHandle(id)
  })
}
