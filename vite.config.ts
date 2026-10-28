/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // No GitHub Pages o app fica num subcaminho (/<repositório>/); o workflow define BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  build: {
    // O maior chunk é o elkjs (~1,4 MB), carregado sob demanda só pelo auto-layout.
    chunkSizeWarningLimit: 1500,
  },
  test: {
    include: ['src/**/*.test.ts', 'mcp/**/*.test.ts'],
  },
})
