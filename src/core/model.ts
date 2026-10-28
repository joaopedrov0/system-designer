import type { z } from 'zod'
import type {
  COMPONENT_KINDS,
  EntitySchema,
  EnvVarSchema,
  ModelSchema,
  RouteSchema,
  TopicSchema,
  ComponentDetailsSchema,
  ComponentSchema,
  ConnectionSchema,
  GroupSchema,
  NoteSchema,
  PROTOCOLS,
  ScenarioSchema,
} from './schema'

// Os tipos são derivados dos schemas Zod, que são a fonte da verdade do formato.
export type ComponentKind = (typeof COMPONENT_KINDS)[number]
export type Protocol = (typeof PROTOCOLS)[number]
export type Route = z.infer<typeof RouteSchema>
export type Entity = z.infer<typeof EntitySchema>
export type AiModel = z.infer<typeof ModelSchema>
export type Topic = z.infer<typeof TopicSchema>
export type EnvVar = z.infer<typeof EnvVarSchema>
export type ComponentDetails = z.infer<typeof ComponentDetailsSchema>
export type Component = z.infer<typeof ComponentSchema>
export type Connection = z.infer<typeof ConnectionSchema>
export type Group = z.infer<typeof GroupSchema>
export type Note = z.infer<typeof NoteSchema>
export type Scenario = z.infer<typeof ScenarioSchema>

export interface Point {
  x: number
  y: number
}
