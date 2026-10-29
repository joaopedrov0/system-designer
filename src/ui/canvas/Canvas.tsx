import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type IsValidConnection,
  type OnConnect,
  type OnDelete,
  type OnEdgesChange,
  type OnNodeDrag,
  type OnNodesChange,
  type OnSelectionChangeFunc,
} from '@xyflow/react'
import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react'
import { componentCatalog, flowSchedule, searchComponents, type Move } from '../../core'
import { useEditor } from '../../store/editor'
import { useResolvedTheme, useView } from '../../store/view'
import ComponentNode, { NODE_WIDTH } from './ComponentNode'
import ConnectionEdge, { type ConnectionFlowEdge } from './ConnectionEdge'
import GroupNode from './GroupNode'
import LaserOverlay from './LaserOverlay'
import { containingGroup, portLayout, toEdges, toNodes, type FlowNode } from './mapping'
import NoteNode from './NoteNode'
import { addAt, isPaletteItem, NODE_HEIGHT, PALETTE_DRAG_MIME } from './placement'
import { debugInput } from '../debugInput'
import SearchPanel from './SearchPanel'
import { MAX_ZOOM, MIN_ZOOM, useTabletNavigation } from './useTabletNavigation'

const nodeTypes = { component: ComponentNode, boundary: GroupNode, note: NoteNode }
const edgeTypes = { connection: ConnectionEdge }

const idsOfType = (nodes: FlowNode[], type: FlowNode['type']) =>
  nodes.filter((n) => n.type === type).map((n) => n.id)

/**
 * O React Flow mantém nós/arestas locais (posição durante o arraste, seleção, medidas);
 * o cenário do store continua sendo a fonte da verdade e é ressincronizado a cada mudança.
 * Só operações concluídas (soltar o arraste, conectar, excluir) viram commands — e,
 * portanto, entradas no histórico de undo.
 */
export default function Canvas() {
  const scenario = useEditor((s) => s.scenario)
  const { components, connections, groups, notes } = scenario
  const search = useEditor((s) => s.search)
  const { moveElements, removeElements, connect, setSelection } = useEditor.getState()
  const { screenToFlowPosition, getInternalNode } = useReactFlow()
  const flowMode = useView((s) => s.flow)
  const theme = useResolvedTheme()
  const wrapper = useRef<HTMLDivElement>(null)
  const tabletGesture = useTabletNavigation(wrapper)

  const [nodes, setNodes] = useState(() => toNodes(scenario))
  const [edges, setEdges] = useState(() => toEdges(connections, components))

  // Ressincroniza durante a renderização quando o cenário muda (undo, rename, etc.).
  const [synced, setSynced] = useState(scenario)
  if (synced !== scenario) {
    setSynced(scenario)
    if (synced.components !== components || synced.groups !== groups || synced.notes !== notes) {
      setNodes((prev) => toNodes(scenario, prev))
    }
    // Rótulos das arestas dependem dos detalhes do destino, então componentes também contam.
    if (synced.connections !== connections || synced.components !== components) {
      setEdges((prev) => toEdges(connections, components, prev))
    }
  }

  // Busca: esmaece o que não casa (só visual; não altera o estado do React Flow).
  const matches = useMemo(
    () => searchComponents(components, search.text, search.kind),
    [components, search.text, search.kind],
  )
  // Componentes crescem quando as faixas de uma alça não cabem neles.
  const minSizes = useMemo(
    () => portLayout(connections, components).minSizes,
    [connections, components],
  )
  const displayNodes = useMemo(
    () =>
      nodes.map((n) => {
        if (n.type !== 'component') return n
        let node = n
        const minSize = minSizes.get(n.id)
        if (minSize) node = { ...node, data: { ...node.data, minSize } }
        if (matches && !matches.has(n.id)) node = { ...node, className: 'dimmed' }
        return node
      }),
    [nodes, matches, minSizes],
  )
  // Fluxo: agenda os sinais (ida e volta) de cada conexão.
  const schedule = useMemo(
    () => (flowMode ? flowSchedule({ components, connections }) : null),
    [flowMode, components, connections],
  )
  const displayEdges = useMemo(
    () =>
      edges.map((e) => {
        let edge = e
        const lane = schedule?.lanes.get(e.id)
        if (lane)
          edge = { ...edge, data: { ...edge.data, flow: { ...lane, slots: schedule!.slots } } }
        if (matches && !(matches.has(e.source) && matches.has(e.target))) {
          edge = { ...edge, className: 'dimmed' }
        }
        return edge
      }),
    [edges, matches, schedule],
  )

  const onSelectionChange = useCallback<OnSelectionChangeFunc<FlowNode>>(
    ({ nodes, edges }) =>
      setSelection({
        componentIds: idsOfType(nodes, 'component'),
        connectionIds: edges.map((e) => e.id),
        groupIds: idsOfType(nodes, 'boundary'),
        noteIds: idsOfType(nodes, 'note'),
      }),
    [setSelection],
  )

  const onNodesChange: OnNodesChange<FlowNode> = (changes) =>
    setNodes((ns) => applyNodeChanges(changes, ns))
  const onEdgesChange: OnEdgesChange<ConnectionFlowEdge> = (changes) =>
    setEdges((es) => applyEdgeChanges(changes, es))

  /** Ao soltar: grava posições absolutas e decide se componentes entraram/saíram de grupos. */
  const onNodeDragStop: OnNodeDrag<FlowNode> = (_event, _node, dragged) => {
    const draggedIds = new Set(dragged.map((n) => n.id))
    const moves = dragged.map((n): Move => {
      const abs = getInternalNode(n.id)?.internals.positionAbsolute ?? n.position
      const move: Move = { id: n.id, x: abs.x, y: abs.y }
      if (n.type !== 'component') return move
      const current = n.data.component.groupId
      // Arrastado junto com o próprio grupo: continua nele.
      if (current && draggedIds.has(current)) return move
      const group = containingGroup(
        groups,
        {
          ...abs,
          width: n.measured?.width ?? NODE_WIDTH,
          height: n.measured?.height ?? NODE_HEIGHT,
        },
        draggedIds,
      )
      if (group?.id !== current) move.groupId = group?.id ?? null
      return move
    })
    moveElements(moves)
  }

  const onDelete: OnDelete<FlowNode, ConnectionFlowEdge> = ({ nodes, edges }) =>
    removeElements({
      componentIds: idsOfType(nodes, 'component'),
      connectionIds: edges.map((e) => e.id),
      groupIds: idsOfType(nodes, 'boundary'),
      noteIds: idsOfType(nodes, 'note'),
    })

  const onConnect: OnConnect = (c) => {
    debugInput(`onConnect ${c.source}[${c.sourceHandle}] -> ${c.target}[${c.targetHandle}]`)
    connect({
      source: c.source,
      target: c.target,
      sourceHandle: c.sourceHandle ?? undefined,
      targetHandle: c.targetHandle ?? undefined,
    })
  }

  const isValidConnection: IsValidConnection = (c) => c.source !== c.target

  const onDragOver = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes(PALETTE_DRAG_MIME)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const onDrop = (event: DragEvent) => {
    const item = event.dataTransfer.getData(PALETTE_DRAG_MIME)
    if (!isPaletteItem(item)) return
    event.preventDefault()
    addAt(item, screenToFlowPosition({ x: event.clientX, y: event.clientY }))
  }

  const empty = components.length === 0 && groups.length === 0 && notes.length === 0

  return (
    <div
      ref={wrapper}
      // touch-action: none em todo o canvas: sem isso o navegador pode tratar a caneta
      // como gesto de rolagem sobre nós/arestas e cancelar o arraste.
      className={`relative h-full w-full touch-none ${tabletGesture ? `tablet-${tabletGesture}` : ''}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onDelete={onDelete}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        isValidConnection={isValidConnection}
        connectionMode={ConnectionMode.Loose}
        deleteKeyCode={['Delete', 'Backspace']}
        multiSelectionKeyCode={['Shift', 'Control', 'Meta']}
        elevateNodesOnSelect={false}
        // Espaço é tratado por useTabletNavigation (pan/zoom estilo Krita, inclusive com caneta).
        panActivationKeyCode={null}
        colorMode={theme}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        fitView
        fitViewOptions={{ maxZoom: 1, padding: 0.3 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => {
            const node = n as FlowNode
            if (node.type === 'component') return componentCatalog[node.data.component.kind].color
            // O minimapa usa atributos SVG, que não resolvem var(): cores fixas por tema.
            if (node.type === 'note') return theme === 'dark' ? '#78350f' : '#fde68a'
            return theme === 'dark' ? '#334155' : '#e2e8f0'
          }}
        />
        {!empty && <SearchPanel matches={matches} />}
      </ReactFlow>
      <LaserOverlay />

      {empty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-lg border border-dashed border-slate-300 bg-surface/80 px-6 py-4 text-center text-sm text-slate-500">
            Arraste componentes da barra lateral para começar.
            <br />
            Conecte-os puxando de uma borda até outro componente.
          </div>
        </div>
      )}
    </div>
  )
}
