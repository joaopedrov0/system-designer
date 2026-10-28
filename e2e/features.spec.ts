import { expect, test, type Page } from '@playwright/test'

const scenario = {
  id: 'demo',
  name: 'Demo',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  components: [
    { id: 'web', kind: 'client', name: 'Web', layout: { x: 0, y: 0 } },
    { id: 'api', kind: 'server', name: 'API', layout: { x: 400, y: 0 } },
    { id: 'db', kind: 'database', name: 'DB', layout: { x: 800, y: 0 } },
  ],
  connections: [
    // mão dupla numa conexão só
    { id: 'web-api', source: 'web', target: 'api', direction: 'two-way' },
    // ida e volta como duas conexões separadas
    { id: 'api-db', source: 'api', target: 'db', protocol: 'sql' },
    { id: 'db-api', source: 'db', target: 'api', protocol: 'event', async: true },
  ],
}

async function open(page: Page) {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles({
    name: 'demo.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(scenario)),
  })
  await expect(page.locator('.react-flow__node[data-id="db"]')).toBeVisible()
}

const edgePaths = (page: Page, id: string) =>
  page.locator(`.react-flow__edge[data-id="${id}"] path.react-flow__edge-path`)

const zoom = async (page: Page) => {
  const transform = await page.locator('.react-flow__viewport').evaluate((el) => el.style.transform)
  return Number(/scale\(([\d.]+)\)/.exec(transform)![1])
}

test('mão dupla vira duas faixas, sem sobreposição', async ({ page }) => {
  await open(page)
  // Uma conexão de mão dupla desenha dois caminhos (ida e volta), cada um com seta.
  await expect(edgePaths(page, 'web-api')).toHaveCount(2)
  const [go, back] = await edgePaths(page, 'web-api').evaluateAll((els) =>
    els.map((e) => e.getAttribute('d')),
  )
  expect(go).not.toBe(back)
  await expect(page.locator('.react-flow__edge[data-id="web-api"] path[marker-end]')).toHaveCount(2)

  // Duas conexões opostas entre o mesmo par também não se sobrepõem.
  const there = await edgePaths(page, 'api-db').getAttribute('d')
  const back2 = await edgePaths(page, 'db-api').getAttribute('d')
  expect(there).not.toBe(back2)
})

test('visualização de fluxo liga e desliga os sinais', async ({ page }) => {
  await open(page)
  await expect(page.locator('.flow-signal')).toHaveCount(0)
  await page.getByRole('button', { name: /Visualizar fluxo/ }).click()
  // web-api (ida + volta) + api-db + db-api
  await expect(page.locator('.flow-signal')).toHaveCount(4)
  await expect(page.locator('.flow-signal-async')).toHaveCount(1)
  await page.keyboard.press('f')
  await expect(page.locator('.flow-signal')).toHaveCount(0)
})

const translate = async (page: Page) => {
  const transform = await page.locator('.react-flow__viewport').evaluate((el) => el.style.transform)
  const [, x, y] = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(transform)!
  return { x: Number(x), y: Number(y) }
}

/** Arrasto com caneta de verdade: eventos de ponteiro com pointerType "pen" (via CDP). */
async function penDrag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  modifiers = 0, // 2 = Ctrl
) {
  const cdp = await page.context().newCDPSession(page)
  const send = (
    type: 'mouseMoved' | 'mousePressed' | 'mouseReleased',
    x: number,
    y: number,
    buttons: number,
  ) =>
    cdp.send('Input.dispatchMouseEvent', {
      type,
      x,
      y,
      button: type === 'mouseMoved' && buttons === 0 ? 'none' : 'left',
      buttons,
      clickCount: type === 'mouseMoved' ? 0 : 1,
      pointerType: 'pen',
      modifiers,
    })
  await send('mouseMoved', from.x, from.y, 0)
  await send('mousePressed', from.x, from.y, 1)
  for (let i = 1; i <= 10; i++) {
    const x = from.x + ((to.x - from.x) * i) / 10
    const y = from.y + ((to.y - from.y) * i) / 10
    await send('mouseMoved', x, y, 1)
  }
  await send('mouseReleased', to.x, to.y, 0)
  await cdp.detach()
}

/**
 * Simula drivers que, além dos eventos da caneta, emulam um mouse de verdade (eventos de
 * mouse confiáveis que o preventDefault do pointerdown da caneta não suprime).
 */
async function penDragWithEmulatedMouse(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const cdp = await page.context().newCDPSession(page)
  const send = (
    pointerType: 'pen' | 'mouse',
    type: 'mouseMoved' | 'mousePressed' | 'mouseReleased',
    x: number,
    y: number,
    buttons: number,
  ) =>
    cdp.send('Input.dispatchMouseEvent', {
      type,
      x,
      y,
      button: type === 'mouseMoved' && buttons === 0 ? 'none' : 'left',
      buttons,
      clickCount: type === 'mouseMoved' ? 0 : 1,
      pointerType,
    })
  const both = async (
    type: 'mouseMoved' | 'mousePressed' | 'mouseReleased',
    x: number,
    y: number,
    buttons: number,
  ) => {
    await send('pen', type, x, y, buttons)
    await send('mouse', type, x, y, buttons)
  }
  await both('mouseMoved', from.x, from.y, 0)
  await both('mousePressed', from.x, from.y, 1)
  for (let i = 1; i <= 10; i++) {
    await both(
      'mouseMoved',
      from.x + ((to.x - from.x) * i) / 10,
      from.y + ((to.y - from.y) * i) / 10,
      1,
    )
  }
  await both('mouseReleased', to.x, to.y, 0)
  await cdp.detach()
}

/**
 * Reproduz a mesa digitalizadora do usuário (capturado com ?debug=input): para o mesmo
 * traço, o navegador entrega eventos de ponteiro da caneta E eventos de toque
 * (touchstart/touchmove/touchend), sem eventos de mouse.
 */
async function penDragWithTouch(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const cdp = await page.context().newCDPSession(page)
  const pen = (
    type: 'mouseMoved' | 'mousePressed' | 'mouseReleased',
    x: number,
    y: number,
    buttons: number,
  ) =>
    cdp.send('Input.dispatchMouseEvent', {
      type,
      x,
      y,
      button: type === 'mouseMoved' && buttons === 0 ? 'none' : 'left',
      buttons,
      clickCount: type === 'mouseMoved' ? 0 : 1,
      pointerType: 'pen',
    })
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }],
    })
  await pen('mouseMoved', from.x, from.y, 0)
  await pen('mousePressed', from.x, from.y, 1)
  await touch('touchStart', from.x, from.y)
  for (let i = 1; i <= 10; i++) {
    const x = from.x + ((to.x - from.x) * i) / 10
    const y = from.y + ((to.y - from.y) * i) / 10
    await pen('mouseMoved', x, y, 1)
    await touch('touchMove', x, y)
  }
  await pen('mouseReleased', to.x, to.y, 0)
  await touch('touchEnd', to.x, to.y)
  await cdp.detach()
}

const center = async (page: Page, id: string) => {
  const b = (await page.locator(`.react-flow__node[data-id="${id}"]`).boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

/**
 * Simula drivers/Windows Ink que entregam só eventos de ponteiro da caneta, sem os eventos
 * de mouse de compatibilidade (dos quais o React Flow depende para arrastar e conectar).
 */
async function withoutPenMouseCompat(page: Page) {
  await page.addInitScript(() => {
    let penDown = false
    window.addEventListener('pointerdown', (e) => (penDown = e.pointerType === 'pen'), true)
    window.addEventListener('pointerup', () => setTimeout(() => (penDown = false)), true)
    for (const type of ['mousedown', 'mousemove', 'mouseup']) {
      window.addEventListener(
        type,
        (e) => {
          if (penDown && e.isTrusted) e.stopImmediatePropagation()
        },
        true,
      )
    }
  })
}

test('caneta: arrastar move o componente', async ({ page }) => {
  await withoutPenMouseCompat(page)
  await open(page)
  const start = await center(page, 'api')
  await penDrag(page, start, { x: start.x, y: start.y + 150 })
  const after = await center(page, 'api')
  expect(after.y - start.y).toBeGreaterThan(100)
  // Virou um command (entrou no histórico).
  await expect(page.getByRole('button', { name: /Desfazer/ })).toBeEnabled()
})

test('caneta: toque seleciona, duplo toque renomeia, arrastar no fundo move a vista', async ({
  page,
}) => {
  await withoutPenMouseCompat(page)
  await open(page)
  const api = await center(page, 'api')

  await penDrag(page, api, api) // toque
  await expect(page.locator('.react-flow__node[data-id="api"]')).toHaveClass(/selected/)
  await expect(page.getByLabel('Tipo do componente')).toHaveValue('server')

  await penDrag(page, api, api)
  await penDrag(page, api, api)
  await page.locator('.react-flow__node[data-id="api"]').dblclick() // garante o dblclick nativo
  const input = page.locator('.react-flow__node[data-id="api"] input')
  await expect(input).toBeFocused()
  await page.keyboard.press('Escape')

  const pane = (await page.locator('.react-flow__pane').boundingBox())!
  // Centro inferior: longe dos controles de zoom (esquerda) e do minimapa (direita).
  const empty = { x: pane.x + pane.width / 2, y: pane.y + pane.height - 40 }
  const before = await translate(page)
  await penDrag(page, empty, { x: empty.x + 80, y: empty.y - 60 })
  const after = await translate(page)
  expect(after.x - before.x).toBeCloseTo(80, 0)
})

test('caneta: arrastar de uma alça a outra cria conexão', async ({ page }) => {
  await withoutPenMouseCompat(page)
  await open(page)
  const handle = (id: string, side: string) =>
    page.locator(`.react-flow__node[data-id="${id}"] .react-flow__handle[data-handleid="${side}"]`)
  const a = (await handle('web', 'bottom').boundingBox())!
  const b = (await handle('db', 'bottom').boundingBox())!
  await expect(page.locator('.react-flow__edge')).toHaveCount(3)
  await penDrag(
    page,
    { x: a.x + a.width / 2, y: a.y + a.height / 2 },
    { x: b.x + b.width / 2, y: b.y + b.height / 2 },
  )
  await expect(page.locator('.react-flow__edge')).toHaveCount(4)
})

test('caneta com mouse emulado pelo driver: cria UMA conexão e move o nó uma vez', async ({
  page,
}) => {
  await open(page)
  const handle = (id: string, side: string) =>
    page.locator(`.react-flow__node[data-id="${id}"] .react-flow__handle[data-handleid="${side}"]`)
  const a = (await handle('web', 'bottom').boundingBox())!
  const b = (await handle('db', 'bottom').boundingBox())!
  await penDragWithEmulatedMouse(
    page,
    { x: a.x + a.width / 2, y: a.y + a.height / 2 },
    { x: b.x + b.width / 2, y: b.y + b.height / 2 },
  )
  await page.waitForTimeout(300)
  await expect(page.locator('.react-flow__edge')).toHaveCount(4)

  // Arrastar o nó também gera um único passo no histórico.
  const start = await center(page, 'api')
  await penDragWithEmulatedMouse(page, start, { x: start.x, y: start.y + 150 })
  await expect.poll(async () => (await center(page, 'api')).y - start.y).toBeGreaterThan(100)
  await page.getByRole('button', { name: /Desfazer/ }).click()
  await expect.poll(async () => (await center(page, 'api')).y).toBeCloseTo(start.y, -1)
})

test('caneta que também gera toque (mesa do usuário): cria UMA conexão e move o nó', async ({
  page,
}) => {
  await open(page)
  const handle = (id: string, side: string) =>
    page.locator(`.react-flow__node[data-id="${id}"] .react-flow__handle[data-handleid="${side}"]`)
  const a = (await handle('web', 'bottom').boundingBox())!
  const b = (await handle('db', 'bottom').boundingBox())!
  await penDragWithTouch(
    page,
    { x: a.x + a.width / 2, y: a.y + a.height / 2 },
    { x: b.x + b.width / 2, y: b.y + b.height / 2 },
  )
  await page.waitForTimeout(300)
  await expect(page.locator('.react-flow__edge')).toHaveCount(4)

  const start = await center(page, 'api')
  await penDragWithTouch(page, start, { x: start.x, y: start.y + 150 })
  await expect.poll(async () => (await center(page, 'api')).y - start.y).toBeGreaterThan(100)
  await page.getByRole('button', { name: /Desfazer/ }).click()
  await expect.poll(async () => (await center(page, 'api')).y).toBeCloseTo(start.y, -1)
})

test('caneta: arrastar da paleta solta o componente onde a caneta foi levantada', async ({
  page,
}) => {
  await open(page)
  const nodes = page.locator('.react-flow__node')
  await expect(nodes).toHaveCount(3)
  const button = (await page.getByRole('button', { name: 'Cache' }).boundingBox())!
  const pane = (await page.locator('.react-flow__pane').boundingBox())!
  const drop = { x: pane.x + pane.width / 2, y: pane.y + pane.height - 120 }
  await penDragWithTouch(page, { x: button.x + 20, y: button.y + button.height / 2 }, drop)
  // Exatamente um novo componente (o click que segue o arraste não adiciona outro)...
  await expect(nodes).toHaveCount(4)
  await page.waitForTimeout(300)
  await expect(nodes).toHaveCount(4)
  // ...centrado onde a caneta foi levantada.
  const added = (await nodes.filter({ hasText: 'Cache' }).boundingBox())!
  expect(Math.abs(added.x + added.width / 2 - drop.x)).toBeLessThan(10)
  expect(Math.abs(added.y + added.height / 2 - drop.y)).toBeLessThan(10)
  await expect(page.getByTestId('palette-ghost')).toHaveCount(0)

  // Soltar fora do canvas não cria nada; um toque simples continua adicionando.
  await penDragWithTouch(page, { x: button.x + 20, y: button.y + 4 }, { x: button.x + 40, y: 20 })
  await page.waitForTimeout(300)
  await expect(nodes).toHaveCount(4)
  await penDrag(page, { x: button.x + 20, y: button.y + 4 }, { x: button.x + 20, y: button.y + 4 })
  await expect(nodes).toHaveCount(5)
})

test('caneta: Espaço+arrastar move a vista, mesmo começando sobre um nó', async ({ page }) => {
  await open(page)
  const start = await center(page, 'api')
  const before = await translate(page)
  const nodeBefore = await page.locator('.react-flow__node[data-id="api"]').getAttribute('style')

  await page.keyboard.down('Space')
  await penDrag(page, start, { x: start.x + 100, y: start.y + 50 })
  await page.keyboard.up('Space')

  const after = await translate(page)
  expect(after.x - before.x).toBeCloseTo(100, 0)
  expect(after.y - before.y).toBeCloseTo(50, 0)
  // Moveu a vista, não o nó.
  expect(await page.locator('.react-flow__node[data-id="api"]').getAttribute('style')).toBe(
    nodeBefore,
  )
  await expect(page.getByRole('button', { name: /Desfazer/ })).toBeDisabled()
})

test('caneta: Ctrl+Espaço+arrastar dá zoom mantendo o ponto de origem', async ({ page }) => {
  await open(page)
  const start = await center(page, 'api')
  const before = await zoom(page)

  await page.keyboard.down('Control')
  await page.keyboard.down('Space')
  // direita/cima: aproxima
  await penDrag(page, start, { x: start.x + 120, y: start.y - 60 }, 2)
  const zoomedIn = await zoom(page)
  expect(zoomedIn).toBeGreaterThan(before)
  // O nó sob a caneta continua no mesmo lugar da tela.
  const anchored = await center(page, 'api')
  expect(anchored.x).toBeCloseTo(start.x, -1)
  expect(anchored.y).toBeCloseTo(start.y, -1)

  // esquerda/baixo: afasta
  await penDrag(page, start, { x: start.x - 150, y: start.y + 150 }, 2)
  await page.keyboard.up('Space')
  await page.keyboard.up('Control')
  expect(await zoom(page)).toBeLessThan(zoomedIn)

  // Não selecionou, não arrastou nada nem entrou no histórico.
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Desfazer/ })).toBeDisabled()
})

test('mouse: Ctrl+Espaço+arrastar também dá zoom', async ({ page }) => {
  await open(page)
  const pane = (await page.locator('.react-flow__pane').boundingBox())!
  const start = { x: pane.x + pane.width / 2, y: pane.y + pane.height - 80 }
  const before = await zoom(page)
  await page.keyboard.down('Control')
  await page.keyboard.down('Space')
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 120, start.y - 60, { steps: 10 })
  await page.mouse.up()
  await page.keyboard.up('Space')
  await page.keyboard.up('Control')
  expect(await zoom(page)).toBeGreaterThan(before)
})

test('laser desenha um traço temporário que some sozinho', async ({ page }) => {
  await open(page)
  await page.keyboard.press('l')
  const overlay = page.getByTestId('laser-overlay')
  await expect(overlay).toBeVisible()

  const box = (await overlay.boundingBox())!
  await page.mouse.move(box.x + 200, box.y + 300)
  await page.mouse.down()
  await page.mouse.move(box.x + 500, box.y + 350, { steps: 15 })
  await page.mouse.up()
  await expect(overlay.locator('line').first()).toBeVisible()
  // Some depois de ~1,4 s.
  await expect(overlay.locator('line')).toHaveCount(0, { timeout: 4000 })

  // Não alterou o cenário nem entrou no histórico.
  await expect(page.getByRole('button', { name: /Desfazer/ })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(overlay).toHaveCount(0)
})
