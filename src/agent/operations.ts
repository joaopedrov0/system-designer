/**
 * Operações sobre um cenário oferecidas a agentes de IA (servidor MCP) e à CLI. Cada uma
 * valida a entrada com Zod e delega para `core/commands`: as mesmas regras da interface.
 * Nada aqui depende do navegador nem do Node; ler e gravar o arquivo fica com quem chama.
 */
import { z } from 'zod'
import {
  addComponent,
  addDetailItem,
  addGroup,
  addNote,
  applyLayout,
  COMPONENT_KINDS,
  componentCatalog,
  componentKindList,
  connect,
  EntitySchema,
  EnvVarSchema,
  HTTP_METHODS,
  ITEM_SECTIONS,
  ModelSchema,
  moveElements,
  PROTOCOLS,
  removeElements,
  renameScenario,
  resizeElement,
  reverseConnection,
  RouteSchema,
  TopicSchema,
  toJSON,
  toMarkdown,
  toMermaid,
  updateComponent,
  updateComponentDetails,
  updateConnection,
  updateGroup,
  updateNote,
  updateScenarioDescription,
  type ItemSection,
  type NewDetailItem,
  type Point,
  type Scenario,
} from '../core'
import { computeLayout } from '../core/layout'

export interface OperationResult {
  /** Cenário alterado; ausente nas operações só de leitura. */
  scenario?: Scenario
  /** Resposta em texto para o agente. */
  text: string
}

export interface Operation<I extends z.ZodType = z.ZodType> {
  name: string
  description: string
  input: I
  run: (scenario: Scenario, input: z.output<I>) => OperationResult | Promise<OperationResult>
}

const define = <I extends z.ZodType>(op: Operation<I>) => op as unknown as Operation

// Tamanhos aproximados dos nós no canvas, para posicionar e organizar sem navegador.
const NODE = { width: 200, height: 58 }
const GAP_X = 280

/** À direita do componente mais à direita: um agente que só adiciona não empilha nós. */
function nextFreePosition(s: Scenario): Point {
  if (s.components.length === 0) return { x: 0, y: 0 }
  const rightmost = s.components.reduce((a, b) => (b.layout.x > a.layout.x ? b : a))
  return { x: rightmost.layout.x + GAP_X, y: rightmost.layout.y }
}

const NOTE = { w: 180, h: 100 }
const NOTE_GAP = 40

/** Caixa que envolve componentes e grupos (as notas ficam fora: são posicionadas depois). */
function diagramBounds(s: Scenario) {
  const boxes = [
    ...s.components.map((c) => ({ x: c.layout.x, y: c.layout.y, ...NODE })),
    ...s.groups.map((g) => ({
      x: g.layout.x,
      y: g.layout.y,
      width: g.layout.w,
      height: g.layout.h,
    })),
  ]
  if (boxes.length === 0) return undefined
  const x = Math.min(...boxes.map((b) => b.x))
  const y = Math.min(...boxes.map((b) => b.y))
  const right = Math.max(...boxes.map((b) => b.x + b.width))
  const bottom = Math.max(...boxes.map((b) => b.y + b.height))
  return { x, y, w: right - x, h: bottom - y }
}

/** Posição da n-ésima nota: numa fileira logo abaixo do diagrama, sem sobrepor. */
function notePosition(s: Scenario, index: number): Point {
  const b = diagramBounds(s)
  const origin = b ? { x: b.x, y: b.y + b.h + 80 } : { x: 0, y: 0 }
  return { x: origin.x + index * (NOTE.w + NOTE_GAP), y: origin.y }
}

const kind = z
  .enum(COMPONENT_KINDS)
  .describe(
    `Tipo do componente: ${componentKindList.map((d) => `${d.kind} (${d.label})`).join(', ')}`,
  )
const protocol = z.enum(PROTOCOLS)
const direction = z.enum(['one-way', 'two-way'])
const optionalText = z.string().optional()

const itemSchemas = {
  routes: RouteSchema.omit({ id: true }),
  entities: EntitySchema.omit({ id: true }),
  models: ModelSchema.omit({ id: true }),
  topics: TopicSchema.omit({ id: true }),
} satisfies Record<ItemSection, z.ZodObject>

export const operations: Operation[] = [
  define({
    name: 'get_scenario',
    description:
      'Lê o cenário. "markdown" (padrão) é um resumo legível com todos os ids, bom para entender o sistema; "json" é o formato completo; "mermaid" é só o diagrama.',
    input: z.object({ format: z.enum(['markdown', 'json', 'mermaid']).default('markdown') }),
    run: (s, { format }) => ({
      text: format === 'json' ? toJSON(s) : format === 'mermaid' ? toMermaid(s) : toMarkdown(s),
    }),
  }),
  define({
    name: 'list_component_kinds',
    description:
      'Lista os tipos de componente e quais seções de detalhe cada um oferece (rotas, tabelas, modelos, tópicos, variáveis de ambiente).',
    input: z.object({}),
    run: () => ({
      text: componentKindList
        .map((d) => `- ${d.kind}: ${d.label} — seções: ${d.sections.join(', ') || 'nenhuma'}`)
        .join('\n'),
    }),
  }),
  define({
    name: 'set_scenario_info',
    description: 'Renomeia o cenário e/ou muda a descrição (texto vazio remove a descrição).',
    input: z.object({ name: optionalText, description: optionalText }),
    run: (s, { name, description }) => {
      let next = s
      if (name !== undefined) next = renameScenario(next, name)
      if (description !== undefined) next = updateScenarioDescription(next, description)
      return { scenario: next, text: 'Cenário atualizado.' }
    },
  }),
  define({
    name: 'add_component',
    description:
      'Adiciona um componente. Só o tipo é obrigatório. Sem x/y, é posicionado à direita dos existentes (use auto_layout depois de adicionar vários).',
    input: z.object({
      kind,
      name: optionalText.describe(
        'Nome; padrão é o nome do tipo ("Servidor", "Banco de dados"...).',
      ),
      technology: optionalText.describe('Ex.: "PostgreSQL 16", "Node 22", "OpenAI".'),
      description: optionalText,
      groupId: optionalText.describe('Id de um grupo existente.'),
      tags: z.array(z.string()).optional(),
      x: z.number().optional(),
      y: z.number().optional(),
    }),
    run: (s, input) => {
      const auto = nextFreePosition(s)
      const r = addComponent(s, {
        kind: input.kind,
        name: input.name,
        technology: input.technology,
        description: input.description,
        groupId: input.groupId,
        position: { x: input.x ?? auto.x, y: input.y ?? auto.y },
      })
      const scenario = input.tags
        ? updateComponent(r.scenario, r.id, { tags: input.tags })
        : r.scenario
      const label = componentCatalog[input.kind].label
      return { scenario, text: `Componente criado com id "${r.id}" (${label}).` }
    },
  }),
  define({
    name: 'update_component',
    description:
      'Altera nome, tipo, tecnologia, descrição ou tags de um componente. Texto vazio remove o campo opcional.',
    input: z.object({
      id: z.string(),
      name: optionalText,
      kind: kind.optional(),
      technology: optionalText,
      description: optionalText,
      tags: z.array(z.string()).optional(),
    }),
    run: (s, { id, ...patch }) => {
      const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
      return { scenario: updateComponent(s, id, defined), text: `Componente "${id}" atualizado.` }
    },
  }),
  define({
    name: 'remove_elements',
    description:
      'Remove componentes, conexões, grupos e/ou notas pelos ids. Conexões de componentes removidos vão junto; membros de um grupo removido ficam sem grupo.',
    input: z.object({
      componentIds: z.array(z.string()).optional(),
      connectionIds: z.array(z.string()).optional(),
      groupIds: z.array(z.string()).optional(),
      noteIds: z.array(z.string()).optional(),
    }),
    run: (s, ids) => {
      const all = Object.values(ids).flat()
      const known = new Set([
        ...s.components.map((c) => c.id),
        ...s.connections.map((c) => c.id),
        ...s.groups.map((g) => g.id),
        ...s.notes.map((n) => n.id),
      ])
      const unknown = all.filter((id) => !known.has(id))
      if (unknown.length > 0) throw new Error(`Ids não encontrados: ${unknown.join(', ')}`)
      return { scenario: removeElements(s, ids), text: `Removido(s): ${all.join(', ')}.` }
    },
  }),
  define({
    name: 'connect',
    description:
      'Conecta dois componentes (origem chama/envia para destino). direction "two-way" para ida e volta; async para mensagens/eventos.',
    input: z.object({
      source: z.string(),
      target: z.string(),
      protocol: protocol.optional(),
      label: optionalText,
      direction: direction.optional(),
      async: z.boolean().optional(),
    }),
    run: (s, { async, ...input }) => {
      const same = s.connections.find(
        (c) =>
          c.source === input.source && c.target === input.target && c.protocol === input.protocol,
      )
      if (same) {
        throw new Error(
          `Já existe a conexão "${same.id}" de "${input.source}" para "${input.target}"${input.protocol ? ` (${input.protocol})` : ''}. Use update_connection para alterá-la.`,
        )
      }
      const r = connect(s, input)
      const scenario = async ? updateConnection(r.scenario, r.id, { async }) : r.scenario
      return { scenario, text: `Conexão criada com id "${r.id}".` }
    },
  }),
  define({
    name: 'update_connection',
    description:
      'Altera protocolo, rótulo, sentido, assincronia ou "uses" (ids de rotas/tabelas/modelos/tópicos do componente de DESTINO usados pela conexão).',
    input: z.object({
      id: z.string(),
      protocol: protocol.optional(),
      label: optionalText,
      direction: direction.optional(),
      async: z.boolean().optional(),
      uses: z.array(z.string()).optional(),
    }),
    run: (s, { id, ...patch }) => {
      const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
      return { scenario: updateConnection(s, id, defined), text: `Conexão "${id}" atualizada.` }
    },
  }),
  define({
    name: 'reverse_connection',
    description: 'Inverte origem e destino de uma conexão ("uses" é descartado).',
    input: z.object({ id: z.string() }),
    run: (s, { id }) => ({
      scenario: reverseConnection(s, id),
      text: `Conexão "${id}" invertida.`,
    }),
  }),
  define({
    name: 'add_detail_item',
    description: `Acrescenta um item de detalhe a um componente (complexidade progressiva). Cada tipo só aceita algumas seções (veja list_component_kinds). Formatos de item: routes {method: ${HTTP_METHODS.join('|')}, path, description?}; entities {name, fields?: [{name, type?}]}; models {name, purpose?}; topics {name}. Devolve o id do item (usado em "uses" das conexões).`,
    // A raiz precisa ser um objeto simples (clientes MCP recusam anyOf no topo); o item
    // é a união dos formatos, e o formato certo para a seção é conferido ao executar.
    input: z.object({
      componentId: z.string(),
      section: z.enum(ITEM_SECTIONS),
      item: z.union([
        itemSchemas.routes.strict(),
        itemSchemas.entities.strict(),
        itemSchemas.models.strict(),
        itemSchemas.topics.strict(),
      ]),
    }),
    run: (s, { componentId, section, item }) => {
      const parsed = itemSchemas[section].strict().safeParse(item)
      if (!parsed.success) {
        throw new Error(`Item inválido para ${section}:
${z.prettifyError(parsed.error)}`)
      }
      const r = addDetailItem(s, componentId, section, parsed.data as NewDetailItem[typeof section])
      return { scenario: r.scenario, text: `Item criado em ${section} com id "${r.id}".` }
    },
  }),
  define({
    name: 'set_component_details',
    description:
      'Substitui seções inteiras dos detalhes de um componente (as não informadas ficam como estão). Lista vazia ou texto vazio remove a seção. Itens de routes/entities/models/topics precisam de "id". Variáveis secretas ("secret": true) nunca guardam valor.',
    input: z.object({
      componentId: z.string(),
      routes: z.array(RouteSchema).optional(),
      entities: z.array(EntitySchema).optional(),
      models: z.array(ModelSchema).optional(),
      topics: z.array(TopicSchema).optional(),
      env: z.array(EnvVarSchema).optional(),
      notes: optionalText,
    }),
    run: (s, { componentId, ...patch }) => {
      const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
      return {
        scenario: updateComponentDetails(s, componentId, defined),
        text: `Detalhes de "${componentId}" atualizados.`,
      }
    },
  }),
  define({
    name: 'add_group',
    description:
      'Cria um grupo/fronteira (ex.: "Backend", "VPC", "Serviços externos"). Com componentIds, o grupo é desenhado em volta deles e eles passam a pertencer ao grupo.',
    input: z.object({
      name: optionalText,
      description: optionalText,
      componentIds: z.array(z.string()).optional(),
    }),
    run: (s, { name, description, componentIds = [] }) => {
      const members = componentIds.map((id) => {
        const c = s.components.find((c) => c.id === id)
        if (!c) throw new Error(`Componente não encontrado: ${id}`)
        return c
      })
      const pad = { top: 48, side: 24 }
      const layout =
        members.length > 0
          ? (() => {
              const x = Math.min(...members.map((c) => c.layout.x)) - pad.side
              const y = Math.min(...members.map((c) => c.layout.y)) - pad.top
              const right = Math.max(...members.map((c) => c.layout.x + NODE.width)) + pad.side
              const bottom = Math.max(...members.map((c) => c.layout.y + NODE.height)) + pad.side
              return { x, y, w: right - x, h: bottom - y }
            })()
          : { ...nextFreePosition(s), w: 420, h: 260 }
      const r = addGroup(s, { name, layout })
      let scenario = r.scenario
      if (description) scenario = updateGroup(scenario, r.id, { description })
      if (members.length > 0) {
        scenario = moveElements(
          scenario,
          members.map((c) => ({ id: c.id, x: c.layout.x, y: c.layout.y, groupId: r.id })),
        )
      }
      return { scenario, text: `Grupo criado com id "${r.id}".` }
    },
  }),
  define({
    name: 'update_group',
    description: 'Renomeia um grupo ou muda a descrição.',
    input: z.object({ id: z.string(), name: optionalText, description: optionalText }),
    run: (s, { id, ...patch }) => {
      const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
      return { scenario: updateGroup(s, id, defined), text: `Grupo "${id}" atualizado.` }
    },
  }),
  define({
    name: 'set_group_membership',
    description: 'Põe componentes num grupo (groupId) ou tira de qualquer grupo (groupId null).',
    input: z.object({ componentIds: z.array(z.string()), groupId: z.string().nullable() }),
    run: (s, { componentIds, groupId }) => {
      const moves = componentIds.map((id) => {
        const c = s.components.find((c) => c.id === id)
        if (!c) throw new Error(`Componente não encontrado: ${id}`)
        return { id, x: c.layout.x, y: c.layout.y, groupId }
      })
      return { scenario: moveElements(s, moves), text: 'Grupos atualizados.' }
    },
  }),
  define({
    name: 'add_note',
    description:
      'Adiciona uma nota de texto livre ao canvas. Sem x/y, entra numa fileira logo abaixo do diagrama (auto_layout também reposiciona as notas ali).',
    input: z.object({ text: z.string(), x: z.number().optional(), y: z.number().optional() }),
    run: (s, { text, x, y }) => {
      const auto = notePosition(s, s.notes.length)
      const r = addNote(s, { text, layout: { x: x ?? auto.x, y: y ?? auto.y, ...NOTE } })
      return { scenario: r.scenario, text: `Nota criada com id "${r.id}".` }
    },
  }),
  define({
    name: 'update_note',
    description: 'Troca o texto de uma nota.',
    input: z.object({ id: z.string(), text: z.string() }),
    run: (s, { id, text }) => ({
      scenario: updateNote(s, id, text),
      text: `Nota "${id}" atualizada.`,
    }),
  }),
  define({
    name: 'move_elements',
    description:
      'Move componentes, grupos e notas para coordenadas absolutas (x cresce para a direita, y para baixo; um componente tem ~200x58). Mover um grupo leva seus membros. w/h redimensionam grupos e notas.',
    input: z.object({
      moves: z.array(
        z.object({
          id: z.string(),
          x: z.number(),
          y: z.number(),
          w: z.number().optional(),
          h: z.number().optional(),
        }),
      ),
    }),
    run: (s, { moves }) => {
      let scenario = moveElements(
        s,
        moves.map(({ id, x, y }) => ({ id, x, y })),
      )
      for (const m of moves) {
        if (m.w === undefined && m.h === undefined) continue
        const el = [...scenario.groups, ...scenario.notes].find((e) => e.id === m.id)
        if (!el) throw new Error(`Só grupos e notas podem ser redimensionados: ${m.id}`)
        scenario = resizeElement(scenario, m.id, {
          x: m.x,
          y: m.y,
          w: m.w ?? el.layout.w ?? 180,
          h: m.h ?? el.layout.h ?? 100,
        })
      }
      return { scenario, text: 'Elementos movidos.' }
    },
  }),
  define({
    name: 'auto_layout',
    description:
      'Organiza o diagrama em camadas da esquerda para a direita, seguindo as conexões (o mesmo que o botão "Organizar"), e põe as notas numa fileira abaixo dele. Bom depois de adicionar vários componentes.',
    input: z.object({}),
    run: async (s) => {
      const { positions, sizes } = await computeLayout(s, (id) => {
        const g = s.groups.find((g) => g.id === id)
        return g ? { width: g.layout.w, height: g.layout.h } : NODE
      })
      const laidOut = applyLayout(s, positions, sizes)
      const notes: Record<string, Point> = {}
      laidOut.notes.forEach((n, i) => (notes[n.id] = notePosition(laidOut, i)))
      const scenario = applyLayout(laidOut, notes)
      const b = diagramBounds(scenario)
      const size = b ? ` Área ocupada: ${Math.round(b.w)} x ${Math.round(b.h)} (sem as notas).` : ''
      return {
        scenario,
        text: `Diagrama organizado: ${s.components.length} componentes, ${s.groups.length} grupos e ${s.notes.length} notas abaixo.${size}`,
      }
    },
  }),
]

export const operationsByName = new Map(operations.map((op) => [op.name, op]))

/** Valida a entrada e executa. Erros de validação viram mensagens legíveis. */
export async function runOperation(
  scenario: Scenario,
  name: string,
  rawInput: unknown,
): Promise<OperationResult> {
  const op = operationsByName.get(name)
  if (!op) throw new Error(`Operação desconhecida: ${name}`)
  const parsed = op.input.safeParse(rawInput ?? {})
  if (!parsed.success) throw new Error(`Entrada inválida:\n${z.prettifyError(parsed.error)}`)
  return op.run(scenario, parsed.data)
}

/** JSON Schema da entrada de uma operação (para o MCP e a ajuda da CLI). */
export function inputJsonSchema(op: Operation): Record<string, unknown> {
  return z.toJSONSchema(op.input, { io: 'input' }) as Record<string, unknown>
}
