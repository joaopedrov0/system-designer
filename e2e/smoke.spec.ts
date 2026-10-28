import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`)

async function dropFromPalette(page: Page, label: string, x: number, y: number) {
  const pane = page.locator('.react-flow__pane')
  await page.getByRole('button', { name: label, exact: true }).dragTo(pane, {
    targetPosition: { x, y },
  })
}

/** Arrasta de uma alça (handle) de um nó até a alça de outro. */
async function connectHandles(
  page: Page,
  from: string,
  fromSide: string,
  to: string,
  toSide: string,
) {
  const handle = (id: string, side: string) =>
    node(page, id).locator(`.react-flow__handle[data-handleid="${side}"]`)
  const a = (await handle(from, fromSide).boundingBox())!
  const b = (await handle(to, toSide).boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 })
  await page.mouse.up()
}

test('primeira abertura cria exatamente um cenário', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Arraste componentes da barra lateral')).toBeVisible()
  await page.getByRole('button', { name: 'Cenários' }).click()
  await expect(page.locator('ul li div.truncate')).toHaveText(['Meu sistema'])
})

test('criar, conectar, detalhar, exportar e recarregar', async ({ page }) => {
  await page.goto('/')
  await dropFromPalette(page, 'Cliente', 200, 250)
  await dropFromPalette(page, 'Servidor', 600, 250)
  await expect(node(page, 'cliente')).toBeVisible()
  await expect(node(page, 'servidor')).toBeVisible()

  await connectHandles(page, 'cliente', 'right', 'servidor', 'left')
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)

  // Detalhe opcional: uma rota no servidor.
  await node(page, 'servidor').click()
  await page.getByRole('button', { name: 'Rotas' }).click()
  const path = page.getByLabel('Caminho')
  await path.fill('/health')
  await path.press('Enter')
  await expect(node(page, 'servidor')).toContainText('1 rota')

  // Exporta o JSON e confere o conteúdo.
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar' }).click()
  await page.getByRole('button', { name: /Cenário \(JSON\)/ }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('meu-sistema.json')
  const exported = JSON.parse(await readFile((await download.path())!, 'utf-8'))
  expect(exported.components.map((c: { id: string }) => c.id)).toEqual(['cliente', 'servidor'])
  expect(exported.connections).toHaveLength(1)
  expect(exported.components[1].details.routes[0]).toMatchObject({ method: 'GET', path: '/health' })

  // Autosave: recarregar mantém tudo.
  await expect(page.getByText('Salvo', { exact: true })).toBeVisible()
  await page.reload()
  await expect(node(page, 'servidor')).toContainText('1 rota')
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
})

test('importar JSON mínimo escrito à mão', async ({ page }) => {
  await page.goto('/')
  const minimal = {
    id: 'loja',
    name: 'Loja',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    components: [
      { id: 'web', kind: 'client', name: 'Web', layout: { x: 0, y: 0 } },
      { id: 'api', kind: 'server', name: 'API', layout: { x: 300, y: 0 } },
    ],
    connections: [{ id: 'web-api', source: 'web', target: 'api', protocol: 'http' }],
  }
  await page.getByTestId('import-input').setInputFiles({
    name: 'loja.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(minimal)),
  })
  await expect(page.getByLabel('Nome do cenário')).toHaveValue('Loja')
  await expect(node(page, 'api')).toBeVisible()
  await expect(page.locator('.react-flow__edge-text')).toHaveText('HTTP')
})
