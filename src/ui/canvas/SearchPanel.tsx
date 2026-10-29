import { Panel, useReactFlow } from '@xyflow/react'
import { Search, X } from 'lucide-react'
import { componentKindList, type ComponentKind } from '../../core'
import { useEditor } from '../../store/editor'

const kindOptions = [
  { value: 'all', label: 'Todos os tipos' },
  ...componentKindList.map((d) => ({ value: d.kind, label: d.label })),
]

/** Busca e filtro: destaca os componentes que casam e esmaece o resto. */
export default function SearchPanel({ matches }: { matches: Set<string> | null }) {
  const search = useEditor((s) => s.search)
  const setSearch = useEditor((s) => s.setSearch)
  const total = useEditor((s) => s.scenario.components.length)
  const { fitView } = useReactFlow()

  const focusMatches = () => {
    if (matches && matches.size > 0) {
      void fitView({ nodes: [...matches].map((id) => ({ id })), duration: 300, maxZoom: 1.2 })
    }
  }

  return (
    <Panel position="top-left" className="!m-3 max-md:!w-[calc(100%-1.5rem)]">
      <div className="flex items-center gap-1 max-md:w-full rounded-lg border border-slate-200 bg-surface p-1 shadow-sm">
        <Search size={14} className="ml-1.5 text-slate-400" />
        <input
          aria-label="Buscar componentes"
          placeholder="Buscar componentes, rotas, tags…"
          value={search.text}
          onChange={(e) => setSearch({ text: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') focusMatches()
            if (e.key === 'Escape') setSearch({ text: '' })
          }}
          className="w-56 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-slate-400 max-md:w-0 max-md:min-w-0 max-md:flex-1"
        />
        <select
          aria-label="Filtrar por tipo"
          value={search.kind}
          onChange={(e) => setSearch({ kind: e.target.value as ComponentKind | 'all' })}
          className="rounded bg-slate-50 px-1 py-0.5 text-xs text-slate-600 outline-none max-md:max-w-32"
        >
          {kindOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {matches && (
          <>
            <span className="px-1 text-xs whitespace-nowrap text-slate-500">
              {matches.size} de {total}
            </span>
            <button
              type="button"
              title="Limpar busca"
              aria-label="Limpar busca"
              onClick={() => setSearch({ text: '', kind: 'all' })}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={14} />
            </button>
          </>
        )}
      </div>
    </Panel>
  )
}
