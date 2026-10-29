import { useReactFlow } from '@xyflow/react'
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { useInspectorContent } from '../inspector/useInspectorContent'
import Palette from '../palette/Palette'

/**
 * Interface de celular sobre o canvas: botão "+" que abre a paleta numa folha inferior e,
 * ao selecionar algo, o painel de detalhes numa folha com altura parcial ou expandida.
 */
export default function MobileChrome() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  // Ao selecionar, o painel abre só como barra ("peek"): uma folha grande cobriria os outros
  // componentes e não dá para tocar no destino de uma ligação. Expande em duas etapas.
  const [size, setSize] = useState<'peek' | 'half' | 'full'>('peek')
  const { content, total } = useInspectorContent()
  const { setNodes, setEdges } = useReactFlow()

  const inspectorOpen = total > 0
  if (!inspectorOpen && size !== 'peek') setSize('peek')
  // Desmarca no React Flow: ele é quem avisa a store, e um nó que continuasse marcado lá
  // não reabriria a folha ao ser tocado de novo.
  const closeInspector = () => {
    setNodes((ns) => ns.map((n) => (n.selected ? { ...n, selected: false } : n)))
    setEdges((es) => es.map((e) => (e.selected ? { ...e, selected: false } : e)))
    setSize('peek')
  }

  return (
    <>
      {!inspectorOpen && !paletteOpen && (
        <button
          type="button"
          aria-label="Adicionar componente"
          onClick={() => setPaletteOpen(true)}
          className="absolute right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-slate-50 shadow-lg active:scale-95"
        >
          <Plus size={26} />
        </button>
      )}

      {paletteOpen && (
        <div className="absolute inset-0 z-30 flex flex-col justify-end bg-slate-900/30">
          <button
            type="button"
            aria-label="Fechar paleta"
            className="min-h-0 flex-1 cursor-default"
            onClick={() => setPaletteOpen(false)}
          />
          <section
            aria-label="Paleta de componentes"
            className="max-h-[70dvh] overflow-y-auto rounded-t-xl border-t border-slate-200 bg-surface px-2 pb-[env(safe-area-inset-bottom)] shadow-xl"
          >
            <div className="sticky top-0 flex justify-end bg-surface pt-1">
              <button
                type="button"
                aria-label="Fechar paleta"
                onClick={() => setPaletteOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded text-slate-500"
              >
                <X size={18} />
              </button>
            </div>
            <Palette variant="sheet" onAdded={() => setPaletteOpen(false)} />
          </section>
        </div>
      )}

      {inspectorOpen && (
        <section
          aria-label="Detalhes"
          className={`absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-xl border-t border-slate-200 bg-surface shadow-[0_-4px_16px_rgb(0_0_0/0.15)] ${
            size === 'full' ? 'h-[88dvh]' : size === 'half' ? 'h-[45dvh]' : ''
          }`}
        >
          <header className="flex shrink-0 items-center justify-between px-2 pb-[env(safe-area-inset-bottom)]">
            <div className="flex">
              <button
                type="button"
                aria-label="Expandir painel"
                disabled={size === 'full'}
                onClick={() => setSize(size === 'peek' ? 'half' : 'full')}
                className="flex h-11 items-center gap-1 rounded px-2 text-sm text-slate-600 disabled:opacity-30"
              >
                <ChevronUp size={18} />
                {size === 'peek' ? 'Detalhes' : 'Expandir'}
              </button>
              {size !== 'peek' && (
                <button
                  type="button"
                  aria-label="Reduzir painel"
                  onClick={() => setSize(size === 'full' ? 'half' : 'peek')}
                  className="flex h-11 items-center gap-1 rounded px-2 text-sm text-slate-600"
                >
                  <ChevronDown size={18} />
                  Reduzir
                </button>
              )}
            </div>
            <button
              type="button"
              aria-label="Fechar painel"
              onClick={closeInspector}
              className="flex h-11 w-11 items-center justify-center rounded text-slate-500"
            >
              <X size={18} />
            </button>
          </header>
          {size !== 'peek' && (
            <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-100 pb-[env(safe-area-inset-bottom)]">
              {content}
            </div>
          )}
        </section>
      )}
    </>
  )
}
