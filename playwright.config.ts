import { defineConfig, devices } from '@playwright/test'

const PORT = 5198

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Usa o Chrome instalado na máquina, sem baixar navegadores do Playwright.
    channel: 'chrome',
    viewport: { width: 1400, height: 850 },
  },
  projects: [
    { name: 'desktop', testIgnore: /mobile\.spec\.ts/ },
    {
      // Celular com toque; cada teste escolhe o tamanho da tela (ver e2e/mobile.spec.ts).
      name: 'mobile',
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices['Pixel 7'], channel: 'chrome' },
    },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
  },
})
