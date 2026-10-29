import { Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useInspectorContent } from './useInspectorContent'

export default function Inspector() {
  const { content } = useInspectorContent()
  return (
    <aside className="w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-surface">
      {content}
    </aside>
  )
}

export function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50 max-md:min-h-11"
    >
      <Trash2 size={14} />
      {label}
    </button>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{children}</h3>
  )
}
