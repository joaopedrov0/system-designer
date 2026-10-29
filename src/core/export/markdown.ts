import { componentCatalog, detailSectionInfo, protocolLabels } from '../catalog'
import { detailItems } from '../details'
import type { Component, Connection, Scenario } from '../model'
import { toMermaid } from './mermaid'

/** Célula de tabela Markdown: sem quebras de linha nem `|` soltos. */
function cell(value: string | undefined): string {
  return (value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim()
}

function componentSection(s: Scenario, c: Component): string[] {
  const lines = [`### ${c.name}`, '']
  const facts = [
    `- **Tipo:** ${componentCatalog[c.kind]?.label ?? c.kind}`,
    `- **Id:** \`${c.id}\``,
  ]
  if (c.technology) facts.push(`- **Tecnologia:** ${c.technology}`)
  const group = c.groupId && s.groups.find((g) => g.id === c.groupId)
  if (group) facts.push(`- **Grupo:** ${group.name}`)
  if (c.tags?.length) facts.push(`- **Tags:** ${c.tags.join(', ')}`)
  lines.push(...facts, '')
  if (c.description) lines.push(c.description, '')

  const d = c.details ?? {}
  if (d.routes?.length) {
    lines.push(`**${detailSectionInfo.routes.label}**`, '')
    lines.push('| Método | Caminho | Descrição | Id |', '| --- | --- | --- | --- |')
    for (const r of d.routes) {
      lines.push(`| ${r.method} | \`${cell(r.path)}\` | ${cell(r.description)} | \`${r.id}\` |`)
    }
    lines.push('')
  }
  if (d.entities?.length) {
    lines.push(`**${detailSectionInfo.entities.label}**`, '')
    for (const e of d.entities) {
      const fields = (e.fields ?? []).map((f) => (f.type ? `${f.name} (${f.type})` : f.name))
      lines.push(`- ${e.name} \`${e.id}\`${fields.length ? `: ${fields.join(', ')}` : ''}`)
    }
    lines.push('')
  }
  if (d.models?.length) {
    lines.push(`**${detailSectionInfo.models.label}**`, '')
    for (const m of d.models) {
      lines.push(`- ${m.name} \`${m.id}\`${m.purpose ? ` — ${m.purpose}` : ''}`)
    }
    lines.push('')
  }
  if (d.topics?.length) {
    lines.push(`**${detailSectionInfo.topics.label}**`, '')
    for (const t of d.topics) lines.push(`- ${t.name} \`${t.id}\``)
    lines.push('')
  }
  if (d.env?.length) {
    lines.push(`**${detailSectionInfo.env.label}**`, '')
    for (const e of d.env) {
      // Segredos nunca guardam valor; o export também não inventa um.
      const value = e.secret ? ' (segredo)' : e.value ? ` = \`${e.value}\`` : ''
      lines.push(`- \`${e.key}\`${value}${e.description ? ` — ${e.description}` : ''}`)
    }
    lines.push('')
  }
  if (d.notes) lines.push(d.notes, '')
  return lines
}

function connectionRow(s: Scenario, c: Connection): string {
  const name = (id: string) => s.components.find((x) => x.id === id)?.name ?? id
  const target = s.components.find((x) => x.id === c.target)
  const items = target ? detailItems(target) : []
  const uses = (c.uses ?? []).map((u) => items.find((i) => i.id === u)?.label ?? u)
  const kind = [c.direction === 'two-way' ? 'mão dupla' : '', c.async ? 'assíncrona' : ''].filter(
    Boolean,
  )
  return [
    '',
    cell(name(c.source)),
    c.direction === 'two-way' ? '↔' : '→',
    cell(name(c.target)),
    c.protocol ? protocolLabels[c.protocol] : '',
    cell([c.label, ...kind].filter(Boolean).join('; ')),
    cell(uses.join(', ')),
    `\`${c.id}\``,
    '',
  ]
    .join(' | ')
    .trim()
}

/**
 * Resumo legível do cenário: diagrama Mermaid, componentes com seus detalhes, conexões e
 * notas. Pensado para documentação e para colar em prompts (inclui os ids).
 */
export function toMarkdown(s: Scenario): string {
  const lines = [`# ${s.name}`, '']
  if (s.description) lines.push(s.description, '')

  if (s.components.length > 0) {
    lines.push('## Diagrama', '', '```mermaid', toMermaid(s).trimEnd(), '```', '')
    lines.push('## Componentes', '')
    for (const c of s.components) lines.push(...componentSection(s, c))
  } else {
    lines.push('_Cenário vazio._', '')
  }

  if (s.connections.length > 0) {
    lines.push('## Conexões', '')
    lines.push('| De | | Para | Protocolo | Descrição | Usa | Id |')
    lines.push('| --- | --- | --- | --- | --- | --- | --- |')
    for (const c of s.connections) lines.push(connectionRow(s, c))
    lines.push('')
  }

  if (s.groups.length > 0) {
    lines.push('## Grupos', '')
    for (const g of s.groups) {
      const members = s.components.filter((c) => c.groupId === g.id).map((c) => c.name)
      lines.push(
        `- **${g.name}** \`${g.id}\`${members.length ? `: ${members.join(', ')}` : ''}${g.description ? ` — ${g.description}` : ''}`,
      )
    }
    lines.push('')
  }

  const notes = s.notes.filter((n) => n.text.trim())
  if (notes.length > 0) {
    lines.push('## Notas', '')
    for (const n of notes) lines.push(`- ${n.text.trim().replace(/\r?\n/g, ' ')}`)
    lines.push('')
  }
  return lines.join('\n')
}
