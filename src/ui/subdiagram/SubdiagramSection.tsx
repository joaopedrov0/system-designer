import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { ArrowLeftRight, LayoutGrid, Maximize2, Plus, Trash2, Workflow, X } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  CARDINALITIES,
  subdiagramOf,
  type Cardinality,
  type Component,
  type Entity,
  type Screen,
} from '../../core'
import { useEditor } from '../../store/editor'
import { useView } from '../../store/view'
import { CommitInput, Field, Select } from '../fields'
import { formatFields, parseFields, withFields } from '../inspector/entityFields'
import { SectionTitle } from '../inspector/Inspector'
import SubdiagramCanvas, { type SubSelection } from './SubdiagramCanvas'
import { SUB_NODE_WIDTH } from './sizes'

const cardinalityOptions = CARDINALITIES.map((c) => ({ value: c, label: c }))
const isTyping = (t: EventTarget) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

/**
 * Diagrama interno (complexidade progressiva): fechado, é só um botão; aberto, um mini
 * canvas no inspector que pode ser expandido para a tela toda.
 */
export default function SubdiagramSection({ component }: { component: Component }) {
  const sub = subdiagramOf(component)
  const [open, setOpen] = useState(() => (sub?.links.length ?? 0) > 0)
  const [expanded, setExpanded] = useState(false)
  const [rawSelection, setSelection] = useState<SubSelection>(null)
  if (!sub) return null
  const { def } = sub

  // A seleção pode apontar para algo que um undo removeu.
  const selection =
    rawSelection &&
    (rawSelection.type === 'node' ? sub.nodes : sub.links).some((x) => x.id === rawSelection.id)
      ? rawSelection
      : null

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md border border-dashed border-slate-300 px-3 py-2 text-left text-xs text-slate-600 hover:border-slate-400 hover:bg-slate-50"
      >
        <Workflow size={14} className="shrink-0 text-slate-400" />
        <span>
          <span className="font-medium">{def.title}</span>
          <span className="block text-slate-400">
            {def.directed
              ? 'Telas e como se navega entre elas (opcional)'
              : 'Tabelas e seus relacionamentos (opcional)'}
          </span>
        </span>
      </button>
    )
  }

  const body = (roomy: boolean) => (
    <ReactFlowProvider>
      <Workspace
        component={component}
        selection={selection}
        onSelect={setSelection}
        roomy={roomy}
        onExpand={roomy ? undefined : () => setExpanded(true)}
      />
    </ReactFlowProvider>
  )

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <SectionTitle>{def.title}</SectionTitle>
        {!expanded && sub.nodes.length === 0 && sub.links.length === 0 && (
          <button
            type="button"
            title="Fechar"
            aria-label="Fechar diagrama"
            onClick={() => setOpen(false)}
            className="rounded p-1 text-slate-400 hover:bg-slate-100"
          >
            <X size={13} />
          </button>
        )}
      </div>
      {expanded ? (
        <p className="rounded-md bg-slate-50 px-2 py-3 text-center text-xs text-slate-500">
          Aberto em tela cheia.
        </p>
      ) : (
        body(false)
      )}
      {expanded &&
        createPortal(
          <Overlay title={`${def.title} — ${component.name}`} onClose={() => setExpanded(false)}>
            {body(true)}
          </Overlay>,
          document.body,
        )}
    </section>
  )
}

function Overlay(props: { title: string; onClose: () => void; children: ReactNode }) {
  const { onClose } = props
  useEffect(() => {
    // Esc fecha mesmo com o foco fora do canvas (ex.: num campo do editor).
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      className="fixed inset-0 z-50 flex bg-slate-900/40 p-4 sm:p-8"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-label={props.title}
        className="flex min-h-0 w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
          <h2 className="text-sm font-semibold text-slate-800">{props.title}</h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1">{props.children}</div>
      </div>
    </div>
  )
}

/** Barra de ações + canvas + editor do item selecionado. */
function Workspace(props: {
  component: Component
  selection: SubSelection
  onSelect: (s: SubSelection) => void
  roomy: boolean
  onExpand?: () => void
}) {
  const { component, selection, onSelect, roomy } = props
  const sub = subdiagramOf(component)!
  const { def } = sub
  const { addDetailItem, moveSubdiagramNodes, removeSubdiagramLinks, removeSubdiagramNodes } =
    useEditor.getState()
  const { getNodes } = useReactFlow()
  const [fitKey, setFitKey] = useState(0)

  const addNode = () => {
    // Abaixo do que já existe, para não cair em cima de outro nó.
    const laid = getNodes()
    const y = laid.length
      ? Math.max(...laid.map((n) => n.position.y + (n.measured?.height ?? 60))) + 50
      : 0
    const x = laid.length ? Math.min(...laid.map((n) => n.position.x)) : 0
    const layout = { x: Math.round(x), y: Math.round(y) }
    const id =
      def.nodes === 'screens'
        ? addDetailItem(component.id, 'screens', { name: 'Nova tela', layout })
        : addDetailItem(component.id, 'entities', { name: 'nova_tabela', layout })
    if (id) onSelect({ type: 'node', id })
  }

  const organize = async () => {
    const { layoutGraph } = await import('../../core/layout')
    const sizes = getNodes().map((n) => ({
      id: n.id,
      width: n.measured?.width ?? SUB_NODE_WIDTH[n.type as 'screen' | 'entity'],
      height: n.measured?.height ?? 60,
    }))
    const positions = await layoutGraph(sizes, sub.links)
    moveSubdiagramNodes(
      component.id,
      Object.entries(positions).map(([id, p]) => ({ id, ...p })),
    )
    setFitKey((k) => k + 1)
  }

  const removeSelected = () => {
    if (!selection) return
    if (selection.type === 'link') removeSubdiagramLinks(component.id, [selection.id])
    else removeSubdiagramNodes(component.id, [selection.id])
    onSelect(null)
  }

  // Teclado: depois de um clique aqui, o diagrama interno é o dono do teclado até um
  // clique fora. Não dá para depender do foco: clicar numa aresta deixa o foco no body,
  // e o Delete iria para o canvas principal, apagando o componente selecionado lá.
  const root = useRef<HTMLDivElement>(null)
  // Sempre a versão atual (seleção do momento), sem reinstalar os listeners.
  const removeCurrent = useEffectEvent(removeSelected)
  useEffect(() => {
    const { setSubdiagramActive } = useView.getState()
    const onPointerDown = (e: PointerEvent) =>
      setSubdiagramActive(!!root.current?.contains(e.target as Node))
    // Captura na janela: roda antes do React Flow (document) e dos atalhos globais.
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!useView.getState().subdiagramActive || isTyping(e.target!)) return
      // Desfazer/refazer (Ctrl) e Esc (fecha a tela cheia) seguem o caminho normal.
      if (e.ctrlKey || e.metaKey || e.key === 'Escape') return
      e.stopPropagation()
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        removeCurrent()
      }
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKey, true)
      setSubdiagramActive(false)
    }
  }, [])

  const button =
    'flex items-center gap-1 rounded px-1.5 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-40'
  return (
    <div ref={root} className={roomy ? 'flex h-full' : 'space-y-2'} data-testid="subdiagram">
      <div className={roomy ? 'flex min-w-0 flex-1 flex-col' : 'space-y-1'}>
        <div
          className={`flex items-center gap-1 ${roomy ? 'border-b border-slate-200 px-2 py-1' : ''}`}
        >
          <button type="button" className={button} onClick={addNode}>
            <Plus size={13} /> {def.node[0].toUpperCase() + def.node.slice(1)}
          </button>
          <button
            type="button"
            className={button}
            onClick={() => void organize()}
            disabled={sub.nodes.length < 2}
            title="Organizar automaticamente"
          >
            <LayoutGrid size={13} /> Organizar
          </button>
          {props.onExpand && (
            <button
              type="button"
              className={`${button} ml-auto`}
              onClick={props.onExpand}
              title="Abrir em tela cheia"
              aria-label="Expandir diagrama"
            >
              <Maximize2 size={13} />
            </button>
          )}
        </div>
        <div
          className={
            roomy
              ? 'min-h-0 flex-1'
              : 'h-64 overflow-hidden rounded-md border border-slate-200 bg-slate-50'
          }
        >
          <SubdiagramCanvas
            component={component}
            selection={selection}
            onSelect={onSelect}
            roomy={roomy}
            fitKey={fitKey}
          />
        </div>
        {!roomy && (
          <p className="text-[11px] text-slate-400">
            Arraste de uma borda de {def.node} a outra para ligar. Delete remove o selecionado.
          </p>
        )}
      </div>
      {(selection || roomy) && (
        <div className={roomy ? 'w-72 shrink-0 overflow-y-auto border-l border-slate-200 p-3' : ''}>
          {selection ? (
            <ItemEditor component={component} selection={selection} onRemove={removeSelected} />
          ) : (
            <p className="text-xs text-slate-500">
              Selecione uma {def.node} ou ligação para editar. Arraste de uma borda de {def.node} a
              outra para ligar; Delete remove o selecionado; Esc fecha.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function ItemEditor(props: {
  component: Component
  selection: NonNullable<SubSelection>
  onRemove: () => void
}) {
  const { component, selection } = props
  const sub = subdiagramOf(component)!
  const { def } = sub
  const { updateComponentDetails, updateSubdiagramLink } = useEditor.getState()
  const nameOf = (id: string) => sub.nodes.find((n) => n.id === id)?.name ?? id

  const remove = (
    <button
      type="button"
      onClick={props.onRemove}
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
    >
      <Trash2 size={13} /> Remover {selection.type === 'link' ? 'ligação' : def.node}
    </button>
  )

  if (selection.type === 'link') {
    const link = sub.links.find((l) => l.id === selection.id)!
    const patch = (p: Parameters<typeof updateSubdiagramLink>[2]) =>
      updateSubdiagramLink(component.id, link.id, p)
    return (
      <div className="space-y-2 rounded-md bg-slate-50 p-2" key={link.id}>
        <p className="text-xs text-slate-600">
          <span className="font-medium">{nameOf(link.from)}</span> {def.directed ? '→' : '—'}{' '}
          <span className="font-medium">{nameOf(link.to)}</span>
        </p>
        {!def.directed && (
          <Field label="Cardinalidade">
            <Select<Cardinality>
              aria-label="Cardinalidade"
              value={link.cardinality ?? '1:N'}
              options={cardinalityOptions}
              onChange={(cardinality) => patch({ cardinality })}
            />
          </Field>
        )}
        <Field label={def.directed ? 'Ação' : 'Descrição'}>
          <CommitInput
            value={link.label ?? ''}
            placeholder={def.directed ? 'ex.: entrar, ver detalhes' : 'ex.: possui, pertence a'}
            onCommit={(label) => patch({ label })}
          />
        </Field>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => patch({ reverse: true })}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeftRight size={13} /> Inverter
          </button>
          {remove}
        </div>
      </div>
    )
  }

  const save = <T extends Screen | Entity>(next: T) => {
    const list = (sub.nodes as T[]).map((n) => (n.id === next.id ? next : n))
    updateComponentDetails(component.id, { [def.nodes]: list })
  }
  const node = sub.nodes.find((n) => n.id === selection.id)!
  return (
    <div className="space-y-2 rounded-md bg-slate-50 p-2" key={node.id}>
      <Field label="Nome">
        <CommitInput
          value={node.name}
          onCommit={(name) => name.trim() && save({ ...node, name })}
        />
      </Field>
      {def.nodes === 'screens' ? (
        <Field label="Caminho">
          <CommitInput
            value={(node as Screen).path ?? ''}
            placeholder="ex.: /login (opcional)"
            onCommit={(path) => {
              const next = { ...(node as Screen) }
              if (path.trim()) next.path = path.trim()
              else delete next.path
              save(next)
            }}
          />
        </Field>
      ) : (
        <Field label="Campos">
          <CommitInput
            value={formatFields(node as Entity)}
            placeholder="id: uuid pk, user_id: uuid fk users.id"
            onCommit={(text) =>
              save(withFields(node as Entity, parseFields(text, sub.nodes as Entity[])))
            }
          />
        </Field>
      )}
      <div className="flex justify-end">{remove}</div>
    </div>
  )
}
