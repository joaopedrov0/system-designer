import { BaseEdge, Position, type Edge, type EdgeProps } from '@xyflow/react'
import { memo } from 'react'
import { lanePath, type EdgePorts } from '../canvas/edgeGeometry'

/** Cardinalidade "1:N" (lado da origem primeiro): desenha pé de galinha nas pontas. */
export type LaneFlowEdge = Edge<{ ports?: EdgePorts; cardinality?: string }, 'lane'>

const OUTWARD = {
  [Position.Left]: [-1, 0],
  [Position.Right]: [1, 0],
  [Position.Top]: [0, -1],
  [Position.Bottom]: [0, 1],
} as const

/** Notação de pé de galinha numa ponta: duas barras para "um", três dentes para "muitos". */
function CrowsFoot(props: { x: number; y: number; position: Position; many: boolean }) {
  const [dx, dy] = OUTWARD[props.position]
  const [px, py] = [-dy, dx]
  const at = (along: number, across: number) =>
    `${props.x + dx * along + px * across} ${props.y + dy * along + py * across}`
  const d = props.many
    ? `M ${at(0, -6)} L ${at(12, 0)} M ${at(0, 0)} L ${at(12, 0)} M ${at(0, 6)} L ${at(12, 0)}`
    : `M ${at(8, -5)} L ${at(8, 5)} M ${at(13, -5)} L ${at(13, 5)}`
  return (
    <path
      d={d}
      fill="none"
      stroke="var(--color-slate-400)"
      strokeWidth={1.5}
      pointerEvents="none"
    />
  )
}

/** Aresta em degraus que respeita o ponto de cada ponta na alça (ver subdiagramPorts). */
function LaneEdge(props: EdgeProps<LaneFlowEdge>) {
  const [path, labelX, labelY] = lanePath(
    {
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      sourcePosition: props.sourcePosition,
      targetX: props.targetX,
      targetY: props.targetY,
      targetPosition: props.targetPosition,
    },
    0,
    props.data?.ports,
  )
  const [from, to] = props.data?.cardinality?.split(':') ?? []
  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={props.markerEnd}
        style={props.style}
        interactionWidth={props.interactionWidth}
        label={props.label}
        labelX={labelX}
        labelY={labelY}
        labelStyle={props.labelStyle}
        labelShowBg={props.labelShowBg}
        labelBgStyle={props.labelBgStyle}
        labelBgPadding={props.labelBgPadding}
        labelBgBorderRadius={props.labelBgBorderRadius}
      />
      {from && to && (
        <>
          <CrowsFoot
            x={props.sourceX}
            y={props.sourceY}
            position={props.sourcePosition}
            many={from === 'N'}
          />
          <CrowsFoot
            x={props.targetX}
            y={props.targetY}
            position={props.targetPosition}
            many={to === 'N'}
          />
        </>
      )}
    </>
  )
}

export default memo(LaneEdge)
