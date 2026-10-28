import { useReactFlow } from '@xyflow/react'
import { BoxSelect, StickyNote } from 'lucide-react'
import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { componentKindList } from '../../core'
import { useEditor } from '../../store/editor'
import { addAt, PALETTE_DRAG_MIME, type PaletteItem } from '../canvas/placement'
import { CatalogIcon } from '../icons'

export default function Palette() {
  const { screenToFlowPosition } = useReactFlow()

  /** Clique adiciona no centro da área visível, em cascata para não empilhar. */
  const addAtCenter = (item: PaletteItem) => {
    const pane = document.querySelector('.react-flow')?.getBoundingClientRect()
    if (!pane) return
    const center = screenToFlowPosition({ x: pane.x + pane.width / 2, y: pane.y + pane.height / 2 })
    const { components, notes } = useEditor.getState().scenario
    const step = ((components.length + notes.length) % 8) * 40
    addAt(item, { x: center.x + step, y: center.y + step })
  }

  /** Soltura de um arraste feito com a caneta: só vale sobre o canvas. */
  const dropAt = (item: PaletteItem, x: number, y: number) => {
    if (!document.elementFromPoint(x, y)?.closest('.react-flow')) return
    addAt(item, screenToFlowPosition({ x, y }))
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-surface pb-4">
      <Heading>Componentes</Heading>
      <ul className="px-2">
        {componentKindList.map((def) => (
          <PaletteButton key={def.kind} item={def.kind} label={def.label} onAdd={addAtCenter} onDrop={dropAt}>
            <span
              className="flex h-7 w-7 items-center justify-center rounded text-white"
              style={{ backgroundColor: def.color }}
            >
              <CatalogIcon name={def.icon} size={15} />
            </span>
          </PaletteButton>
        ))}
      </ul>

      <Heading>Organização</Heading>
      <ul className="px-2">
        <PaletteButton item="group" label="Grupo / Fronteira" onAdd={addAtCenter} onDrop={dropAt}>
          <span className="flex h-7 w-7 items-center justify-center rounded border-2 border-dashed border-slate-300 text-slate-500">
            <BoxSelect size={14} />
          </span>
        </PaletteButton>
        <PaletteButton item="note" label="Nota" onAdd={addAtCenter} onDrop={dropAt}>
          <span className="flex h-7 w-7 items-center justify-center rounded border border-amber-200 bg-amber-50 text-amber-600">
            <StickyNote size={14} />
          </span>
        </PaletteButton>
      </ul>
    </aside>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-4 pt-4 pb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
      {children}
    </h2>
  )
}

/** Distância (px) que a caneta precisa percorrer para virar arraste em vez de toque. */
const DRAG_THRESHOLD = 6

function PaletteButton(props: {
  item: PaletteItem
  label: string
  onAdd: (item: PaletteItem) => void
  onDrop: (item: PaletteItem, x: number, y: number) => void
  children: ReactNode
}) {
  // O arraste nativo (HTML5) não funciona com caneta: o navegador o cancela
  // (pointercancel). Com caneta, o arraste é feito à mão com eventos de ponteiro.
  const penDrag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null)

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType !== 'pen' || e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    penDrag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = penDrag.current
    if (!drag || drag.id !== e.pointerId) return
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < DRAG_THRESHOLD) return
    drag.moved = true
    setGhost({ x: e.clientX, y: e.clientY })
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = penDrag.current
    if (!drag || drag.id !== e.pointerId) return
    penDrag.current = null
    setGhost(null)
    if (!drag.moved) return // toque: o click adiciona no centro
    // Com a captura do ponteiro, o click que vem a seguir cai neste botão.
    suppressClick.current = true
    setTimeout(() => (suppressClick.current = false), 0)
    if (e.type === 'pointerup') props.onDrop(props.item, e.clientX, e.clientY)
  }

  return (
    <li>
      <button
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(PALETTE_DRAG_MIME, props.item)
          e.dataTransfer.effectAllowed = 'copy'
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => {
          if (!suppressClick.current) props.onAdd(props.item)
        }}
        className="flex w-full cursor-grab items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 active:cursor-grabbing"
        title="Arraste para o canvas ou clique para adicionar"
      >
        {props.children}
        {props.label}
      </button>
      {ghost && (
        <div
          className="pointer-events-none fixed z-50 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-md border border-slate-200 bg-surface px-2 py-1.5 text-sm text-slate-700 opacity-90 shadow-lg"
          style={{ left: ghost.x, top: ghost.y }}
          data-testid="palette-ghost"
        >
          {props.children}
          {props.label}
        </div>
      )}
    </li>
  )
}
