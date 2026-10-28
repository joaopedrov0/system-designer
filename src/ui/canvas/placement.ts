import { COMPONENT_KINDS, type ComponentKind, type Point } from '../../core'
import { useEditor } from '../../store/editor'
import { NODE_WIDTH } from './ComponentNode'
import { containingGroup } from './mapping'
import { NOTE_SIZE } from './sizes'

/** O que pode ser arrastado da paleta: um tipo de componente, um grupo ou uma nota. */
export type PaletteItem = ComponentKind | 'group' | 'note'

export const PALETTE_DRAG_MIME = 'application/x-system-designer-item'
export const NODE_HEIGHT = 58
const GROUP_SIZE = { w: 420, h: 260 }

export function isPaletteItem(value: string): value is PaletteItem {
  return value === 'group' || value === 'note' || COMPONENT_KINDS.includes(value as ComponentKind)
}

/** Cria o item centralizado no ponto (coordenadas do canvas). */
export function addAt(item: PaletteItem, center: Point) {
  const editor = useEditor.getState()
  if (item === 'group') {
    editor.addGroup({
      layout: { x: center.x - GROUP_SIZE.w / 2, y: center.y - GROUP_SIZE.h / 2, ...GROUP_SIZE },
    })
  } else if (item === 'note') {
    editor.addNote({
      layout: { x: center.x - NOTE_SIZE.w / 2, y: center.y - NOTE_SIZE.h / 2, ...NOTE_SIZE },
    })
  } else {
    const position = { x: center.x - NODE_WIDTH / 2, y: center.y - NODE_HEIGHT / 2 }
    const group = containingGroup(editor.scenario.groups, {
      ...position,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    })
    editor.addComponent({ kind: item, position, groupId: group?.id })
  }
}
