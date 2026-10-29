import { BaseEdge, type Edge, type EdgeProps } from '@xyflow/react'
import { memo } from 'react'
import { lanePath, type EdgePorts } from '../canvas/edgeGeometry'

export type LaneFlowEdge = Edge<{ ports?: EdgePorts }, 'lane'>

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
  return (
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
  )
}

export default memo(LaneEdge)
