import { z } from 'zod'
import { ScenarioSchema, SCHEMA_VERSION } from '../schema'

/**
 * JSON Schema do formato canônico (o que é aceito na importação). Publicado em
 * `schema/scenario.schema.json` para editores, validadores e agentes de IA.
 */
export function scenarioJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(ScenarioSchema, { io: 'input' }),
    $id: `https://system-designer.local/schema/scenario.v${SCHEMA_VERSION}.json`,
    title: 'System Designer — cenário',
    description:
      'Descreve um sistema de software: componentes, conexões entre eles e detalhes opcionais ' +
      '(rotas, tabelas, modelos de IA, tópicos, variáveis). Só `kind` e `name` são obrigatórios ' +
      'em um componente; o restante é complexidade progressiva.',
  }
}
