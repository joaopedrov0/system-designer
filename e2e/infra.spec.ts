import { expect, test, type Page } from '@playwright/test'

const scenario = {
  id: 'infra',
  name: 'Infra',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  components: [
    { id: 'cam', kind: 'sensor', name: 'Câmera', layout: { x: 0, y: 0 } },
    { id: 'nvr', kind: 'edge-device', name: 'NVR', layout: { x: 300, y: 0 } },
    { id: 'api', kind: 'server', name: 'API', layout: { x: 300, y: 200 } },
  ],
  connections: [{ id: 'cam-nvr', source: 'cam', target: 'nvr', protocol: 'rtsp' }],
}

const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`)

async function open(page: Page) {
  await page.goto('/')
  await page.getByTestId('import-input').setInputFiles({
    name: 'infra.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(scenario)),
  })
  await expect(node(page, 'api')).toBeVisible()
}

test('servidor roda num host e tem réplicas: aparece no nó', async ({ page }) => {
  await open(page)
  await node(page, 'api').click()
  await page.getByLabel('Roda em').selectOption({ label: 'NVR' })
  await expect(node(page, 'api')).toContainText('em NVR')

  await page.getByRole('button', { name: /Réplicas \(opcional\)/ }).click()
  await expect(page.getByTestId('replicas-badge')).toHaveText('×2')
  await page.getByLabel('Máximo').fill('10')
  await page.getByLabel('Máximo').blur()
  await expect(page.getByTestId('replicas-badge')).toHaveText('×2–10')
  await page.getByLabel(/Efêmero/).check()
  await expect(node(page, 'api').locator('> div').first()).toHaveClass(/border-dashed/)

  await page.getByRole('button', { name: 'Remover réplicas' }).click()
  await expect(page.getByTestId('replicas-badge')).toHaveCount(0)
})

test('câmera: banda e armazenamento estimados no painel', async ({ page }) => {
  await open(page)
  await node(page, 'cam').click()
  await expect(page.getByTestId('sensor-load')).toContainText('Informe os dados')
  await page.getByLabel('Tipo de sensor').selectOption('camera')
  await page.getByLabel('Bitrate (Mbps)').fill('4')
  await page.getByLabel('Bitrate (Mbps)').blur()
  await expect(page.getByTestId('sensor-load')).toContainText('4 Mbps · 43.2 GB por dia')
})

test('host: campos de hardware e o host aparece na lista "Roda em"', async ({ page }) => {
  await open(page)
  await node(page, 'nvr').click()
  await page.getByLabel('Núcleos de CPU').fill('4')
  await page.getByLabel('Núcleos de CPU').blur()
  await page.getByLabel('Local').fill('rack 2')
  await page.getByLabel('Local').blur()
  await node(page, 'api').click()
  await expect(page.getByLabel('Roda em').locator('option')).toHaveText(['(não informado)', 'NVR'])
  // O hardware ficou guardado: reabrir o NVR mostra os valores.
  await node(page, 'nvr').click()
  await expect(page.getByLabel('Núcleos de CPU')).toHaveValue('4')
  await expect(page.getByLabel('Local')).toHaveValue('rack 2')
})
