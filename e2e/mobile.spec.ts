import { expect, test, type Page } from '@playwright/test'

// Celular com toque (projeto "mobile" do playwright.config.ts), nos dois tamanhos da issue.
const SIZES = [
  { name: '375×667', viewport: { width: 375, height: 667 } },
  { name: '390×844', viewport: { width: 390, height: 844 } },
]

const scenario = {
  id: 'mob',
  name: 'Mobile',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  components: [
    { id: 'app', kind: 'client', name: 'App', layout: { x: 0, y: 0 } },
    { id: 'api', kind: 'server', name: 'API', layout: { x: 0, y: 200 } },
    {
      id: 'db',
      kind: 'database',
      name: 'DB',
      layout: { x: 0, y: 400 },
      details: {
        entities: [
          { id: 'users', name: 'users', fields: [{ name: 'id', type: 'uuid', pk: true }] },
          { id: 'orders', name: 'orders' },
        ],
      },
    },
  ],
  connections: [{ id: 'app-api', source: 'app', target: 'api' }],
}

const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`)

async function open(page: Page) {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles({
    name: 'mob.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(scenario)),
  })
  await expect(node(page, 'api')).toBeVisible()
}

async function expectNoHorizontalScroll(page: Page) {
  const { scroll, inner } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    inner: window.innerWidth,
  }))
  expect(scroll).toBeLessThanOrEqual(inner)
}

for (const size of SIZES) {
  test.describe(`celular ${size.name}`, () => {
    test.use({ viewport: size.viewport })

    test('abre o cenário, sem rolagem horizontal e com a barra de ferramentas inteira na tela', async ({
      page,
    }) => {
      await open(page)
      await expectNoHorizontalScroll(page)
      // Colunas laterais viraram folhas: o canvas ocupa a largura toda.
      const pane = (await page.locator('.react-flow').first().boundingBox())!
      expect(pane.width).toBeGreaterThan(size.viewport.width - 2)
      for (const name of ['Mais ações', 'Desfazer (Ctrl+Z)', 'Cenários']) {
        const box = (await page.getByRole('button', { name }).boundingBox())!
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(size.viewport.width)
        // Alvo de toque de pelo menos ~44 px.
        expect(box.height).toBeGreaterThanOrEqual(43)
        expect(box.width).toBeGreaterThanOrEqual(43)
      }
      await expect(page.getByLabel('Nome do cenário')).toHaveValue('Mobile')
    })

    test('adiciona um componente pela paleta (botão +)', async ({ page }) => {
      await open(page)
      await expect(page.locator('.react-flow__node')).toHaveCount(3)
      await page.getByRole('button', { name: 'Adicionar componente' }).tap()
      await expect(page.getByLabel('Paleta de componentes')).toBeVisible()
      await page.getByRole('button', { name: 'Cache' }).tap()
      await expect(page.getByLabel('Paleta de componentes')).toHaveCount(0)
      await expect(page.locator('.react-flow__node')).toHaveCount(4)
    })

    test('liga dois componentes tocando numa alça e depois na outra', async ({ page }) => {
      await open(page)
      await expect(page.locator('.react-flow__edge')).toHaveCount(1)
      await node(page, 'api').tap()
      // Selecionado: as alças aparecem (não há hover no toque).
      const from = node(page, 'api').locator('.react-flow__handle[data-handleid="bottom"]')
      await expect(from).toHaveCSS('opacity', '1')
      await from.tap()
      const to = node(page, 'db').locator('.react-flow__handle[data-handleid="top"]')
      await to.tap()
      await expect(page.locator('.react-flow__edge')).toHaveCount(2)
    })

    test('edita o nome no painel de detalhes e fecha o painel', async ({ page }) => {
      await open(page)
      await node(page, 'api').tap()
      const sheet = page.getByLabel('Detalhes')
      // Abre só como barra, deixando o canvas à vista; expande para editar.
      await expect(sheet).toBeVisible()
      await expect(sheet.getByLabel('Nome', { exact: true })).toHaveCount(0)
      await sheet.getByRole('button', { name: 'Expandir painel' }).tap()
      await sheet.getByLabel('Nome', { exact: true }).fill('Gateway API')
      await sheet.getByLabel('Nome', { exact: true }).blur()
      await expect(node(page, 'api')).toContainText('Gateway API')
      await sheet.getByRole('button', { name: 'Expandir painel' }).tap()
      await expect(sheet.getByRole('button', { name: 'Expandir painel' })).toBeDisabled()
      await sheet.getByRole('button', { name: 'Reduzir painel' }).tap()
      await sheet.getByRole('button', { name: 'Fechar painel' }).tap()
      await expect(sheet).toHaveCount(0)
      // Tocar de novo no mesmo nó reabre o painel.
      await node(page, 'api').tap()
      await expect(page.getByLabel('Detalhes')).toBeVisible()
      await expectNoHorizontalScroll(page)
    })

    test('diagrama interno abre direto em tela cheia', async ({ page }) => {
      await open(page)
      await node(page, 'db').tap()
      await page.getByRole('button', { name: 'Expandir painel' }).tap()
      await page
        .getByLabel('Detalhes')
        .getByRole('button', { name: /Diagrama ER/ })
        .tap()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.locator('.react-flow__node')).toHaveCount(2)
      const box = (await dialog.boundingBox())!
      expect(box.width).toBeLessThanOrEqual(size.viewport.width)
      await expectNoHorizontalScroll(page)
      await dialog.getByRole('button', { name: 'Fechar', exact: true }).tap()
      await expect(dialog).toHaveCount(0)
    })

    test('desfaz e exporta pelo menu de mais ações', async ({ page }) => {
      await open(page)
      await page.getByRole('button', { name: 'Adicionar componente' }).tap()
      await page.getByRole('button', { name: 'Fila / Mensageria' }).tap()
      await expect(page.locator('.react-flow__node')).toHaveCount(4)
      await page.getByRole('button', { name: 'Desfazer (Ctrl+Z)' }).tap()
      await expect(page.locator('.react-flow__node')).toHaveCount(3)

      await page.getByRole('button', { name: 'Mais ações' }).tap()
      await page.getByRole('button', { name: 'Exportar' }).tap()
      const download = page.waitForEvent('download')
      await page.getByRole('button', { name: /Resumo \(Markdown\)/ }).tap()
      expect((await download).suggestedFilename()).toBe('mobile.md')
    })
  })
}
