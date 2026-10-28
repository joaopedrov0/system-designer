/**
 * Arquivos no disco via File System Access API (Chrome/Edge). Os handles ficam guardados
 * no IndexedDB, um por cenário, para que o vínculo sobreviva a recarregar a página; o
 * navegador pede de novo a permissão de escrita (exige um clique) a cada sessão.
 */
import { createStore, del, get, set } from 'idb-keyval'
import type { LinkedFile } from '../store/fileSync'

type Mode = { mode: 'readwrite' }

/** Partes da API que o TypeScript ainda não declara em todos os ambientes. */
export interface FileHandle extends FileSystemFileHandle {
  queryPermission?(descriptor: Mode): Promise<PermissionState>
  requestPermission?(descriptor: Mode): Promise<PermissionState>
}

interface PickerOptions {
  suggestedName?: string
  types?: { description: string; accept: Record<string, string[]> }[]
  multiple?: boolean
}

interface PickerWindow {
  showSaveFilePicker(options?: PickerOptions): Promise<FileHandle>
  showOpenFilePicker(options?: PickerOptions): Promise<FileHandle[]>
}

const picker = window as unknown as Partial<PickerWindow>
const types = [
  { description: 'Cenário do System Designer', accept: { 'application/json': ['.json'] } },
]

export const fileAccessSupported =
  typeof picker.showSaveFilePicker === 'function' && typeof picker.showOpenFilePicker === 'function'

/** O usuário fechou o seletor de arquivos sem escolher. */
export const isAbort = (err: unknown) => err instanceof DOMException && err.name === 'AbortError'

export function pickNewFile(suggestedName: string): Promise<FileHandle> {
  return picker.showSaveFilePicker!({ suggestedName, types })
}

export async function pickExistingFile(): Promise<FileHandle> {
  const [handle] = await picker.showOpenFilePicker!({ types, multiple: false })
  return handle
}

export async function hasPermission(handle: FileHandle): Promise<boolean> {
  return ((await handle.queryPermission?.({ mode: 'readwrite' })) ?? 'granted') === 'granted'
}

/** Precisa ser chamado a partir de um gesto do usuário (clique). */
export async function requestPermission(handle: FileHandle): Promise<boolean> {
  return ((await handle.requestPermission?.({ mode: 'readwrite' })) ?? 'granted') === 'granted'
}

export function linkedFile(handle: FileHandle): LinkedFile {
  return {
    name: handle.name,
    async read() {
      const file = await handle.getFile()
      return { text: await file.text(), modified: file.lastModified }
    },
    async write(text) {
      const writable = await handle.createWritable()
      await writable.write(text)
      await writable.close()
      const file = await handle.getFile()
      return { text, modified: file.lastModified }
    },
  }
}

const store = createStore('system-designer-files', 'handles')

export const loadHandle = (scenarioId: string) => get<FileHandle>(scenarioId, store)
export const saveHandle = (scenarioId: string, handle: FileHandle) => set(scenarioId, handle, store)
export const removeHandle = (scenarioId: string) => del(scenarioId, store)
