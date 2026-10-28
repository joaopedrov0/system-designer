import { useRef, useState, type ReactNode } from 'react'

type CommitProps = {
  value: string
  onCommit: (value: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  'aria-label'?: string
}

/**
 * Mantém um rascunho local enquanto o usuário digita e só confirma (vira command e
 * entrada no histórico) ao sair do campo ou apertar Enter. Esc descarta o rascunho.
 */
function useCommit(value: string, onCommit: (value: string) => void, multiline: boolean) {
  const [draft, setDraft] = useState<string | null>(null)
  const cancelled = useRef(false)
  return {
    value: draft ?? value,
    onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
    onBlur: () => {
      if (!cancelled.current && draft !== null && draft !== value) onCommit(draft)
      cancelled.current = false
      setDraft(null)
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (!multiline || e.ctrlKey || e.metaKey)) e.currentTarget.blur()
      if (e.key === 'Escape') {
        cancelled.current = true
        e.currentTarget.blur()
      }
    },
  }
}

const inputClass =
  'w-full rounded-md border border-slate-200 bg-surface px-2 py-1 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400'

export function CommitInput({ value, onCommit, className, ...rest }: CommitProps) {
  const handlers = useCommit(value, onCommit, false)
  return <input {...rest} {...handlers} className={className ?? inputClass} />
}

export function CommitTextarea({ value, onCommit, className, ...rest }: CommitProps) {
  const handlers = useCommit(value, onCommit, true)
  return (
    <textarea {...rest} {...handlers} rows={3} className={className ?? `${inputClass} resize-y`} />
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  )
}

export function Select<T extends string>(props: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  className?: string
  'aria-label'?: string
}) {
  return (
    <select
      aria-label={props['aria-label']}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value as T)}
      className={props.className ?? `${inputClass} py-1`}
    >
      {props.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
