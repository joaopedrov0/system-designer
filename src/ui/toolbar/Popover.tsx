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
    // pointerdown (e não mousedown): no toque o navegador só sintetiza o mouse depois.
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
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
        className="flex items-center gap-1 rounded px-1.5 py-1 text-sm text-slate-600 hover:bg-slate-100 max-md:min-h-11 max-md:min-w-11 max-md:justify-center"
      >
        {props.trigger(open)}
      </button>
      {open && (
        <div
          // No celular o painel vira uma folha presa à base da tela (um dropdown preso ao
          // botão sairia da tela); `fixed` também escapa do overflow de uma folha-mãe.
          className={`absolute top-full z-20 mt-1 min-w-56 rounded-lg border border-slate-200 bg-surface py-1 shadow-lg max-md:fixed max-md:inset-x-2 max-md:top-auto max-md:bottom-[calc(0.5rem+env(safe-area-inset-bottom))] max-md:z-[60] max-md:mt-0 max-md:max-h-[70dvh] max-md:overflow-y-auto ${
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
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 max-md:min-h-11"
    >
      <span className="text-slate-500">{props.icon}</span>
      <span className="flex-1">{props.children}</span>
      {props.hint && <span className="text-xs text-slate-400">{props.hint}</span>}
    </button>
  )
}
