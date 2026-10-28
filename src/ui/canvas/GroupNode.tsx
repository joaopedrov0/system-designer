import { NodeResizer, type Node, type NodeProps } from '@xyflow/react'
import { memo, useState } from 'react'
import type { Group } from '../../core'
import { useEditor } from '../../store/editor'

export type GroupFlowNode = Node<{ group: Group }, 'boundary'>

/** Fronteira lógica ("Backend", "VPC", "Serviços externos") que agrupa componentes. */
function GroupNode({ data, selected }: NodeProps<GroupFlowNode>) {
  const g = data.group
  const [editing, setEditing] = useState(false)
  const updateGroup = useEditor((s) => s.updateGroup)
  const resizeElement = useEditor((s) => s.resizeElement)

  const commit = (value: string) => {
    setEditing(false)
    if (value.trim() && value.trim() !== g.name) updateGroup(g.id, { name: value })
  }

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={80}
        lineClassName="!border-slate-400"
        handleClassName="!h-2 !w-2 !rounded-sm !border-slate-400 !bg-surface"
        onResizeEnd={(_, p) => resizeElement(g.id, { x: p.x, y: p.y, w: p.width, h: p.height })}
      />
      <div
        className={`h-full w-full rounded-xl border-2 border-dashed ${
          selected ? 'border-slate-500 bg-slate-200/40' : 'border-slate-300 bg-slate-100/40'
        }`}
      >
        <div className="px-3 pt-2" onDoubleClick={() => setEditing(true)}>
          {editing ? (
            <input
              className="nodrag rounded border border-slate-300 bg-surface px-1 text-sm font-semibold outline-none"
              defaultValue={g.name}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              onBlur={(e) => commit(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') setEditing(false)
              }}
            />
          ) : (
            <span className="text-sm font-semibold text-slate-600">{g.name}</span>
          )}
          {g.description && !editing && (
            <span className="ml-2 text-xs text-slate-400">{g.description}</span>
          )}
        </div>
      </div>
    </>
  )
}

export default memo(GroupNode)
