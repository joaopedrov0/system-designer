import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addComponent, createScenario, toJSON, type Scenario } from '../core'
import { undo, useEditor } from './editor'
import { startFileSync, useFileLink, type FileSync, type LinkedFile } from './fileSync'

/** Arquivo em memória; `external` simula outro programa gravando nele. */
function fakeFile(text = '') {
  let clock = 1
  const file = {
    name: 'loja.json',
    text,
    modified: clock,
    writes: 0,
    async read() {
      return { text: file.text, modified: file.modified }
    },
    async write(t: string) {
      file.text = t
      file.modified = ++clock
      file.writes++
      return { text: t, modified: file.modified }
    },
    external(t: string) {
      file.text = t
      file.modified = ++clock
    },
  }
  return file satisfies LinkedFile
}

const editor = () => useEditor.getState()
const withComponent = (s: Scenario, name: string) =>
  addComponent(s, { kind: 'server', name, position: { x: 0, y: 0 } }).scenario
const names = () => editor().scenario.components.map((c) => c.name)
const tick = (ms = 0) => vi.advanceTimersByTimeAsync(ms)

let sync: FileSync | undefined

beforeEach(() => {
  vi.useFakeTimers()
  editor().open(createScenario('Loja'))
  editor().clearNotice()
})

afterEach(async () => {
  await sync?.stop()
  sync = undefined
  vi.useRealTimers()
})

describe('sincronização com arquivo', () => {
  it('push: grava o cenário do editor num arquivo novo', async () => {
    const file = fakeFile()
    sync = startFileSync(file, { initial: 'push' })
    await tick()
    expect(file.text).toBe(toJSON(editor().scenario))
    expect(useFileLink.getState().status).toEqual({ kind: 'synced', name: 'loja.json' })
  })

  it('mudanças no editor são gravadas com debounce (uma escrita por rajada)', async () => {
    const file = fakeFile()
    sync = startFileSync(file, { initial: 'push' })
    await tick()
    const writes = file.writes
    editor().addComponent({ kind: 'server', position: { x: 0, y: 0 } })
    editor().addComponent({ kind: 'database', position: { x: 0, y: 0 } })
    await tick(100)
    expect(file.writes).toBe(writes)
    await tick(400)
    expect(file.writes).toBe(writes + 1)
    expect(JSON.parse(file.text).components).toHaveLength(2)
  })

  it('mudança feita por fora é aplicada no editor, sem regravar, e pode ser desfeita', async () => {
    const file = fakeFile()
    sync = startFileSync(file, { initial: 'push' })
    await tick()
    // JSON compacto, como um editor de texto ou script gravaria: não é reformatado.
    file.external(JSON.stringify(withComponent(editor().scenario, 'API do agente')))
    const writes = file.writes
    await tick(1000)
    expect(names()).toEqual(['API do agente'])
    expect(editor().notice).toBe('Cenário atualizado a partir de loja.json.')
    await tick(1000)
    expect(file.writes).toBe(writes)

    undo()
    expect(names()).toEqual([])
  })

  it('o id do arquivo é ignorado: continua sendo o cenário aberto', async () => {
    const file = fakeFile()
    sync = startFileSync(file, { initial: 'push' })
    await tick()
    const id = editor().scenario.id
    file.external(toJSON({ ...withComponent(editor().scenario, 'X'), id: 'outro' }))
    await tick(1000)
    expect(editor().scenario.id).toBe(id)
    expect(names()).toEqual(['X'])
  })

  it('arquivo inválido não é aplicado; quando volta a ser válido, é', async () => {
    const file = fakeFile()
    sync = startFileSync(file, { initial: 'push' })
    await tick()
    const before = editor().scenario
    file.external('{ "meio": ')
    await tick(1000)
    expect(editor().scenario).toBe(before)
    expect(useFileLink.getState().status.kind).toBe('invalid')

    file.external(toJSON(withComponent(before, 'Corrigido')))
    await tick(1000)
    expect(names()).toEqual(['Corrigido'])
    expect(useFileLink.getState().status.kind).toBe('synced')
  })

  it('pull: ao vincular, o conteúdo do arquivo vence se for diferente', async () => {
    const file = fakeFile(toJSON(withComponent(editor().scenario, 'Do disco')))
    sync = startFileSync(file)
    await tick()
    expect(names()).toEqual(['Do disco'])
    expect(file.writes).toBe(0)
  })

  it('pull com o mesmo conteúdo não grava nem mexe no histórico', async () => {
    const file = fakeFile(toJSON(editor().scenario))
    sync = startFileSync(file)
    await tick(2000)
    expect(file.writes).toBe(0)
    expect(useEditor.temporal.getState().pastStates).toHaveLength(0)
  })

  it('conflito: se o arquivo mudou antes da gravação pendente, o arquivo vence', async () => {
    const file = fakeFile()
    sync = startFileSync(file, { initial: 'push', pollMs: 60_000 })
    await tick()
    editor().addComponent({ kind: 'server', name: 'Local', position: { x: 0, y: 0 } })
    file.external(toJSON(withComponent(createScenarioLike(), 'Externo')))
    await tick(500)
    expect(names()).toEqual(['Externo'])
    expect(JSON.parse(file.text).components[0].name).toBe('Externo')
    // A alteração local continua no histórico.
    undo()
    expect(names()).toEqual(['Local'])
  })

  it('stop grava o que estiver pendente', async () => {
    const file = fakeFile()
    sync = startFileSync(file, { initial: 'push' })
    await tick()
    editor().addComponent({ kind: 'server', name: 'Último', position: { x: 0, y: 0 } })
    await sync.stop()
    expect(JSON.parse(file.text).components[0].name).toBe('Último')
  })
})

/** Um cenário com o mesmo id do aberto, como um agente gravaria a partir do arquivo. */
function createScenarioLike(): Scenario {
  return { ...createScenario('Loja'), id: editor().scenario.id }
}
