import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { fromJSON } from '../src/core'
import { runCli } from './cli'
import { createServer } from './server'

let dir: string
let file: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sd-mcp-'))
  file = join(dir, 'loja.json')
})

const read = () => fromJSON(readFileSync(file, 'utf8'))

function client(defaultFile?: string) {
  const server = createServer(defaultFile)
  let id = 0
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const res = await server.handle({
      jsonrpc: '2.0',
      id: ++id,
      method: 'tools/call',
      params: { name, arguments: args },
    })
    const result = res!.result as { content: { text: string }[]; isError?: boolean }
    return { text: result.content[0].text, isError: result.isError ?? false }
  }
  return { server, call }
}

describe('servidor MCP', () => {
  it('initialize e tools/list seguem o protocolo', async () => {
    const { server } = client(file)
    const init = await server.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't' } },
    })
    expect(init).toMatchObject({
      id: 1,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: { name: 'system-designer' },
      },
    })
    expect(
      await server.handle({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    ).toBeUndefined()

    const list = await server.handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
    const tools = (
      list!.result as { tools: { name: string; inputSchema: Record<string, unknown> }[] }
    ).tools
    const names = tools.map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining(['create_scenario', 'get_scenario', 'add_component', 'connect']),
    )
    for (const t of tools) {
      expect(t.inputSchema.type).toBe('object')
      expect(t.inputSchema).not.toHaveProperty('$schema')
    }
    const add = tools.find((t) => t.name === 'add_component')!
    expect(add.inputSchema.required).toEqual(['kind'])

    expect(await server.handle({ jsonrpc: '2.0', id: 3, method: 'nada' })).toMatchObject({
      error: { code: -32601 },
    })
  })

  it('sem arquivo padrão, "file" é obrigatório', async () => {
    const { server, call } = client()
    const list = await server.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    const tools = (
      list!.result as { tools: { name: string; inputSchema: { required: string[] } }[] }
    ).tools
    expect(tools.find((t) => t.name === 'connect')!.inputSchema.required).toEqual([
      'file',
      'source',
      'target',
    ])
    expect(await call('get_scenario')).toMatchObject({ isError: true })
    await call('create_scenario', { file, name: 'Loja' })
    expect((await call('get_scenario', { file })).text).toContain('# Loja')
  })

  it('monta um cenário de ponta a ponta no arquivo', async () => {
    const { call: raw } = client(file)
    // Aqui toda chamada precisa dar certo.
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const r = await raw(name, args)
      if (r.isError) throw new Error(`${name}: ${r.text}`)
      return r
    }
    await call('create_scenario', { name: 'Loja' })
    expect((await call('add_component', { kind: 'client', name: 'Web' })).text).toContain('"web"')
    await call('add_component', { kind: 'server', name: 'API', technology: 'Node 22' })
    await call('add_component', { kind: 'database', name: 'Banco' })
    await call('connect', { source: 'web', target: 'api', protocol: 'http' })
    const route = await call('add_detail_item', {
      componentId: 'api',
      section: 'routes',
      item: { method: 'GET', path: '/pedidos' },
    })
    expect(route.text).toContain('"get-pedidos"')
    await call('update_connection', { id: 'web-api', uses: ['get-pedidos'] })
    await call('connect', { source: 'api', target: 'banco', protocol: 'sql', async: false })
    await call('add_group', { name: 'Backend', componentIds: ['api', 'banco'] })
    await call('auto_layout')

    const s = read()
    expect(s.components.map((c) => [c.id, c.groupId])).toEqual([
      ['web', undefined],
      ['api', 'backend'],
      ['banco', 'backend'],
    ])
    expect(s.connections.find((c) => c.id === 'web-api')?.uses).toEqual(['get-pedidos'])
    // O auto-layout põe as camadas da esquerda para a direita.
    const x = (id: string) => s.components.find((c) => c.id === id)!.layout.x
    expect(x('web')).toBeLessThan(x('api'))
    expect(x('api')).toBeLessThan(x('banco'))

    const md = (await call('get_scenario')).text
    expect(md).toContain('| Web | → | API | HTTP |')
    expect((await call('get_scenario', { format: 'json' })).text).toBe(readFileSync(file, 'utf8'))
  })

  it('componentes sem posição não se empilham', async () => {
    const { call } = client(file)
    await call('create_scenario', { name: 'Loja' })
    await call('add_component', { kind: 'server' })
    await call('add_component', { kind: 'server' })
    const [a, b] = read().components
    expect(b.layout.x).toBeGreaterThan(a.layout.x)
  })

  it('erros voltam como isError com mensagem útil, sem mexer no arquivo', async () => {
    const { call } = client(file)
    await call('create_scenario', { name: 'Loja' })
    const before = readFileSync(file, 'utf8')
    expect(await call('add_component', { kind: 'nave' })).toMatchObject({ isError: true })
    expect((await call('add_component', { kind: 'nave' })).text).toContain('kind')
    expect(await call('connect', { source: 'a', target: 'b' })).toEqual({
      isError: true,
      text: 'Componente não encontrado: a',
    })
    expect(
      await call('add_detail_item', { componentId: 'x', section: 'routes', item: { path: 1 } }),
    ).toMatchObject({ isError: true })
    expect(await call('create_scenario', { name: 'De novo' })).toMatchObject({ isError: true })
    expect(readFileSync(file, 'utf8')).toBe(before)
  })

  it('cada chamada relê o arquivo (mudanças do editor no meio são mantidas)', async () => {
    const { call } = client(file)
    await call('create_scenario', { name: 'Loja' })
    const s = read()
    writeFileSync(file, JSON.stringify({ ...s, name: 'Renomeada no editor' }))
    await call('add_component', { kind: 'cache' })
    expect(read().name).toBe('Renomeada no editor')
    expect(read().components).toHaveLength(1)
  })

  it('processo real via stdio (como um cliente MCP o inicia)', async () => {
    writeFileSync(file, '')
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL('../bin/mcp.mjs', import.meta.url)), file],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    )
    const lines = createInterface({ input: child.stdout! })
    const responses: Record<string, unknown>[] = []
    const waitFor = (id: number) =>
      new Promise<Record<string, unknown>>((done) => {
        const check = () => {
          const found = responses.find((r) => r.id === id)
          if (found) done(found)
          else setTimeout(check, 20)
        }
        check()
      })
    lines.on('line', (l) => responses.push(JSON.parse(l)))
    const send = (m: object) => child.stdin!.write(JSON.stringify(m) + '\n')

    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } })
    send({ jsonrpc: '2.0', method: 'notifications/initialized' })
    send({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'create_scenario', arguments: { name: 'Via stdio', overwrite: true } },
    })
    send({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'add_component', arguments: { kind: 'queue', name: 'Fila' } },
    })
    expect(await waitFor(1)).toMatchObject({ result: { serverInfo: { name: 'system-designer' } } })
    expect(await waitFor(3)).toMatchObject({
      result: { content: [{ text: expect.stringContaining('"fila"') }] },
    })
    child.kill()
    expect(read().components.map((c) => c.name)).toEqual(['Fila'])
  }, 30_000)
})

describe('CLI', () => {
  it('cria, altera e lê um cenário', async () => {
    expect(await runCli([file, 'create', 'Loja'])).toContain('criado')
    await runCli([file, 'add_component', '{"kind":"server","name":"API"}'])
    expect(await runCli([file])).toContain('### API')
    expect(await runCli([file, 'get_scenario', '{"format":"mermaid"}'])).toContain('c_api["API"]')
  })

  it('ajuda e erros', async () => {
    expect(await runCli(['help'])).toContain('add_component')
    expect(await runCli(['help', 'connect'])).toContain('"source"')
    await expect(runCli([file, 'get_scenario'])).rejects.toThrow('Arquivo não encontrado')
    await runCli([file, 'create', 'Loja'])
    await expect(runCli([file, 'connect', '{oops'])).rejects.toThrow('objeto JSON')
    await expect(runCli([file, 'voar'])).rejects.toThrow('Operação desconhecida: voar')
  })
})
