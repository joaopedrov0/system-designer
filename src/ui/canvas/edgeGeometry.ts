import { getSmoothStepPath, Position } from '@xyflow/react'

export interface EdgeEnds {
  sourceX: number
  sourceY: number
  sourcePosition: Position
  targetX: number
  targetY: number
  targetPosition: Position
}

/**
 * Deslocamento de cada ponta ao longo da alça, para conexões com nós diferentes que saem
 * pela mesma alça não partirem do mesmo ponto (ver portShifts em mapping.ts).
 */
export interface EdgePorts {
  source: number
  target: number
}

const NO_PORTS: EdgePorts = { source: 0, target: 0 }

const isHorizontal = (side: Position) => side === Position.Left || side === Position.Right

/** Desloca um ponto de conexão perpendicularmente ao lado em que está a alça. */
export function shift(x: number, y: number, side: Position, d: number) {
  return isHorizontal(side) ? { x, y: y + d } : { x: x + d, y }
}

/**
 * Caminho em degraus de uma faixa deslocada `d` px da linha central de uma conexão.
 *
 * Deslocar só as pontas não basta: o trecho do meio (a "dobra") ficaria igual em todas as
 * faixas e elas se sobreporiam. Por isso a dobra também é deslocada, no sentido que evita
 * que as faixas se cruzem: indo para baixo-direita, a faixa de baixo dobra antes; indo
 * para cima-direita, depois (e espelhado para a esquerda). A regra só depende do sinal de
 * dx·dy, então ida e volta (caminho invertido) usam a mesma dobra para o mesmo `d`.
 */
export function lanePath(
  ends: EdgeEnds,
  d: number,
  ports: EdgePorts = NO_PORTS,
): [path: string, labelX: number, labelY: number] {
  // Primeiro a ponta vai para o seu ponto na alça; a faixa se desloca a partir dele.
  const s0 = shift(ends.sourceX, ends.sourceY, ends.sourcePosition, ports.source)
  const t0 = shift(ends.targetX, ends.targetY, ends.targetPosition, ports.target)
  const s = shift(s0.x, s0.y, ends.sourcePosition, d)
  const t = shift(t0.x, t0.y, ends.targetPosition, d)
  const turn = Math.sign(ends.targetX - ends.sourceX) * Math.sign(ends.targetY - ends.sourceY)
  // A dobra segue a mesma regra para o deslocamento total (faixa + pontos nas alças), assim
  // conexões vizinhas numa alça dividida também se aninham em vez de se cruzarem. A soma
  // das pontas não muda com a inversão, então ida e volta continuam coerentes.
  const bend = (d + ports.source + ports.target) * turn
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: s.x,
    sourceY: s.y,
    sourcePosition: ends.sourcePosition,
    targetX: t.x,
    targetY: t.y,
    targetPosition: ends.targetPosition,
    centerX: (s0.x + t0.x) / 2 - bend,
    centerY: (s0.y + t0.y) / 2 - bend,
    borderRadius: 8,
  })
  return [path, labelX, labelY]
}

/** Pontas trocadas, para o trajeto ao contrário. */
export const reversePorts = (p: EdgePorts): EdgePorts => ({ source: p.target, target: p.source })

/** O mesmo trajeto percorrido ao contrário (destino -> origem). */
export function reverseEnds(e: EdgeEnds): EdgeEnds {
  return {
    sourceX: e.targetX,
    sourceY: e.targetY,
    sourcePosition: e.targetPosition,
    targetX: e.sourceX,
    targetY: e.sourceY,
    targetPosition: e.sourcePosition,
  }
}
