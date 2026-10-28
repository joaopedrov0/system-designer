import type { Rect } from '@xyflow/react'
import { toPng, toSvg } from 'html-to-image'

export function downloadUrl(filename: string, href: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
}

export function downloadText(filename: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  downloadUrl(filename, url)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const IMAGE_PADDING = 40

/** Renderiza o diagrama inteiro (não só a área visível) em escala 1:1. */
export async function exportImage(bounds: Rect, format: 'png' | 'svg', filename: string) {
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport')
  if (!viewport) throw new Error('Canvas não encontrado.')
  const width = Math.ceil(bounds.width + IMAGE_PADDING * 2)
  const height = Math.ceil(bounds.height + IMAGE_PADDING * 2)
  const options = {
    // Mesmo fundo do canvas, para a imagem acompanhar o tema claro/escuro.
    backgroundColor: getComputedStyle(document.documentElement)
      .getPropertyValue('--color-slate-50')
      .trim(),
    width,
    height,
    pixelRatio: 2,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${IMAGE_PADDING - bounds.x}px, ${IMAGE_PADDING - bounds.y}px) scale(1)`,
    },
    // Alças de conexão e o redimensionador não fazem parte do desenho.
    filter: (node: HTMLElement) =>
      !node.classList?.contains('react-flow__handle') &&
      !node.classList?.contains('react-flow__resize-control'),
  }
  const dataUrl = format === 'png' ? await toPng(viewport, options) : await toSvg(viewport, options)
  downloadUrl(filename, dataUrl)
}
