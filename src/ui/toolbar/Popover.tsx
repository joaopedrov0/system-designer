import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Botão que abre um painel flutuante; fecha ao clicar fora ou apertar Esc. */
export default function Popover(props: {
  trigger: (open: boolean) => ReactNode
  label: string
  align?: 'left' | 'right'
  onOpen?: () => void
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={props.label}
        title={props.label}
        aria-expanded={open}
        onClick={() => {
          if (!open) props.onOpen?.()
          setOpen(!open)
        }}
        className="flex items-center gap-1 rounded px-1.5 py-1 text-sm text-slate-600 hover:bg-slate-100"
      >
        {props.trigger(open)}
      </button>
      {open && (
        <div
          className={`absolute top-full z-20 mt-1 min-w-56 rounded-lg border border-slate-200 bg-surface py-1 shadow-lg ${
            props.align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {props.children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function MenuItem(props: {
  icon?: ReactNode
  onClick: () => void
  children: ReactNode
  hint?: string
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
    >
      <span className="text-slate-500">{props.icon}</span>
      <span className="flex-1">{props.children}</span>
      {props.hint && <span className="text-xs text-slate-400">{props.hint}</span>}
    </button>
  )
}
