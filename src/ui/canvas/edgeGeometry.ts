import { getSmoothStepPath, Position } from '@xyflow/react'

export interface EdgeEnds {
  sourceX: number
  sourceY: number
  sourcePosition: Position
  targetX: number
  targetY: number
  targetPosition: Position
}

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
): [path: string, labelX: number, labelY: number] {
  const s = shift(ends.sourceX, ends.sourceY, ends.sourcePosition, d)
  const t = shift(ends.targetX, ends.targetY, ends.targetPosition, d)
  const turn = Math.sign(ends.targetX - ends.sourceX) * Math.sign(ends.targetY - ends.sourceY)
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: s.x,
    sourceY: s.y,
    sourcePosition: ends.sourcePosition,
    targetX: t.x,
    targetY: t.y,
    targetPosition: ends.targetPosition,
    centerX: (ends.sourceX + ends.targetX) / 2 - d * turn,
    centerY: (ends.sourceY + ends.targetY) / 2 - d * turn,
    borderRadius: 8,
  })
  return [path, labelX, labelY]
}

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
