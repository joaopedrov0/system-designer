import { mkdirSync, writeFileSync } from 'node:fs'
import { scenarioJsonSchema } from '../src/core/export/jsonSchema'

mkdirSync('schema', { recursive: true })
writeFileSync('schema/scenario.schema.json', JSON.stringify(scenarioJsonSchema(), null, 2) + '\n')
console.log('schema/scenario.schema.json atualizado')
