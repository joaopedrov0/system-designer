/**
 * Operações sobre um cenário. Todas são funções puras (cenário -> novo cenário) e
 * são o ÚNICO caminho para modificar um cenário: a UI usa estas funções hoje, e a
 * mesma API pode ser exposta depois a um back-end, CLI ou servidor MCP.
 */
import { z } from 'zod'
import { componentCatalog } from './catalog'
import { detailItems, type ItemSection } from './details'
import { CommandError } from './errors'
import { allIds, uniqueId, uniqueName } from './ids'
import type {
  AiModel,
  Component,
  ComponentDetails,
  ComponentKind,
  Connection,
  Entity,
  EnvVar,
  Group,
  Hardware,
  Note,
  Point,
  Protocol,
  Replicas,
  Route,
  Scenario,
  Screen,
  Sensor,
  Topic,
} from './model'
import {
  ComponentDetailsSchema,
  HardwareSchema,
  HOST_KINDS,
  PROTOCOLS,
  ReplicasSchema,
  SCHEMA_VERSION,
  SensorSchema,
} from './schema'

export interface Created {
  scenario: Scenario
  id: string
}

export function createScenario(name = 'Novo sistema', now = new Date()): Scenario {
  const timestamp = now.toISOString()
  return {
    schemaVersion: SCHEMA_VERSION,
    id: crypto.randomUUID(),
    name: requireText(name, 'O nome do cenário'),
    createdAt: timestamp,
    updatedAt: timestamp,
    components: [],
    connections: [],
    groups: [],
    notes: [],
  }
}

export function renameScenario(s: Scenario, name: string): Scenario {
  return { ...s, name: requireText(name, 'O nome do cenário') }
}

// --- Componentes ----------------------------------------------------------------

export interface AddComponentInput {
  kind: ComponentKind
  position: Point
  name?: string
  technology?: string
  description?: string
  groupId?: string
}

export function addComponent(s: Scenario, input: AddComponentInput): Created {
  const def = componentCatalog[input.kind]
  if (!def) throw new CommandError(`Tipo de componente desconhecido: ${input.kind}`)

  const name =
    input.name !== undefined
      ? requireText(input.name, 'O nome do componente')
      : uniqueName(def.defaultName, new Set(s.components.map((c) => c.name)))
  const id = uniqueId(name, allIds(s))

  const component: Component = {
    id,
    kind: input.kind,
    name,
    layout: { x: input.position.x, y: input.position.y },
  }
  setOptionalText(component, 'technology', input.technology)
  setOptionalText(component, 'description', input.description)
  if (input.groupId) component.groupId = findGroup(s, input.groupId).id

  return { scenario: { ...s, components: [...s.components, component] }, id }
}

export type ComponentPatch = Partial<
  Pick<Component, 'name' | 'kind' | 'technology' | 'description' | 'tags'>
> & {
  /** Host, VM ou dispositivo de borda onde roda; `null`/`undefined` remove. */
  hostId?: string | null
  replicas?: Replicas | null
  hardware?: Hardware | null
  sensor?: Sensor | null
}

function parseInfra<T>(schema: z.ZodType<T>, value: unknown, what: string): T {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new CommandError(`${what} inválido:\n${z.prettifyError(parsed.error)}`)
  return parsed.data
}

/** Confere que `hostId` existe, é um tipo que hospeda e não forma ciclo (host de si mesmo). */
function checkHost(s: Scenario, id: string, hostId: string) {
  const host = findComponent(s, hostId)
  if (!(HOST_KINDS as readonly string[]).includes(host.kind)) {
    throw new CommandError(
      `"${hostId}" é ${componentCatalog[host.kind].label}, que não hospeda componentes (use host, vm ou edge-device).`,
    )
  }
  const seen = new Set<string>()
  for (let at: string | undefined = hostId; at && !seen.has(at); at = findComponent(s, at).hostId) {
    if (at === id)
      throw new CommandError(`"${id}" não pode rodar em "${hostId}": formaria um ciclo.`)
    seen.add(at)
  }
}

/** Campos opcionais passados como `undefined` ou string vazia são removidos. */
export function updateComponent(s: Scenario, id: string, patch: ComponentPatch): Scenario {
  findComponent(s, id)
  return {
    ...s,
    components: s.components.map((c) => {
      if (c.id !== id) return c
      const next = { ...c }
      if ('name' in patch) next.name = requireText(patch.name, 'O nome do componente')
      if (patch.kind !== undefined) {
        if (!componentCatalog[patch.kind]) {
          throw new CommandError(`Tipo de componente desconhecido: ${patch.kind}`)
        }
        next.kind = patch.kind
      }
      if ('hostId' in patch) {
        if (patch.hostId) {
          checkHost(s, id, patch.hostId)
          next.hostId = patch.hostId
        } else delete next.hostId
      }
      if ('replicas' in patch) {
        if (patch.replicas) {
          const replicas = parseInfra(ReplicasSchema, patch.replicas, 'Réplicas')
          if (replicas.max !== undefined && replicas.max < replicas.min) {
            throw new CommandError('Réplicas: o máximo não pode ser menor que o mínimo.')
          }
          next.replicas = replicas
        } else delete next.replicas
      }
      if ('hardware' in patch) {
        const hardware = patch.hardware && parseInfra(HardwareSchema, patch.hardware, 'Hardware')
        if (hardware && Object.keys(hardware).length > 0) next.hardware = hardware
        else delete next.hardware
      }
      if ('sensor' in patch) {
        if (patch.sensor) next.sensor = parseInfra(SensorSchema, patch.sensor, 'Sensor')
        else delete next.sensor
      }
      if ('technology' in patch) setOptionalText(next, 'technology', patch.technology)
      if ('description' in patch) setOptionalText(next, 'description', patch.description)
      if ('tags' in patch) {
        const tags = [...new Set((patch.tags ?? []).map((t) => t.trim()).filter(Boolean))]
        if (tags.length > 0) next.tags = tags
        else delete next.tags
      }
      return next
    }),
  }
}

export function moveComponents(s: Scenario, moves: ({ id: string } & Point)[]): Scenario {
  const byId = new Map(moves.map((m) => [m.id, m]))
  for (const id of byId.keys()) findComponent(s, id)
  return {
    ...s,
    components: s.components.map((c) => {
      const m = byId.get(c.id)
      return m ? { ...c, layout: { ...c.layout, x: m.x, y: m.y } } : c
    }),
  }
}

export interface ElementIds {
  componentIds?: string[]
  connectionIds?: string[]
  groupIds?: string[]
  noteIds?: string[]
}

/**
 * Remove elementos. Conexões ligadas a componentes removidos vão junto; membros de um
 * grupo removido continuam no cenário, apenas sem grupo.
 */
export function removeElements(s: Scenario, ids: ElementIds): Scenario {
  const components = new Set(ids.componentIds ?? [])
  const connections = new Set(ids.connectionIds ?? [])
  const groups = new Set(ids.groupIds ?? [])
  const notes = new Set(ids.noteIds ?? [])
  return {
    ...s,
    components: s.components
      .filter((c) => !components.has(c.id))
      .map((c) => (c.groupId && groups.has(c.groupId) ? omit(c, 'groupId') : c))
      // O que rodava num host removido fica sem host.
      .map((c) => (c.hostId && components.has(c.hostId) ? omit(c, 'hostId') : c)),
    connections: s.connections.filter(
      (c) => !connections.has(c.id) && !components.has(c.source) && !components.has(c.target),
    ),
    groups: s.groups
      .filter((g) => !groups.has(g.id))
      .map((g) => (g.parentId && groups.has(g.parentId) ? omit(g, 'parentId') : g)),
    notes: s.notes.filter((n) => !notes.has(n.id)),
  }
}

// --- Grupos, notas e posicionamento -------------------------------------------------

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const MIN_SIZE = 40

export function addGroup(s: Scenario, input: { layout: Rect; name?: string }): Created {
  const name =
    input.name !== undefined
      ? requireText(input.name, 'O nome do grupo')
      : uniqueName('Grupo', new Set(s.groups.map((g) => g.name)))
  const id = uniqueId(name, allIds(s))
  const group: Group = { id, name, layout: normalizeRect(input.layout) }
  return { scenario: { ...s, groups: [...s.groups, group] }, id }
}

export function updateGroup(
  s: Scenario,
  id: string,
  patch: Partial<Pick<Group, 'name' | 'description'>>,
): Scenario {
  findGroup(s, id)
  return {
    ...s,
    groups: s.groups.map((g) => {
      if (g.id !== id) return g
      const next = { ...g }
      if ('name' in patch) next.name = requireText(patch.name, 'O nome do grupo')
      if ('description' in patch) setOptionalText(next, 'description', patch.description)
      return next
    }),
  }
}

export function addNote(
  s: Scenario,
  input: { layout: Point & Partial<Rect>; text?: string },
): Created {
  const id = uniqueId('nota', allIds(s))
  const note: Note = { id, text: input.text ?? '', layout: { ...input.layout } }
  return { scenario: { ...s, notes: [...s.notes, note] }, id }
}

export function updateNote(s: Scenario, id: string, text: string): Scenario {
  if (!s.notes.some((n) => n.id === id)) throw new CommandError(`Nota não encontrada: ${id}`)
  return { ...s, notes: s.notes.map((n) => (n.id === id ? { ...n, text } : n)) }
}

export interface Move extends Point {
  id: string
  /** Só para componentes: id do grupo onde caiu, `null` para sair do grupo, omitido para manter. */
  groupId?: string | null
}

/**
 * Move componentes, grupos e notas (coordenadas absolutas). Mover um grupo arrasta junto
 * os componentes que pertencem a ele.
 */
export function moveElements(s: Scenario, moves: Move[]): Scenario {
  const byId = new Map(moves.map((m) => [m.id, m]))
  const groupDelta = new Map<string, Point>()
  for (const m of moves) {
    const group = s.groups.find((g) => g.id === m.id)
    if (group) {
      groupDelta.set(group.id, { x: m.x - group.layout.x, y: m.y - group.layout.y })
      continue
    }
    if (s.components.some((c) => c.id === m.id) || s.notes.some((n) => n.id === m.id)) continue
    throw new CommandError(`Elemento não encontrado: ${m.id}`)
  }

  const components = s.components.map((c) => {
    const m = byId.get(c.id)
    if (m) {
      const next: Component = { ...c, layout: { ...c.layout, x: m.x, y: m.y } }
      if (m.groupId === null) delete next.groupId
      else if (m.groupId !== undefined) {
        findGroup(s, m.groupId)
        next.groupId = m.groupId
      }
      return next
    }
    const delta = c.groupId ? groupDelta.get(c.groupId) : undefined
    return delta
      ? { ...c, layout: { ...c.layout, x: c.layout.x + delta.x, y: c.layout.y + delta.y } }
      : c
  })

  return {
    ...s,
    components,
    groups: s.groups.map((g) => {
      const m = byId.get(g.id)
      return m ? { ...g, layout: { ...g.layout, x: m.x, y: m.y } } : g
    }),
    notes: s.notes.map((n) => {
      const m = byId.get(n.id)
      return m ? { ...n, layout: { ...n.layout, x: m.x, y: m.y } } : n
    }),
  }
}

/** Redimensiona um grupo ou uma nota (posição + tamanho absolutos). */
export function resizeElement(s: Scenario, id: string, rect: Rect): Scenario {
  const layout = normalizeRect(rect)
  if (s.groups.some((g) => g.id === id)) {
    return { ...s, groups: s.groups.map((g) => (g.id === id ? { ...g, layout } : g)) }
  }
  if (s.notes.some((n) => n.id === id)) {
    return { ...s, notes: s.notes.map((n) => (n.id === id ? { ...n, layout } : n)) }
  }
  throw new CommandError(`Grupo ou nota não encontrado: ${id}`)
}

/**
 * Aplica um layout calculado (ex.: auto-layout): posições absolutas para quaisquer
 * elementos e tamanhos para grupos/notas, sem arrastar membros de grupos. As alças
 * escolhidas à mão nas conexões ficam obsoletas e são descartadas (a UI recalcula).
 */
export function applyLayout(
  s: Scenario,
  positions: Record<string, Point>,
  sizes: Record<string, { w: number; h: number }> = {},
): Scenario {
  const place = <T extends { id: string; layout: object }>(el: T): T => {
    const p = positions[el.id]
    const size = sizes[el.id]
    if (!p && !size) return el
    return { ...el, layout: { ...el.layout, ...p, ...size } }
  }
  return {
    ...s,
    components: s.components.map(place),
    groups: s.groups.map(place),
    notes: s.notes.map(place),
    connections: s.connections.map((c) => (c.layout ? omit(c, 'layout') : c)),
  }
}

// --- Conexões -------------------------------------------------------------------

export interface ConnectInput {
  source: string
  target: string
  protocol?: Protocol
  label?: string
  direction?: Connection['direction']
  sourceHandle?: string
  targetHandle?: string
}

export function connect(s: Scenario, input: ConnectInput): Created {
  findComponent(s, input.source)
  findComponent(s, input.target)
  if (input.source === input.target) {
    throw new CommandError('Um componente não pode se conectar a si mesmo.')
  }

  const id = uniqueId(`${input.source}--${input.target}`, allIds(s))
  const connection: Connection = { id, source: input.source, target: input.target }
  if (input.protocol) connection.protocol = input.protocol
  setOptionalText(connection, 'label', input.label)
  if (input.direction) connection.direction = input.direction
  if (input.sourceHandle || input.targetHandle) {
    connection.layout = {}
    if (input.sourceHandle) connection.layout.sourceHandle = input.sourceHandle
    if (input.targetHandle) connection.layout.targetHandle = input.targetHandle
  }

  return { scenario: { ...s, connections: [...s.connections, connection] }, id }
}

export type ConnectionPatch = Partial<
  Pick<Connection, 'protocol' | 'label' | 'direction' | 'async' | 'uses'>
>

/** Campos passados como `undefined` (ou valores padrão: one-way, síncrona, sem uses) são removidos. */
export function updateConnection(s: Scenario, id: string, patch: ConnectionPatch): Scenario {
  const current = findConnection(s, id)
  const next: Connection = { ...current }

  if ('protocol' in patch) {
    if (patch.protocol && !PROTOCOLS.includes(patch.protocol)) {
      throw new CommandError(`Protocolo desconhecido: ${patch.protocol}`)
    }
    if (patch.protocol) next.protocol = patch.protocol
    else delete next.protocol
  }
  if ('label' in patch) setOptionalText(next, 'label', patch.label)
  if ('direction' in patch) {
    if (patch.direction === 'two-way') next.direction = 'two-way'
    else delete next.direction
  }
  if ('async' in patch) {
    if (patch.async) next.async = true
    else delete next.async
  }
  if ('uses' in patch) {
    const valid = new Set(detailItems(findComponent(s, next.target)).map((i) => i.id))
    const unknown = (patch.uses ?? []).filter((u) => !valid.has(u))
    if (unknown.length > 0) {
      throw new CommandError(`Itens não encontrados no destino: ${unknown.join(', ')}`)
    }
    const uses = [...new Set(patch.uses ?? [])]
    if (uses.length > 0) next.uses = uses
    else delete next.uses
  }

  return { ...s, connections: s.connections.map((c) => (c.id === id ? next : c)) }
}

/** Inverte origem e destino. `uses` é descartado, pois referenciava o destino antigo. */
export function reverseConnection(s: Scenario, id: string): Scenario {
  const c = findConnection(s, id)
  const next: Connection = { ...c, source: c.target, target: c.source }
  delete next.uses
  if (c.layout) {
    next.layout = {}
    if (c.layout.targetHandle) next.layout.sourceHandle = c.layout.targetHandle
    if (c.layout.sourceHandle) next.layout.targetHandle = c.layout.sourceHandle
  }
  return { ...s, connections: s.connections.map((x) => (x.id === id ? next : x)) }
}

// --- Detalhes (complexidade progressiva) -------------------------------------------

export interface NewDetailItem {
  routes: Omit<Route, 'id'>
  entities: Omit<Entity, 'id'>
  models: Omit<AiModel, 'id'>
  topics: Omit<Topic, 'id'>
  screens: Omit<Screen, 'id'>
}

/** Acrescenta um item a uma seção, gerando um id legível e único dentro do componente. */
export function addDetailItem<S extends ItemSection>(
  s: Scenario,
  componentId: string,
  section: S,
  item: NewDetailItem[S],
): Created {
  const c = findComponent(s, componentId)
  const def = componentCatalog[c.kind]
  if (!def.sections.includes(section)) {
    throw new CommandError(
      `Um componente do tipo "${def.label}" não tem ${section}. Seções disponíveis: ${def.sections.join(', ') || 'nenhuma'}.`,
    )
  }
  const base =
    section === 'routes'
      ? `${(item as NewDetailItem['routes']).method} ${(item as NewDetailItem['routes']).path}`
      : (item as { name: string }).name
  const id = uniqueId(base, new Set(detailItems(c).map((i) => i.id)))
  const list = [...((c.details?.[section] ?? []) as object[]), { id, ...item }]
  return { scenario: updateComponentDetails(s, componentId, { [section]: list }), id }
}

/**
 * Substitui as seções informadas dos detalhes de um componente. Listas vazias, textos
 * vazios ou `undefined` removem a seção. Referências `uses` de conexões para itens que
 * deixaram de existir são limpas.
 */
export function updateComponentDetails(
  s: Scenario,
  componentId: string,
  patch: ComponentDetails,
): Scenario {
  const c = findComponent(s, componentId)
  const merged: Record<string, unknown> = { ...c.details, ...patch }
  // Segredos nunca guardam valor, venha de onde vier (UI, import, agente).
  if (Array.isArray(merged.env)) {
    merged.env = (merged.env as EnvVar[]).map((e) => {
      if (!e?.secret || e.value === undefined) return e
      const rest = { ...e }
      delete rest.value
      return rest
    })
  }
  // Ligações do diagrama interno só sobrevivem se as duas pontas ainda existem
  // (remover uma tela ou tabela leva as navegações/relacionamentos dela junto).
  for (const [links, nodes] of [
    ['navigation', 'screens'],
    ['relations', 'entities'],
  ] as const) {
    if (!Array.isArray(merged[links])) continue
    const ids = new Set(((merged[nodes] ?? []) as { id: string }[]).map((n) => n?.id))
    merged[links] = (merged[links] as { from: string; to: string }[]).filter(
      (l) => !l || (ids.has(l.from) && ids.has(l.to)),
    )
  }
  for (const [key, value] of Object.entries(merged)) {
    const empty =
      value === undefined ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === 'string' && !value.trim())
    if (empty) delete merged[key]
  }

  const parsed = ComponentDetailsSchema.safeParse(merged)
  if (!parsed.success) {
    throw new CommandError(`Detalhes inválidos:\n${z.prettifyError(parsed.error)}`)
  }
  const details = parsed.data
  const next: Component = { ...c, details }
  if (Object.keys(details).length === 0) delete next.details

  const itemIds = detailItems(next).map((i) => i.id)
  const duplicated = itemIds.find((id, i) => itemIds.indexOf(id) !== i)
  if (duplicated) throw new CommandError(`Id de detalhe duplicado: ${duplicated}`)
  const envKeys = (details.env ?? []).map((e) => e.key)
  const duplicatedKey = envKeys.find((k, i) => envKeys.indexOf(k) !== i)
  if (duplicatedKey) throw new CommandError(`Variável de ambiente duplicada: ${duplicatedKey}`)
  for (const links of [details.navigation, details.relations]) {
    const linkIds = (links ?? []).map((l) => l.id)
    const dupLink = linkIds.find((id, i) => linkIds.indexOf(id) !== i)
    if (dupLink) throw new CommandError(`Id de ligação duplicado: ${dupLink}`)
  }

  const valid = new Set(itemIds)
  return {
    ...s,
    components: s.components.map((x) => (x.id === componentId ? next : x)),
    connections: s.connections.map((conn) => {
      if (conn.target !== componentId || !conn.uses) return conn
      const uses = conn.uses.filter((u) => valid.has(u))
      if (uses.length === conn.uses.length) return conn
      const pruned: Connection = { ...conn, uses }
      if (uses.length === 0) delete pruned.uses
      return pruned
    }),
  }
}

export function setComponentExpanded(s: Scenario, id: string, expanded: boolean): Scenario {
  findComponent(s, id)
  return {
    ...s,
    components: s.components.map((c) => {
      if (c.id !== id) return c
      const layout = { ...c.layout }
      if (expanded) layout.expanded = true
      else delete layout.expanded
      return { ...c, layout }
    }),
  }
}

export function updateScenarioDescription(s: Scenario, description: string | undefined): Scenario {
  const next = { ...s }
  setOptionalText(next, 'description', description)
  return next
}

// --- Auxiliares -----------------------------------------------------------------

function findGroup(s: Scenario, id: string): Group {
  const g = s.groups.find((g) => g.id === id)
  if (!g) throw new CommandError(`Grupo não encontrado: ${id}`)
  return g
}

function normalizeRect(r: Rect): Rect {
  return { x: r.x, y: r.y, w: Math.max(MIN_SIZE, r.w), h: Math.max(MIN_SIZE, r.h) }
}

function omit<T extends object, K extends keyof T>(obj: T, key: K): T {
  const next = { ...obj }
  delete next[key]
  return next
}

function findConnection(s: Scenario, id: string): Connection {
  const c = s.connections.find((c) => c.id === id)
  if (!c) throw new CommandError(`Conexão não encontrada: ${id}`)
  return c
}

function findComponent(s: Scenario, id: string): Component {
  const c = s.components.find((c) => c.id === id)
  if (!c) throw new CommandError(`Componente não encontrado: ${id}`)
  return c
}

function requireText(value: string | undefined, what: string): string {
  const text = value?.trim()
  if (!text) throw new CommandError(`${what} não pode ficar vazio.`)
  return text
}

function setOptionalText<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: string | undefined,
) {
  const text = value?.trim()
  if (text) target[key] = text as T[K]
  else delete target[key]
}
