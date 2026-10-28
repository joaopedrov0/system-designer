import { useReactFlow } from '@xyflow/react'
import { useEffect, useState, type RefObject } from 'react'

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 4
/** Quanto o zoom muda por pixel arrastado (exponencial, como no Krita). */
const SENSITIVITY = 0.01
/** Depois de levantar a caneta, por quanto tempo (ms) ainda ignorar o mouse emulado. */
const PEN_SETTLE_MS = 400

export type TabletGesture = 'pan' | 'zoom' | null

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

/**
 * Navegação no estilo do Krita, pensada para mesa digitalizadora (funciona também com
 * mouse), usando eventos de ponteiro — que a caneta sempre gera:
 * - Espaço + arrastar: move a vista (pan).
 * - Ctrl + Espaço + arrastar: zoom; para cima/direita aproxima, para baixo/esquerda afasta,
 *   mantendo fixo o ponto onde o arraste começou.
 * Devolve o gesto armado no momento (para o cursor).
 */
export function useTabletNavigation(ref: RefObject<HTMLElement | null>): TabletGesture {
  const { getViewport, setViewport } = useReactFlow()
  const [armed, setArmed] = useState<TabletGesture>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let space = false
    let ctrl = false
    let drag: {
      gesture: 'pan' | 'zoom'
      pointerId: number
      startX: number
      startY: number
      anchorX: number
      anchorY: number
      vp: { x: number; y: number; zoom: number }
    } | null = null

    const gesture = (withCtrl: boolean): TabletGesture =>
      space ? (withCtrl ? 'zoom' : 'pan') : null
    const sync = () => setArmed(gesture(ctrl))

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      if (e.code === 'Space') {
        space = true
        // Sem isso o Espaço rola a página ou "clica" no botão que estiver focado.
        e.preventDefault()
      }
      if (e.key === 'Control' || e.key === 'Meta') ctrl = true
      sync()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        space = false
        if (!isTyping(e.target)) e.preventDefault()
      }
      if (e.key === 'Control' || e.key === 'Meta') ctrl = false
      sync()
    }
    const reset = () => {
      space = ctrl = false
      drag = null
      sync()
    }

    // --- Ponte da caneta ----------------------------------------------------------
    // O React Flow arrasta nós, cria conexões e faz pan ouvindo mouse (mousedown...) E toque
    // (touchstart...). Como o navegador traduz a caneta varia com o driver:
    // - com algumas mesas (Windows Ink) chegam eventos de TOQUE junto com os de ponteiro e
    //   nenhum de mouse — capturado com ?debug=input na mesa do usuário. O React Flow então
    //   iniciava a mesma conexão duas vezes (pela ponte e pelo toque) e a duplicava;
    // - outros drivers mandam eventos de mouse confiáveis que o preventDefault não suprime.
    // Para ficar igual em qualquer driver, a ponte é a ÚNICA fonte enquanto a caneta está
    // encostada (e um instante depois): geramos mouse a partir dos eventos de ponteiro e
    // descartamos os eventos confiáveis de mouse e toque derivados da caneta.
    let pen: number | null = null
    let penContact = false
    let penSettle: ReturnType<typeof setTimeout> | undefined
    const blockEmulatedMouse = (e: Event) => {
      if (!penContact || !e.isTrusted) return
      // Depois de levantar a caneta, só o eco no canvas é descartado; cliques de mouse
      // na barra ou no painel continuam valendo.
      if (pen === null && !el.contains(e.target as Node)) return
      // O click da própria caneta (PointerEvent com pointerType "pen") passa.
      if (e.type === 'click' && (e as PointerEvent).pointerType === 'pen') return
      e.stopImmediatePropagation()
    }
    const emitMouse = (type: string, e: PointerEvent, target: EventTarget, buttons: number) =>
      target.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window,
          detail: 1,
          clientX: e.clientX,
          clientY: e.clientY,
          screenX: e.screenX,
          screenY: e.screenY,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          metaKey: e.metaKey,
          button: 0,
          buttons,
        }),
      )
    const under = (e: PointerEvent) => document.elementFromPoint(e.clientX, e.clientY) ?? el
    const startPenBridge = (e: PointerEvent) => {
      if (e.pointerType !== 'pen' || e.button !== 0 || isTyping(e.target)) return
      e.preventDefault()
      // Sem o mousedown nativo, o campo focado (ex.: no painel) não perderia o foco.
      const active = document.activeElement as HTMLElement | null
      if (active && active !== document.body && !active.contains(e.target as Node)) active.blur()
      pen = e.pointerId
      penContact = true
      clearTimeout(penSettle)
      emitMouse('mousedown', e, e.target ?? el, 1)
    }
    const onPenMove = (e: PointerEvent) => {
      if (e.pointerId === pen) emitMouse('mousemove', e, under(e), 1)
    }
    const onPenUp = (e: PointerEvent) => {
      if (e.pointerId !== pen) return
      pen = null
      emitMouse('mouseup', e, under(e), 0)
      // O mouse emulado costuma chegar um pouco depois; segue bloqueado por um instante.
      clearTimeout(penSettle)
      penSettle = setTimeout(() => (penContact = false), PEN_SETTLE_MS)
    }

    const onPointerDown = (e: PointerEvent) => {
      const g = gesture(ctrl || e.ctrlKey || e.metaKey)
      if (!g) {
        startPenBridge(e)
        return
      }
      if (e.button !== 0) return
      // preventDefault no pointerdown suprime os eventos de mouse de compatibilidade,
      // então o React Flow não inicia seleção nem arraste de nós.
      e.preventDefault()
      e.stopPropagation()
      const rect = el.getBoundingClientRect()
      drag = {
        gesture: g,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        anchorX: e.clientX - rect.left,
        anchorY: e.clientY - rect.top,
        vp: getViewport(),
      }
      el.setPointerCapture(e.pointerId)
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.pointerId) return
      e.preventDefault()
      e.stopPropagation()
      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      const { vp } = drag
      if (drag.gesture === 'pan') {
        void setViewport({ x: vp.x + dx, y: vp.y + dy, zoom: vp.zoom })
        return
      }
      const zoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, vp.zoom * Math.exp((dx - dy) * SENSITIVITY)),
      )
      // Mantém sob o ponto inicial o mesmo ponto do diagrama.
      const flowX = (drag.anchorX - vp.x) / vp.zoom
      const flowY = (drag.anchorY - vp.y) / vp.zoom
      void setViewport({ x: drag.anchorX - flowX * zoom, y: drag.anchorY - flowY * zoom, zoom })
    }
    const onPointerUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.pointerId) return
      e.stopPropagation()
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      drag = null
    }

    const capture = { capture: true }
    el.addEventListener('pointerdown', onPointerDown, capture)
    el.addEventListener('pointermove', onPointerMove, capture)
    el.addEventListener('pointerup', onPointerUp, capture)
    el.addEventListener('pointercancel', onPointerUp, capture)
    // A caneta pode sair do canvas durante o arraste: a ponte escuta na janela inteira.
    window.addEventListener('pointermove', onPenMove, capture)
    window.addEventListener('pointerup', onPenUp, capture)
    window.addEventListener('pointercancel', onPenUp, capture)
    const emulated = [
      'mousedown',
      'mousemove',
      'mouseup',
      'click',
      'touchstart',
      'touchmove',
      'touchend',
      'touchcancel',
    ] as const
    for (const type of emulated) window.addEventListener(type, blockEmulatedMouse, capture)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('pointermove', onPenMove, capture)
      window.removeEventListener('pointerup', onPenUp, capture)
      window.removeEventListener('pointercancel', onPenUp, capture)
      for (const type of emulated) window.removeEventListener(type, blockEmulatedMouse, capture)
      clearTimeout(penSettle)
      el.removeEventListener('pointerdown', onPointerDown, capture)
      el.removeEventListener('pointermove', onPointerMove, capture)
      el.removeEventListener('pointerup', onPointerUp, capture)
      el.removeEventListener('pointercancel', onPointerUp, capture)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', reset)
    }
  }, [ref, getViewport, setViewport])

  return armed
}
