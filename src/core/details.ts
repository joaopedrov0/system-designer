import type { DetailSection } from './catalog'
import type { Component } from './model'

/** Seções cujos itens têm id e podem ser referenciados por conexões (`uses`). */
export const ITEM_SECTIONS = ['routes', 'entities', 'models', 'topics', 'screens'] as const
export type ItemSection = (typeof ITEM_SECTIONS)[number]

export const DETAIL_SECTIONS: DetailSection[] = [...ITEM_SECTIONS, 'env']

export interface DetailItemRef {
  section: ItemSection
  id: string
  /** Texto curto para exibir: "GET /users", "pedidos", "gpt-5"... */
  label: string
}

export function detailItems(c: Component): DetailItemRef[] {
  const d = c.details ?? {}
  return [
    ...(d.routes ?? []).map((r) => ({
      section: 'routes' as const,
      id: r.id,
      label: `${r.method} ${r.path}`,
    })),
    ...(d.entities ?? []).map((e) => ({ section: 'entities' as const, id: e.id, label: e.name })),
    ...(d.models ?? []).map((m) => ({ section: 'models' as const, id: m.id, label: m.name })),
    ...(d.topics ?? []).map((t) => ({ section: 'topics' as const, id: t.id, label: t.name })),
    ...(d.screens ?? []).map((t) => ({ section: 'screens' as const, id: t.id, label: t.name })),
  ]
}

export function detailCount(c: Component, section: DetailSection): number {
  return c.details?.[section]?.length ?? 0
}
