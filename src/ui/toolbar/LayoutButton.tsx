import { useReactFlow } from '@xyflow/react'
import { LayoutDashboard, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useEditor } from '../../store/editor'
import { computeLayout } from '../canvas/autoLayout'
import { NODE_WIDTH } from '../canvas/ComponentNode'
import { NODE_HEIGHT } from '../canvas/placement'

/** Auto-layout: um único passo no histórico, então Ctrl+Z desfaz tudo. */
export default function LayoutButton() {
  const { getInternalNode, fitView } = useReactFlow()
  const [busy, setBusy] = useState(false)

  const run = async () => {
    const { scenario, applyLayout, showError } = useEditor.getState()
    if (scenario.components.length === 0) return
    setBusy(true)
    try {
      const { positions, sizes } = await computeLayout(scenario, (id) => {
        const measured = getInternalNode(id)?.measured
        return { width: measured?.width ?? NODE_WIDTH, height: measured?.height ?? NODE_HEIGHT }
      })
      applyLayout(positions, sizes)
      // Espera o React Flow posicionar os nós antes de enquadrar.
      requestAnimationFrame(() => void fitView({ duration: 400, maxZoom: 1, padding: 0.2 }))
    } catch (err) {
      showError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      title="Organizar automaticamente"
      aria-label="Organizar automaticamente"
      disabled={busy}
      onClick={() => void run()}
      className="flex items-center gap-1 rounded px-1.5 py-1 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
    >
      {busy ? <LoaderCircle size={16} className="animate-spin" /> : <LayoutDashboard size={16} />}
      <span className="text-xs">Organizar</span>
    </button>
  )
}
