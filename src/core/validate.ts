import { componentCatalog } from './catalog'
import { DETAIL_SECTIONS, detailItems, ITEM_SECTIONS } from './details'
import { referencedField } from './er'
import type { Component, Entity, Scenario } from './model'

export interface ValidationIssue {
  /** "error": o cenário está inconsistente; "warning": provável descuido. */
  level: 'error' | 'warning'
  message: string
  /** Elementos envolvidos. */
  ids: string[]
}

// Tamanho aproximado de um componente no canvas (o real depende do conteúdo).
const NODE = { w: 200, h: 58 }

/**
 * Confere a consistência do cenário além do schema: referências quebradas, ids repetidos,
 * segredos com valor, conexões duplicadas, componentes soltos ou sobrepostos. Pensado para
 * agentes revisarem o que montaram; as operações normais já evitam a maior parte disso,
 * mas um arquivo editado à mão ou por outra ferramenta pode chegar em qualquer estado.
 */
export function validateScenario(s: Scenario): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const error = (message: string, ...ids: string[]) => issues.push({ level: 'error', message, ids })
  const warn = (message: string, ...ids: string[]) =>
    issues.push({ level: 'warning', message, ids })

  // Componentes, grupos e notas dividem o mesmo espaço de ids no canvas.
  const nodeIds = [...s.components, ...s.groups, ...s.notes].map((e) => e.id)
  for (const id of repeated(nodeIds))
    error(`Id repetido entre componentes/grupos/notas: "${id}".`, id)
  for (const id of repeated(s.connections.map((c) => c.id)))
    error(`Id de conexão repetido: "${id}".`, id)

  const components = new Map(s.components.map((c) => [c.id, c]))
  const groups = new Map(s.groups.map((g) => [g.id, g]))

  for (const c of s.components) checkComponent(c, error, warn)

  for (const c of s.components) {
    if (c.groupId && !groups.has(c.groupId))
      error(`"${c.id}" aponta para um grupo inexistente: "${c.groupId}".`, c.id)
  }

  for (const g of s.groups) {
    if (g.parentId && !groups.has(g.parentId))
      error(`O grupo "${g.id}" aponta para um grupo pai inexistente: "${g.parentId}".`, g.id)
    // Ciclo: subindo pelos pais, volta ao próprio grupo.
    const seen = new Set([g.id])
    for (let p = g.parentId; p && groups.has(p); p = groups.get(p)!.parentId) {
      if (seen.has(p)) {
        error(`Os grupos formam um ciclo de pais a partir de "${g.id}".`, g.id)
        break
      }
      seen.add(p)
    }
  }

  const connected = new Set<string>()
  const signatures = new Map<string, string>()
  for (const c of s.connections) {
    const source = components.get(c.source)
    const target = components.get(c.target)
    if (!source) error(`A conexão "${c.id}" sai de um componente inexistente: "${c.source}".`, c.id)
    if (!target)
      error(`A conexão "${c.id}" chega a um componente inexistente: "${c.target}".`, c.id)
    if (c.source === c.target) warn(`A conexão "${c.id}" liga "${c.source}" a ele mesmo.`, c.id)
    connected.add(c.source).add(c.target)

    const signature = `${c.source}\u0000${c.target}\u0000${c.protocol ?? ''}`
    const twin = signatures.get(signature)
    if (twin) {
      warn(
        `As conexões "${twin}" e "${c.id}" repetem origem, destino e protocolo; talvez sejam a mesma.`,
        twin,
        c.id,
      )
    } else signatures.set(signature, c.id)

    if (c.uses?.length && target) {
      const items = new Set(detailItems(target).map((i) => i.id))
      const missing = c.uses.filter((id) => !items.has(id))
      if (missing.length)
        error(
          `A conexão "${c.id}" usa itens que "${target.id}" não tem: ${missing.join(', ')}.`,
          c.id,
        )
    }
  }

  if (s.components.length > 1) {
    for (const c of s.components) {
      if (!connected.has(c.id)) warn(`"${c.id}" não tem nenhuma conexão.`, c.id)
    }
  }

  for (const c of s.components) {
    const g = c.groupId ? groups.get(c.groupId) : undefined
    if (!g) continue
    const cx = c.layout.x + NODE.w / 2
    const cy = c.layout.y + NODE.h / 2
    const { x, y, w, h } = g.layout
    if (cx < x || cx > x + w || cy < y || cy > y + h)
      warn(`"${c.id}" pertence ao grupo "${g.id}", mas está desenhado fora dele.`, c.id, g.id)
  }

  for (let i = 0; i < s.components.length; i++) {
    for (let j = i + 1; j < s.components.length; j++) {
      const a = s.components[i].layout
      const b = s.components[j].layout
      if (Math.abs(a.x - b.x) < NODE.w && Math.abs(a.y - b.y) < NODE.h) {
        const ids = [s.components[i].id, s.components[j].id]
        warn(`"${ids[0]}" e "${ids[1]}" estão sobrepostos no desenho (use auto_layout).`, ...ids)
      }
    }
  }

  return issues
}

/** FKs que apontam para tabela ou campo inexistente (erro); tabela sem PK, só se o banco usa PK. */
function checkForeignKeys(
  c: Component,
  entities: Entity[],
  error: (message: string, ...ids: string[]) => void,
  warn: (message: string, ...ids: string[]) => void,
) {
  for (const e of entities) {
    for (const f of e.fields ?? []) {
      if (!f.fk) continue
      const target = entities.find((x) => x.id === f.fk!.entity)
      if (!target) {
        error(
          `"${c.id}": o campo "${e.id}.${f.name}" referencia a tabela "${f.fk.entity}", que não existe.`,
          c.id,
        )
      } else if (f.fk.field && !referencedField(target, f.fk.field)) {
        error(
          `"${c.id}": o campo "${e.id}.${f.name}" referencia "${target.id}.${f.fk.field}", que não existe.`,
          c.id,
        )
      }
    }
  }
  // Só incomoda quem já marca PKs: um banco que nunca usou isso segue sem avisos.
  const usesPk = entities.some((e) => e.fields?.some((f) => f.pk))
  if (!usesPk) return
  for (const e of entities) {
    if (e.fields?.length && !e.fields.some((f) => f.pk))
      warn(`"${c.id}": a tabela "${e.id}" não tem chave primária.`, c.id)
  }
}

function checkComponent(
  c: Component,
  error: (message: string, ...ids: string[]) => void,
  warn: (message: string, ...ids: string[]) => void,
) {
  const d = c.details ?? {}
  const allowed = new Set<string>(componentCatalog[c.kind].sections)
  for (const section of DETAIL_SECTIONS) {
    if (d[section]?.length && !allowed.has(section))
      warn(
        `"${c.id}" (${componentCatalog[c.kind].label}) tem ${section}, que esse tipo não usa.`,
        c.id,
      )
  }
  for (const section of ITEM_SECTIONS) {
    for (const id of repeated((d[section] ?? []).map((item) => item.id)))
      error(`"${c.id}" tem dois itens em ${section} com o id "${id}".`, c.id)
  }
  for (const [links, nodes, noun] of [
    [d.navigation, d.screens, 'tela'],
    [d.relations, d.entities, 'tabela'],
  ] as const) {
    const ids = new Set((nodes ?? []).map((n) => n.id))
    for (const l of links ?? []) {
      const missing = [l.from, l.to].filter((id) => !ids.has(id))
      if (missing.length)
        error(
          `A ligação "${l.id}" de "${c.id}" aponta para ${noun} inexistente: ${missing.join(', ')}.`,
          c.id,
        )
    }
    for (const id of repeated((links ?? []).map((l) => l.id)))
      error(`"${c.id}" tem duas ligações com o id "${id}".`, c.id)
  }
  checkForeignKeys(c, d.entities ?? [], error, warn)
  for (const key of repeated((d.env ?? []).map((v) => v.key)))
    warn(`"${c.id}" declara a variável "${key}" mais de uma vez.`, c.id)
  for (const v of d.env ?? []) {
    if (v.secret && v.value)
      error(
        `A variável secreta "${v.key}" de "${c.id}" guarda um valor; segredos não devem ter valor.`,
        c.id,
      )
  }
}

function repeated(ids: string[]): string[] {
  const seen = new Set<string>()
  const dup = new Set<string>()
  for (const id of ids) (seen.has(id) ? dup : seen).add(id)
  return [...dup]
}

/** Relatório em texto (para agentes e a CLI). */
export function formatValidation(issues: ValidationIssue[]): string {
  if (issues.length === 0) return 'Nenhum problema encontrado.'
  const errors = issues.filter((i) => i.level === 'error')
  const warnings = issues.filter((i) => i.level === 'warning')
  const lines: string[] = []
  if (errors.length) lines.push(`Erros (${errors.length}):`, ...errors.map((i) => `- ${i.message}`))
  if (warnings.length) {
    if (lines.length) lines.push('')
    lines.push(`Avisos (${warnings.length}):`, ...warnings.map((i) => `- ${i.message}`))
  }
  return lines.join('\n')
}
