import {
  applyNodeChanges,
  Background,
  ConnectionMode,
  Controls,
  MarkerType,
  ReactFlow,
  useReactFlow,
  type OnNodesChange,
} from '@xyflow/react'
import { useEffect, useState } from 'react'
import {
  defaultNodePosition,
  derivedRelations,
  subdiagramOf,
  type Component,
  type Point,
  type SubdiagramLink,
} from '../../core'
import { useEditor } from '../../store/editor'
import LaneEdge, { type LaneFlowEdge } from './LaneEdge'
import { EntityNode, ScreenNode, type SubFlowNode } from './nodes'
import { subdiagramPorts } from './ports'

const subNodeTypes = { screen: ScreenNode, entity: EntityNode }
const subEdgeTypes = { lane: LaneEdge }

export type SubSelection = { type: 'node' | 'link'; id: string } | null

/** Alças pelo lado voltado para o outro nó (as ligações não guardam alça). */
function sidesFor(a: Point, b: Point) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { source: 'right', target: 'left' } : { source: 'left', target: 'right' }
  }
  return dy >= 0 ? { source: 'bottom', target: 'top' } : { source: 'top', target: 'bottom' }
}

// A cardinalidade aparece nas pontas (pé de galinha); no texto da linha fica só o rótulo.
function linkText(l: SubdiagramLink): string | undefined {
  return l.label || undefined
}

function toNodes(c: Component, selection: SubSelection): SubFlowNode[] {
  const sub = subdiagramOf(c)!
  return sub.nodes.map((item, i) => ({
    id: item.id,
    type: sub.def.nodes === 'screens' ? 'screen' : 'entity',
    position: item.layout ?? defaultNodePosition(i),
    data: { item },
    selected: selection?.type === 'node' && selection.id === item.id,
  })) as SubFlowNode[]
}

/**
 * Mini canvas do diagrama interno de um componente. Os nós vêm de uma seção dos detalhes
 * (telas ou tabelas) e as arestas da lista de ligações; toda mudança passa pela store,
 * então entra no desfazer como qualquer outra edição.
 */
export default function SubdiagramCanvas(props: {
  component: Component
  selection: SubSelection
  onSelect: (selection: SubSelection) => void
  /** Modo expandido: zoom com a roda do mouse (no inspector, a roda rola o painel). */
  roomy?: boolean
  /** Muda quando o diagrama inteiro foi reposicionado (ex.: Organizar): reenquadra. */
  fitKey?: number
}) {
  const { component, selection, onSelect } = props
  const sub = subdiagramOf(component)!
  const { addSubdiagramLink, moveSubdiagramNodes } = useEditor.getState()
  const { fitView } = useReactFlow()

  // Estado local só para o arraste ficar fluido; ressincroniza quando o modelo muda.
  const [nodes, setNodes] = useState(() => toNodes(component, selection))
  const [synced, setSynced] = useState({ component, selection })
  if (synced.component !== component || synced.selection !== selection) {
    setSynced({ component, selection })
    setNodes(toNodes(component, selection))
  }
  const onNodesChange: OnNodesChange<SubFlowNode> = (changes) =>
    setNodes((ns) => applyNodeChanges(changes, ns))

  // Enquadra de novo quando a quantidade de nós muda (ex.: tabela nova fora da vista) ou
  // depois de organizar.
  const count = sub.nodes.length
  const { fitKey } = props
  useEffect(() => {
    const t = setTimeout(() => void fitView({ padding: 0.2, maxZoom: 1, duration: 200 }), 50)
    return () => clearTimeout(t)
  }, [count, fitKey, fitView])

  const positions = new Map(nodes.map((n) => [n.id, n.position]))
  // Relacionamentos de FK são calculados na hora (nunca guardados); só o ER os tem.
  const derived = sub.def.directed ? [] : derivedRelations(component.details ?? {})
  const derivedIds = new Set(derived.map((r) => r.id))
  const allLinks: SubdiagramLink[] = [...sub.links, ...derived]
  const sided = allLinks.map((l) => ({
    ...l,
    sides: sidesFor(positions.get(l.from) ?? { x: 0, y: 0 }, positions.get(l.to) ?? { x: 0, y: 0 }),
  }))
  const ports = subdiagramPorts(sided, positions)
  const edges: LaneFlowEdge[] = sided.map(({ sides, ...l }) => {
    return {
      id: l.id,
      source: l.from,
      target: l.to,
      sourceHandle: sides.source,
      targetHandle: sides.target,
      type: 'lane',
      data: { ports: ports.get(l.id), cardinality: sub.def.directed ? undefined : l.cardinality },
      label: linkText(l),
      markerEnd: sub.def.directed
        ? { type: MarkerType.ArrowClosed, width: 16, height: 16, color: 'var(--color-slate-400)' }
        : undefined,
      selected: selection?.type === 'link' && selection.id === l.id,
    }
  })

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={subNodeTypes}
      edgeTypes={subEdgeTypes}
      onNodesChange={onNodesChange}
      connectionMode={ConnectionMode.Loose}
      onConnect={(c) =>
        addSubdiagramLink(component.id, {
          from: c.source,
          to: c.target,
          cardinality: sub.def.directed ? undefined : '1:N',
        })
      }
      onNodeDragStop={(_, __, dragged) =>
        moveSubdiagramNodes(
          component.id,
          dragged.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y })),
        )
      }
      onNodeClick={(_, n) => onSelect({ type: 'node', id: n.id })}
      onEdgeClick={(_, e) => onSelect(derivedIds.has(e.id) ? null : { type: 'link', id: e.id })}
      onPaneClick={() => onSelect(null)}
      // A exclusão é tratada pelo SubdiagramSection, que isola o teclado do canvas principal.
      deleteKeyCode={null}
      zoomOnScroll={!!props.roomy}
      preventScrolling={!!props.roomy}
      minZoom={0.2}
      maxZoom={2}
      fitView
      fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={16} size={1} />
      {/* No inspector não cabe: lá o enquadramento é automático e há a tela cheia. */}
      {props.roomy && <Controls showInteractive={false} position="bottom-left" />}
    </ReactFlow>
  )
}
