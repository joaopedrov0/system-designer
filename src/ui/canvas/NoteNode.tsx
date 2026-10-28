import { NodeResizer, type Node, type NodeProps } from '@xyflow/react'
import { memo, useState } from 'react'
import type { Note } from '../../core'
import { useEditor } from '../../store/editor'

export type NoteFlowNode = Node<{ note: Note }, 'note'>

/** Anotação livre no canvas, sem significado no modelo além do texto. */
function NoteNode({ data, selected }: NodeProps<NoteFlowNode>) {
  const n = data.note
  const [editing, setEditing] = useState(!n.text)
  const updateNote = useEditor((s) => s.updateNote)
  const resizeElement = useEditor((s) => s.resizeElement)

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={100}
        minHeight={50}
        lineClassName="!border-amber-400"
        handleClassName="!h-2 !w-2 !rounded-sm !border-amber-400 !bg-surface"
        onResizeEnd={(_, p) => resizeElement(n.id, { x: p.x, y: p.y, w: p.width, h: p.height })}
      />
      <div
        className={`h-full w-full overflow-hidden rounded-md border bg-amber-50 p-2 shadow-sm ${
          selected ? 'border-amber-400' : 'border-amber-200'
        }`}
        onDoubleClick={() => setEditing(true)}
      >
        {editing ? (
          <textarea
            className="nodrag nowheel h-full w-full resize-none bg-transparent text-sm text-amber-950 outline-none placeholder:text-amber-700/50"
            defaultValue={n.text}
            placeholder="Escreva uma anotação…"
            autoFocus
            onBlur={(e) => {
              setEditing(false)
              if (e.currentTarget.value !== n.text) updateNote(n.id, e.currentTarget.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(false)
            }}
          />
        ) : (
          <p className="text-sm whitespace-pre-wrap text-amber-950">
            {n.text || <span className="text-amber-700/50">Nota vazia</span>}
          </p>
        )}
      </div>
    </>
  )
}

export default memo(NoteNode)
