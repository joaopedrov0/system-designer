import { BaseEdge, type Edge, type EdgeProps } from '@xyflow/react'
import { memo } from 'react'
import {
  lanePath,
  reverseEnds,
  reversePorts,
  shift,
  type EdgeEnds,
  type EdgePorts,
} from './edgeGeometry'

export interface ConnectionEdgeData extends Record<string, unknown> {
  twoWay?: boolean
  /** Deslocamento da faixa, para conexões entre o mesmo par não se sobreporem. */
  offset?: number
  /** Ponto de cada ponta na alça, quando ela é dividida com conexões para outros nós. */
  ports?: EdgePorts
  async?: boolean
  /** Presente quando a visualização de fluxo está ligada. */
  flow?: { forward: number; backward?: number; slots: number }
}

export type ConnectionFlowEdge = Edge<ConnectionEdgeData, 'connection'>

/** Distância entre as duas faixas de uma conexão de mão dupla. */
export const LANE_GAP = 12
/** Afastamento extra do rótulo de uma faixa deslocada. */
const LABEL_PUSH = 9
/** Duração (s) de um "tempo" do fluxo: o sinal atravessa uma conexão. */
const SLOT_SECONDS = 1.1

function ConnectionEdge(props: EdgeProps<ConnectionFlowEdge>) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props
  const offset = data?.offset ?? 0
  const half = data?.twoWay ? LANE_GAP / 2 : 0
  const ends: EdgeEnds = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition }

  // Ida: origem -> destino na faixa "+"; volta (mão dupla): destino -> origem na faixa "-".
  const ports = data?.ports
  const [pathGo, labelX, labelY] = lanePath(ends, offset + half, ports)
  const pathBack = data?.twoWay
    ? lanePath(reverseEnds(ends), offset - half, ports && reversePorts(ports))[0]
    : undefined

  // Rótulo: mão dupla fica entre as duas faixas; conexões deslocadas empurram o rótulo
  // para o lado da própria faixa, para rótulos vizinhos não se sobreporem.
  const labelShift = -half + (offset === 0 ? 0 : Math.sign(offset) * LABEL_PUSH)
  const label = shift(labelX, labelY, sourcePosition, labelShift)

  const flow = data?.flow
  return (
    <>
      <BaseEdge
        id={props.id}
        path={pathGo}
        markerEnd={props.markerEnd}
        style={props.style}
        interactionWidth={props.interactionWidth}
        label={props.label}
        labelX={label.x}
        labelY={label.y}
        labelStyle={props.labelStyle}
        labelShowBg={props.labelShowBg}
        labelBgStyle={props.labelBgStyle}
        labelBgPadding={props.labelBgPadding}
        labelBgBorderRadius={props.labelBgBorderRadius}
      />
      {pathBack && (
        <BaseEdge
          path={pathBack}
          markerEnd={props.markerEnd}
          style={props.style}
          interactionWidth={props.interactionWidth}
        />
      )}
      {flow && <Signal path={pathGo} slot={flow.forward} slots={flow.slots} async={data?.async} />}
      {flow && pathBack && flow.backward !== undefined && (
        <Signal path={pathBack} slot={flow.backward} slots={flow.slots} async={data?.async} />
      )}
    </>
  )
}

/**
 * Um sinal que percorre o caminho só durante o seu "tempo" dentro do ciclo. Todos os
 * sinais compartilham o relógio do SVG, então ficam sincronizados entre conexões.
 */
function Signal(props: { path: string; slot: number; slots: number; async?: boolean }) {
  // Meio tempo de pausa no fim de cada ciclo, para dar para perceber o recomeço.
  const total = (props.slots + 0.5) * SLOT_SECONDS
  const start = ((props.slot * SLOT_SECONDS) / total).toFixed(4)
  const end = (((props.slot + 1) * SLOT_SECONDS) / total).toFixed(4)
  const dur = `${total.toFixed(2)}s`
  return (
    <circle r={4.5} className={props.async ? 'flow-signal flow-signal-async' : 'flow-signal'}>
      <animateMotion
        dur={dur}
        repeatCount="indefinite"
        path={props.path}
        calcMode="linear"
        keyPoints="0;0;1;1"
        keyTimes={`0;${start};${end};1`}
      />
      <animate
        attributeName="opacity"
        dur={dur}
        repeatCount="indefinite"
        values="0;0;1;1;0;0"
        keyTimes={`0;${start};${start};${end};${end};1`}
      />
    </circle>
  )
}

export default memo(ConnectionEdge)
