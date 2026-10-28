/**
 * Diagnóstico de entrada (caneta, mouse, toque). Ligado só com `?debug=input` na URL:
 * registra no console a sequência de eventos como o navegador os entrega, antes de qualquer
 * tratamento da aplicação — útil para entender drivers de mesa digitalizadora.
 */
export const inputDebugEnabled =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('debug') === 'input'

export function debugInput(message: string) {
  if (inputDebugEnabled) console.log(`[input] ${message}`)
}

function describe(target: EventTarget | null): string {
  const el = target as HTMLElement | null
  if (!el?.tagName) return String(target)
  const cls =
    typeof el.className === 'string'
      ? el.className
          .split(' ')
          .filter((c) => c.startsWith('react-flow__'))
          .join('.')
      : ''
  const id = el.closest<HTMLElement>('[data-id]')?.dataset.id
  const handle = el.dataset?.handleid
  return [el.tagName.toLowerCase(), cls && `.${cls}`, id && `#${id}`, handle && `[${handle}]`]
    .filter(Boolean)
    .join('')
}

export function installInputDebug() {
  if (!inputDebugEnabled) return
  const t0 = performance.now()
  const moves = new Map<string, number>()
  const flushMoves = () => {
    for (const [key, n] of moves) debugInput(`  (${n}x ${key})`)
    moves.clear()
  }
  const log = (e: Event) => {
    const p = e as PointerEvent
    const key = `${e.type}${p.pointerType ? `/${p.pointerType}` : ''}${e.isTrusted ? '' : ' sintético'}`
    if (e.type.endsWith('move')) {
      moves.set(key, (moves.get(key) ?? 0) + 1)
      return
    }
    flushMoves()
    const time = (e.timeStamp - t0).toFixed(0).padStart(6)
    const extra =
      e instanceof MouseEvent
        ? ` btn=${p.button}/${p.buttons} id=${p.pointerId ?? '-'} @${Math.round(p.clientX)},${Math.round(p.clientY)}`
        : ''
    debugInput(`${time}ms ${key}${extra} -> ${describe(e.target)}`)
  }
  const types = [
    'pointerdown',
    'pointermove',
    'pointerup',
    'pointercancel',
    'mousedown',
    'mousemove',
    'mouseup',
    'click',
    'dblclick',
    'touchstart',
    'touchmove',
    'touchend',
    'touchcancel',
  ]
  for (const type of types) window.addEventListener(type, log, { capture: true, passive: true })
  debugInput('diagnóstico de entrada ligado')
}
