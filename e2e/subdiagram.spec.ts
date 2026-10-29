import { expect, test, type Page } from '@playwright/test'

const scenario = {
  id: 'sub',
  name: 'Sub',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  components: [
    {
      id: 'app',
      kind: 'client',
      name: 'App',
      layout: { x: 0, y: 0 },
      details: {
        screens: [
          { id: 'home', name: 'Home', path: '/', layout: { x: 0, y: 0 } },
          { id: 'login', name: 'Login', path: '/login', layout: { x: 260, y: 0 } },
          { id: 'perfil', name: 'Perfil', layout: { x: 260, y: 160 } },
        ],
        navigation: [{ id: 'home-login', from: 'home', to: 'login', label: 'entrar' }],
      },
    },
    {
      id: 'db',
      kind: 'database',
      name: 'DB',
      layout: { x: 400, y: 0 },
      details: {
        entities: [
          { id: 'users', name: 'users', fields: [{ name: 'id', type: 'uuid' }] },
          { id: 'orders', name: 'orders' },
        ],
      },
    },
  ],
  connections: [{ id: 'app-db', source: 'app', target: 'db' }],
}

async function open(page: Page, id: string, data: unknown = scenario) {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles({
    name: 'sub.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(data)),
  })
  await page.locator(`.react-flow__node[data-id="${id}"]`).click()
}

const sub = (page: Page) => page.getByTestId('subdiagram')

test('mapa de navegação: abre com as ligações, Delete remove a ligação e não o componente', async ({
  page,
}) => {
  await open(page, 'app')
  // Já tem navegação: abre direto.
  await expect(sub(page).locator('.react-flow__node')).toHaveCount(3)
  await expect(sub(page).locator('.react-flow__edge')).toHaveCount(1)
  await expect(sub(page).getByText('entrar')).toBeVisible()

  await sub(page).locator('.react-flow__edge').click({ force: true })
  await expect(page.getByText('Ação', { exact: true })).toBeVisible()
  await page.keyboard.press('Delete')
  await expect(sub(page).locator('.react-flow__edge')).toHaveCount(0)
  // O componente selecionado no canvas principal continua lá.
  await expect(page.locator('.react-flow__node[data-id="app"]').first()).toBeVisible()

  await page.keyboard.press('Control+z')
  await expect(sub(page).locator('.react-flow__edge')).toHaveCount(1)
})

test('arrastar de uma tela a outra cria a navegação', async ({ page }) => {
  await open(page, 'app')
  const login = sub(page).locator('.react-flow__node[data-id="login"]')
  const perfil = sub(page).locator('.react-flow__node[data-id="perfil"]')
  await login.hover()
  const handle = login.locator('.react-flow__handle-bottom')
  const from = (await handle.boundingBox())!
  const to = (await perfil.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + 4, { steps: 10 })
  await perfil.locator('.react-flow__handle-top').hover({ force: true })
  await page.mouse.up()
  await expect(sub(page).locator('.react-flow__edge')).toHaveCount(2)
})

test('banco: diagrama ER começa fechado, abre, cria tabela e expande em tela cheia', async ({
  page,
}) => {
  await open(page, 'db')
  await expect(sub(page)).toHaveCount(0)
  await page.getByRole('button', { name: /Diagrama ER/ }).click()
  await expect(sub(page).locator('.react-flow__node')).toHaveCount(2)
  await expect(sub(page).getByText('uuid')).toBeVisible()

  await sub(page).getByRole('button', { name: 'Tabela' }).click()
  await expect(sub(page).locator('.react-flow__node')).toHaveCount(3)
  // A tabela nova também aparece na lista do inspector.
  await expect(page.getByLabel('Nome da tabela').last()).toHaveValue('nova_tabela')

  await sub(page).getByRole('button', { name: 'Expandir diagrama' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('.react-flow__node')).toHaveCount(3)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('ER: chave estrangeira liga as tabelas sozinha, com PK/FK no nó e pé de galinha', async ({
  page,
}) => {
  const withFk = structuredClone(scenario)
  withFk.components[1].details = {
    entities: [
      { id: 'users', name: 'users', fields: [{ name: 'id', type: 'uuid', pk: true }] },
      {
        id: 'orders',
        name: 'orders',
        fields: [
          { name: 'id', type: 'uuid', pk: true },
          { name: 'user_id', type: 'uuid', fk: { entity: 'users', field: 'id' } },
        ],
      },
    ],
  } as never
  await open(page, 'db', withFk)
  await page.getByRole('button', { name: /Diagrama ER/ }).click()
  // Nenhum relacionamento desenhado à mão, mas a ligação aparece.
  await expect(sub(page).locator('.react-flow__edge')).toHaveCount(1)
  await expect(sub(page).locator('.react-flow__edge-text')).toHaveText('user_id')
  await expect(sub(page).getByText('FK', { exact: true })).toBeVisible()
  await expect(sub(page).getByLabel('chave primária')).toHaveCount(2)
  // Um glifo por ponta: barras no lado "1", três dentes no lado "N".
  await expect(sub(page).locator('.react-flow__edge path[stroke-width="1.5"]')).toHaveCount(2)

  // Editar o campo em texto mantém a FK.
  const orders = page.getByLabel('Campos').last()
  await expect(orders).toHaveValue('id: uuid pk, user_id: uuid fk users.id')
})
