import { expect, it } from 'vitest'
import { addComponent, addDetailItem, createScenario, updateComponent } from './commands'
import { searchComponents } from './search'

function sample() {
  const db = addComponent(createScenario(), {
    kind: 'database',
    position: { x: 0, y: 0 },
    technology: 'PostgreSQL',
  })
  const api = addComponent(db.scenario, {
    kind: 'server',
    position: { x: 0, y: 0 },
    name: 'Autenticação',
  })
  const withRoute = addDetailItem(api.scenario, api.id, 'routes', {
    method: 'POST',
    path: '/login',
  })
  return updateComponent(withRoute.scenario, api.id, { tags: ['segurança'] }).components
}

it('sem filtro retorna null', () => {
  expect(searchComponents(sample(), '  ')).toBeNull()
})

it('busca em nome, tecnologia, rotas e tags, ignorando acentos e caixa', () => {
  const components = sample()
  expect(searchComponents(components, 'postgres')).toEqual(new Set(['banco-de-dados']))
  expect(searchComponents(components, 'autenticacao')).toEqual(new Set(['autenticacao']))
  expect(searchComponents(components, '/login')).toEqual(new Set(['autenticacao']))
  expect(searchComponents(components, 'SEGURANCA')).toEqual(new Set(['autenticacao']))
  expect(searchComponents(components, 'post login')).toEqual(new Set(['autenticacao']))
})

it('filtra por tipo', () => {
  expect(searchComponents(sample(), '', 'database')).toEqual(new Set(['banco-de-dados']))
  expect(searchComponents(sample(), 'postgres', 'server')).toEqual(new Set())
})
