import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { scenarioJsonSchema } from './jsonSchema'

it('schema/scenario.schema.json está atualizado (rode `npm run schema`)', () => {
  const published = JSON.parse(readFileSync('schema/scenario.schema.json', 'utf-8'))
  expect(published).toEqual(scenarioJsonSchema())
})
