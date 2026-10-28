import { expect, test, type Page } from '@playwright/test'

const scenario = {
  id: 'demo',
  name: 'Demo',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  components: [
    { id: 'web', kind: 'client', name: 'Web', layout: { x: 0, y: 0 } },
    { id: 'api', kind: 'server', name: 'API', layout: { x: 400, y: 0 } },
  ],
  connections: [{ id: 'web-api', source: 'web', target: 'api', protocol: 'http' }],
}

/**
 * O seletor de arquivos nativo não é automatizável: aqui ele devolve arquivos do OPFS
 * (sistema de arquivos privado da origem), que são FileSystemFileHandle de verdade —
 * leitura, escrita, permissão e guarda no IndexedDB passam pelo mesmo código.
 */
async function fakePickers(page: Page) {
  await page.addInitScript(() => {
    const dir = () => navigator.storage.getDirectory()
    Object.assign(window, {
      showSaveFilePicker: async (o?: { suggestedName?: string }) =>
        (await dir()).getFileHandle(o?.suggestedName ?? 'sem-nome.json', { create: true }),
      showOpenFilePicker: async () => [await (await dir()).getFileHandle('externo.json')],
    })
  })
}

const readFile = (page: Page, name: string) =>
  page.evaluate(async (name) => {
    const dir = await navigator.storage.getDirectory()
    return (await (await dir.getFileHandle(name)).getFile()).text()
  }, name)

/** Outro programa (um agente, um editor de texto) gravando no arquivo. */
const writeFile = (page: Page, name: string, text: string) =>
  page.evaluate(
    async ([name, text]) => {
      const dir = await navigator.storage.getDirectory()
      const w = await (await dir.getFileHandle(name, { create: true })).createWritable()
      await w.write(text)
      await w.close()
    },
    [name, text],
  )

async function open(page: Page) {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles({
    name: 'demo.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(scenario)),
  })
  await expect(page.locator('.react-flow__node[data-id="api"]')).toBeVisible()
}

const nodes = (page: Page) => page.locator('.react-flow__node')
const status = (page: Page) => page.getByTestId('file-link-status')

test('arquivo vinculado: grava as mudanças do editor e aplica as feitas por fora', async ({
  page,
}) => {
  await fakePickers(page)
  await open(page)
  await page.getByRole('button', { name: 'Vincular a um arquivo' }).click()
  await page.getByRole('button', { name: /Salvar em arquivo e vincular/ }).click()
  await expect(status(page)).toHaveText('demo.json')
  await expect.poll(async () => JSON.parse(await readFile(page, 'demo.json')).name).toBe('Demo')

  // Editor -> arquivo
  await page.getByRole('button', { name: 'Cache' }).click()
  await expect(nodes(page)).toHaveCount(3)
  await expect
    .poll(async () => JSON.parse(await readFile(page, 'demo.json')).components.length)
    .toBe(3)

  // Arquivo -> editor (como um agente faria via MCP)
  const onDisk = JSON.parse(await readFile(page, 'demo.json'))
  onDisk.components.push({ id: 'agente', kind: 'worker', name: 'Agente', layout: { x: 0, y: 300 } })
  await writeFile(page, 'demo.json', JSON.stringify(onDisk))
  await expect(page.locator('.react-flow__node[data-id="agente"]')).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('Cenário atualizado a partir de demo.json.')

  // A mudança externa entra no histórico.
  await page.getByRole('button', { name: /Desfazer/ }).click()
  await expect(page.locator('.react-flow__node[data-id="agente"]')).toHaveCount(0)
  await expect
    .poll(async () => JSON.parse(await readFile(page, 'demo.json')).components.length)
    .toBe(3)

  // Depois de recarregar, o vínculo volta sozinho e mudanças feitas com a página
  // fechada são aplicadas.
  await page.reload()
  await expect(status(page)).toHaveText('demo.json')
  onDisk.components.push({ id: 'tarde', kind: 'cache', name: 'Tarde', layout: { x: 300, y: 300 } })
  await writeFile(page, 'demo.json', JSON.stringify(onDisk))
  await expect(page.locator('.react-flow__node[data-id="tarde"]')).toBeVisible()

  // Desvincular para de sincronizar.
  await page.getByRole('button', { name: /Arquivo vinculado/ }).click()
  await page.getByRole('button', { name: 'Desvincular' }).click()
  await expect(status(page)).toHaveText('Arquivo')
  await writeFile(page, 'demo.json', JSON.stringify({ ...onDisk, components: [] }))
  await page.waitForTimeout(1500)
  await expect(page.locator('.react-flow__node[data-id="tarde"]')).toBeVisible()
})

test('abrir arquivo e vincular; arquivo inválido não estraga o cenário', async ({ page }) => {
  await fakePickers(page)
  await page.goto('/')
  await writeFile(
    page,
    'externo.json',
    JSON.stringify({
      id: 'externo',
      name: 'Externo',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      components: [{ id: 'fila', kind: 'queue', name: 'Fila', layout: { x: 0, y: 0 } }],
    }),
  )
  await page.getByRole('button', { name: 'Vincular a um arquivo' }).click()
  await page.getByRole('button', { name: /Abrir arquivo e vincular/ }).click()
  await expect(page.getByLabel('Nome do cenário')).toHaveValue('Externo')
  await expect(page.locator('.react-flow__node[data-id="fila"]')).toBeVisible()
  await expect(status(page)).toHaveText('externo.json')

  await writeFile(page, 'externo.json', '{ "meio do caminho": ')
  await expect(page.getByRole('button', { name: /Arquivo vinculado/ })).toBeVisible()
  await page.getByRole('button', { name: /Arquivo vinculado/ }).click()
  await expect(page.getByText('O arquivo não contém JSON válido.')).toBeVisible()
  await expect(page.locator('.react-flow__node[data-id="fila"]')).toBeVisible()
})

test('exporta resumo em Markdown e diagrama Mermaid', async ({ page }) => {
  await open(page)
  const download = async (item: RegExp) => {
    await page.getByRole('button', { name: 'Exportar' }).click()
    const [file] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: item }).click(),
    ])
    const stream = await file.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(chunk as Buffer)
    return { name: file.suggestedFilename(), text: Buffer.concat(chunks).toString('utf8') }
  }
  const md = await download(/Resumo \(Markdown\)/)
  expect(md.name).toBe('demo.md')
  expect(md.text).toContain('# Demo')
  expect(md.text).toContain('| Web | → | API | HTTP |')
  const mmd = await download(/Diagrama Mermaid/)
  expect(mmd.name).toBe('demo.mmd')
  expect(mmd.text).toContain('c_web -->|"HTTP"| c_api')
})
