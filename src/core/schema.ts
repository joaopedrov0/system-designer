import { z } from 'zod'

/** Versão do formato canônico. Incrementar exige uma migração em migrations.ts. */
export const SCHEMA_VERSION = 1 as const

export const COMPONENT_KINDS = [
  'client',
  'server',
  'database',
  'cache',
  'queue',
  'worker',
  'gateway',
  'storage',
  'ai-provider',
  'external-api',
  'generic',
] as const

export const PROTOCOLS = [
  'http',
  'grpc',
  'websocket',
  'sql',
  'event',
  'sdk',
  // Comunicação local entre processos (sockets, pipes, IPC do Electron) e leitura/escrita
  // de arquivos (volumes, discos, pastas compartilhadas).
  'ipc',
  'file',
  'generic',
] as const

export const HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
  'WS',
  'ANY',
] as const

const Id = z.string().min(1)

// --- Detalhes opcionais (complexidade progressiva) ---------------------------

/** Posição de um item no diagrama interno do componente (mapa de navegação, diagrama ER). */
const DiagramPositionSchema = z.object({ x: z.number(), y: z.number() })

export const CARDINALITIES = ['1:1', '1:N', 'N:N'] as const

export const RouteSchema = z.object({
  id: Id,
  method: z.enum(HTTP_METHODS),
  path: z.string(),
  description: z.string().optional(),
})

export const EntityFieldSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional(),
})

export const EntitySchema = z.object({
  id: Id,
  name: z.string().min(1),
  fields: z.array(EntityFieldSchema).optional(),
  layout: DiagramPositionSchema.optional(),
})

/** Tela (ou página/rota de interface) de um cliente. */
export const ScreenSchema = z.object({
  id: Id,
  name: z.string().min(1),
  path: z.string().optional(),
  description: z.string().optional(),
  layout: DiagramPositionSchema.optional(),
})

/** Navegação de uma tela para outra (`from`/`to` são ids de telas). */
export const NavigationSchema = z.object({
  id: Id,
  from: Id,
  to: Id,
  label: z.string().optional(),
})

/** Relacionamento entre duas tabelas (`from`/`to` são ids de entidades). */
export const RelationSchema = z.object({
  id: Id,
  from: Id,
  to: Id,
  cardinality: z.enum(CARDINALITIES).optional(),
  label: z.string().optional(),
})

export const ModelSchema = z.object({
  id: Id,
  name: z.string().min(1),
  purpose: z.string().optional(),
})

export const TopicSchema = z.object({
  id: Id,
  name: z.string().min(1),
})

export const EnvVarSchema = z.object({
  key: z.string().min(1),
  value: z.string().optional(),
  secret: z.boolean().optional(),
  /** Para que serve ou de onde vem (ex.: "definida no .env", "chave da OpenAI"). */
  description: z.string().optional(),
})

export const ComponentDetailsSchema = z.object({
  routes: z.array(RouteSchema).optional(),
  entities: z.array(EntitySchema).optional(),
  models: z.array(ModelSchema).optional(),
  topics: z.array(TopicSchema).optional(),
  screens: z.array(ScreenSchema).optional(),
  env: z.array(EnvVarSchema).optional(),
  notes: z.string().optional(),
  // Ligações do diagrama interno (ver core/subdiagram.ts).
  navigation: z.array(NavigationSchema).optional(),
  relations: z.array(RelationSchema).optional(),
})

// --- Elementos do cenário -----------------------------------------------------

export const ComponentLayoutSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().optional(),
  h: z.number().optional(),
})

export const ComponentSchema = z.object({
  id: Id,
  kind: z.enum(COMPONENT_KINDS),
  name: z.string().min(1),
  description: z.string().optional(),
  technology: z.string().optional(),
  groupId: Id.optional(),
  tags: z.array(z.string()).optional(),
  layout: ComponentLayoutSchema.extend({
    /** Mostra os detalhes listados dentro do nó no canvas. */
    expanded: z.boolean().optional(),
  }),
  details: ComponentDetailsSchema.optional(),
})

export const ConnectionSchema = z.object({
  id: Id,
  source: Id,
  target: Id,
  protocol: z.enum(PROTOCOLS).optional(),
  label: z.string().optional(),
  direction: z.enum(['one-way', 'two-way']).optional(),
  async: z.boolean().optional(),
  /** Ids de rotas/entidades/tópicos do componente de destino usados por esta conexão. */
  uses: z.array(z.string()).optional(),
  layout: z
    .object({
      sourceHandle: z.string().optional(),
      targetHandle: z.string().optional(),
    })
    .optional(),
})

export const GroupSchema = z.object({
  id: Id,
  name: z.string().min(1),
  description: z.string().optional(),
  parentId: Id.optional(),
  layout: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
})

export const NoteSchema = z.object({
  id: Id,
  text: z.string(),
  layout: ComponentLayoutSchema,
})

export const ScenarioSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: Id,
  name: z.string().min(1),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  components: z.array(ComponentSchema).default([]),
  connections: z.array(ConnectionSchema).default([]),
  groups: z.array(GroupSchema).default([]),
  notes: z.array(NoteSchema).default([]),
})
