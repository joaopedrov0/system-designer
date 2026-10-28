import type { ElkNode } from 'elkjs/lib/elk.bundled.js'
import type { Point, Scenario } from '../../core'

export interface ComputedLayout {
  positions: Record<string, Point>
  sizes: Record<string, { w: number; h: number }>
}

type Size = { width: number; height: number }

const GROUP_PADDING = '[top=48,left=24,bottom=24,right=24]'

/**
 * Organiza componentes (e grupos com seus membros) em camadas, da esquerda para a
 * direita, seguindo as conexões. Notas ficam onde estão. Devolve posições absolutas.
 */
export async function computeLayout(
  scenario: Scenario,
  sizeOf: (id: string) => Size,
): Promise<ComputedLayout> {
  // Carregado sob demanda: o elkjs é grande e só é usado aqui.
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js')
  const elk = new ELK()

  const groupIds = new Set(scenario.groups.map((g) => g.id))
  const leaf = (id: string): ElkNode => ({ id, ...sizeOf(id) })

  const graph: ElkNode = {
    id: '__root__',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.spacing.nodeNode': '50',
      'elk.layered.spacing.nodeNodeBetweenLayers': '90',
      'elk.spacing.edgeNode': '30',
    },
    children: [
      ...scenario.groups.map((g): ElkNode => {
        const members = scenario.components.filter((c) => c.groupId === g.id)
        return members.length > 0
          ? {
              id: g.id,
              layoutOptions: { 'elk.padding': GROUP_PADDING },
              children: members.map((c) => leaf(c.id)),
            }
          : { id: g.id, width: g.layout.w, height: g.layout.h }
      }),
      ...scenario.components
        .filter((c) => !c.groupId || !groupIds.has(c.groupId))
        .map((c) => leaf(c.id)),
    ],
    edges: scenario.connections.map((c) => ({
      id: c.id,
      sources: [c.source],
      targets: [c.target],
    })),
  }

  const result = await elk.layout(graph)
  const layout: ComputedLayout = { positions: {}, sizes: {} }
  const walk = (node: ElkNode, offset: Point) => {
    for (const child of node.children ?? []) {
      const abs = { x: offset.x + (child.x ?? 0), y: offset.y + (child.y ?? 0) }
      layout.positions[child.id] = abs
      if (groupIds.has(child.id)) {
        layout.sizes[child.id] = { w: child.width ?? 0, h: child.height ?? 0 }
        walk(child, abs)
      }
    }
  }
  walk(result, { x: 0, y: 0 })
  return layout
}
