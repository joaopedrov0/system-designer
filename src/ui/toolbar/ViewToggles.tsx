import { Activity, Pointer } from 'lucide-react'
import type { ReactNode } from 'react'
import { useView } from '../../store/view'

/** Botões dos modos de visualização: fluxo animado e laser. */
export default function ViewToggles() {
  const flow = useView((s) => s.flow)
  const laser = useView((s) => s.laser)
  const { toggleFlow, setLaser } = useView.getState()

  return (
    <>
      <Toggle label="Visualizar fluxo (F)" active={flow} onClick={toggleFlow}>
        <Activity size={16} />
        <span className="text-xs">Fluxo</span>
      </Toggle>
      <Toggle
        label="Modo laser (L) — Esc para sair"
        active={laser}
        onClick={() => setLaser(!laser)}
      >
        <Pointer size={16} />
        <span className="text-xs">Laser</span>
      </Toggle>
    </>
  )
}

function Toggle(props: {
  label: string
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={props.label}
      aria-label={props.label}
      aria-pressed={props.active}
      onClick={props.onClick}
      className={`flex items-center gap-1 rounded px-1.5 py-1 text-sm max-md:min-h-11 max-md:px-3 ${
        props.active ? 'bg-slate-900 text-slate-50' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {props.children}
    </button>
  )
}
