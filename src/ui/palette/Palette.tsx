import { useReactFlow } from '@xyflow/react'
import { BoxSelect, StickyNote } from 'lucide-react'
import type { ReactNode } from 'react'
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

  return (
    <aside className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-surface pb-4">
      <Heading>Componentes</Heading>
      <ul className="px-2">
        {componentKindList.map((def) => (
          <PaletteButton key={def.kind} item={def.kind} label={def.label} onAdd={addAtCenter}>
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
        <PaletteButton item="group" label="Grupo / Fronteira" onAdd={addAtCenter}>
          <span className="flex h-7 w-7 items-center justify-center rounded border-2 border-dashed border-slate-300 text-slate-500">
            <BoxSelect size={14} />
          </span>
        </PaletteButton>
        <PaletteButton item="note" label="Nota" onAdd={addAtCenter}>
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

function PaletteButton(props: {
  item: PaletteItem
  label: string
  onAdd: (item: PaletteItem) => void
  children: ReactNode
}) {
  return (
    <li>
      <button
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(PALETTE_DRAG_MIME, props.item)
          e.dataTransfer.effectAllowed = 'copy'
        }}
        onClick={() => props.onAdd(props.item)}
        className="flex w-full cursor-grab items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 active:cursor-grabbing"
        title="Arraste para o canvas ou clique para adicionar"
      >
        {props.children}
        {props.label}
      </button>
    </li>
  )
}
