import type { ComponentDetails, ComponentKind, Protocol } from './model'

export type DetailSection = Exclude<keyof ComponentDetails, 'notes'>

export interface ComponentKindDefinition {
  kind: ComponentKind
  /** Nome exibido na interface. */
  label: string
  /** Nome padrão de um componente recém-criado. */
  defaultName: string
  /** Nome do ícone (a UI mapeia para o componente de ícone). */
  icon: string
  color: string
  /** Seções de detalhe opcionais oferecidas para este tipo. */
  sections: DetailSection[]
}

const define = (defs: ComponentKindDefinition[]) =>
  Object.fromEntries(defs.map((d) => [d.kind, d])) as Record<ComponentKind, ComponentKindDefinition>

export const componentCatalog = define([
  {
    kind: 'client',
    label: 'Cliente',
    defaultName: 'Cliente',
    icon: 'monitor',
    color: '#3b82f6',
    sections: ['env'],
  },
  {
    kind: 'server',
    label: 'Servidor',
    defaultName: 'Servidor',
    icon: 'server',
    color: '#6366f1',
    sections: ['routes', 'env'],
  },
  {
    kind: 'database',
    label: 'Banco de dados',
    defaultName: 'Banco de dados',
    icon: 'database',
    color: '#10b981',
    sections: ['entities', 'env'],
  },
  {
    kind: 'cache',
    label: 'Cache',
    defaultName: 'Cache',
    icon: 'zap',
    color: '#f59e0b',
    sections: ['env'],
  },
  {
    kind: 'queue',
    label: 'Fila / Mensageria',
    defaultName: 'Fila',
    icon: 'inbox',
    color: '#ec4899',
    sections: ['topics', 'env'],
  },
  {
    kind: 'worker',
    label: 'Worker',
    defaultName: 'Worker',
    icon: 'cog',
    color: '#8b5cf6',
    sections: ['topics', 'env'],
  },
  {
    kind: 'gateway',
    label: 'Gateway / Proxy',
    defaultName: 'Gateway',
    icon: 'network',
    color: '#0ea5e9',
    sections: ['routes', 'env'],
  },
  {
    kind: 'storage',
    label: 'Armazenamento',
    defaultName: 'Armazenamento',
    icon: 'hard-drive',
    color: '#64748b',
    sections: ['env'],
  },
  {
    kind: 'ai-provider',
    label: 'Provedor de IA',
    defaultName: 'Provedor de IA',
    icon: 'sparkles',
    color: '#d946ef',
    sections: ['models', 'env'],
  },
  {
    kind: 'external-api',
    label: 'API externa',
    defaultName: 'API externa',
    icon: 'globe',
    color: '#f97316',
    sections: ['routes', 'env'],
  },
  {
    kind: 'generic',
    label: 'Genérico',
    defaultName: 'Componente',
    icon: 'box',
    color: '#6b7280',
    sections: ['env'],
  },
])

export const componentKindList = Object.values(componentCatalog)

export const detailSectionInfo: Record<
  DetailSection,
  { label: string; singular: string; plural: string }
> = {
  routes: { label: 'Rotas', singular: 'rota', plural: 'rotas' },
  entities: { label: 'Tabelas / Entidades', singular: 'tabela', plural: 'tabelas' },
  models: { label: 'Modelos', singular: 'modelo', plural: 'modelos' },
  topics: { label: 'Tópicos', singular: 'tópico', plural: 'tópicos' },
  env: { label: 'Variáveis de ambiente', singular: 'variável', plural: 'variáveis' },
}

export const protocolLabels: Record<Protocol, string> = {
  http: 'HTTP',
  grpc: 'gRPC',
  websocket: 'WebSocket',
  sql: 'SQL',
  event: 'Evento',
  sdk: 'SDK',
  generic: 'Genérico',
}
