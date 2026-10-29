import { Lock, LockOpen, Plus, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import {
  componentCatalog,
  DETAIL_SECTIONS,
  detailCount,
  detailSectionInfo,
  HTTP_METHODS,
  type Component,
  type ComponentDetails,
  type DetailSection,
} from '../../core'
import { useEditor } from '../../store/editor'
import { CommitInput, CommitTextarea, Field, Select } from '../fields'
import { formatFields, parseFields, withFields } from './entityFields'
import { SectionTitle } from './Inspector'

const box =
  'min-w-0 rounded border border-slate-200 bg-surface px-1.5 py-0.5 text-[13px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400'
const compact = `${box} w-full`
const mono = `${compact} font-mono`
const methodOptions = HTTP_METHODS.map((m) => ({ value: m, label: m }))

/** Detalhes opcionais: só aparecem quando têm conteúdo; o resto vira um botão "+". */
export default function DetailSections({ component }: { component: Component }) {
  const { addDetailItem, updateComponentDetails } = useEditor.getState()
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [notesOpen, setNotesOpen] = useState(false)

  const id = component.id
  const d = component.details ?? {}
  const offered = componentCatalog[component.kind].sections
  const sections = DETAIL_SECTIONS.filter(
    (s) => offered.includes(s) || detailCount(component, s) > 0,
  )
  const filled = sections.filter((s) => detailCount(component, s) > 0)
  const empty = sections.filter((s) => detailCount(component, s) === 0)
  const showNotes = notesOpen || !!d.notes

  const save = (patch: ComponentDetails) => updateComponentDetails(id, patch)

  const add = (section: DetailSection) => {
    let newId: string | undefined
    if (section === 'routes') newId = addDetailItem(id, 'routes', { method: 'GET', path: '/' })
    if (section === 'entities') newId = addDetailItem(id, 'entities', { name: 'nova_tabela' })
    if (section === 'models') newId = addDetailItem(id, 'models', { name: 'modelo' })
    if (section === 'topics') newId = addDetailItem(id, 'topics', { name: 'novo-topico' })
    if (section === 'screens') newId = addDetailItem(id, 'screens', { name: 'Nova tela' })
    if (section === 'env') {
      const env = d.env ?? []
      const keys = new Set(env.map((e) => e.key))
      let key = 'NOVA_VARIAVEL'
      for (let n = 2; keys.has(key); n++) key = `NOVA_VARIAVEL_${n}`
      save({ env: [...env, { key }] })
      newId = `env:${env.length}`
    }
    if (newId) setFocusKey(`${section}:${newId}`)
  }
  const autoFocus = (section: DetailSection, key: string) => focusKey === `${section}:${key}`

  return (
    <div className="space-y-4 border-t border-slate-100 pt-4">
      {filled.map((section) => (
        <Section
          key={section}
          section={section}
          count={detailCount(component, section)}
          onAdd={() => add(section)}
        >
          {section === 'routes' &&
            d.routes?.map((r, i) => (
              <Row key={r.id} onRemove={() => save({ routes: without(d.routes!, i) })}>
                <div className="flex gap-1">
                  <Select
                    aria-label="Método"
                    value={r.method}
                    options={methodOptions}
                    onChange={(method) => save({ routes: replace(d.routes!, i, { ...r, method }) })}
                    className={`${box} w-[5.5rem] shrink-0 font-mono`}
                  />
                  <CommitInput
                    aria-label="Caminho"
                    value={r.path}
                    autoFocus={autoFocus('routes', r.id)}
                    onCommit={(path) => save({ routes: replace(d.routes!, i, { ...r, path }) })}
                    className={mono}
                  />
                </div>
                <CommitInput
                  aria-label="Descrição da rota"
                  value={r.description ?? ''}
                  placeholder="descrição (opcional)"
                  onCommit={(description) =>
                    save({
                      routes: replace(d.routes!, i, withOptional(r, 'description', description)),
                    })
                  }
                  className={compact}
                />
              </Row>
            ))}

          {section === 'entities' &&
            d.entities?.map((e, i) => (
              <Row key={e.id} onRemove={() => save({ entities: without(d.entities!, i) })}>
                <CommitInput
                  aria-label="Nome da tabela"
                  value={e.name}
                  autoFocus={autoFocus('entities', e.id)}
                  onCommit={(name) => save({ entities: replace(d.entities!, i, { ...e, name }) })}
                  className={mono}
                />
                <CommitInput
                  aria-label="Campos"
                  value={formatFields(e)}
                  placeholder="campos: id: uuid pk, user_id: uuid fk users.id (opcional)"
                  onCommit={(text) =>
                    save({
                      entities: replace(
                        d.entities!,
                        i,
                        withFields(e, parseFields(text, d.entities)),
                      ),
                    })
                  }
                  className={compact}
                />
              </Row>
            ))}

          {section === 'models' &&
            d.models?.map((m, i) => (
              <Row key={m.id} onRemove={() => save({ models: without(d.models!, i) })}>
                <CommitInput
                  aria-label="Nome do modelo"
                  value={m.name}
                  autoFocus={autoFocus('models', m.id)}
                  onCommit={(name) => save({ models: replace(d.models!, i, { ...m, name }) })}
                  className={mono}
                />
                <CommitInput
                  aria-label="Finalidade"
                  value={m.purpose ?? ''}
                  placeholder="para quê? (opcional)"
                  onCommit={(purpose) =>
                    save({ models: replace(d.models!, i, withOptional(m, 'purpose', purpose)) })
                  }
                  className={compact}
                />
              </Row>
            ))}

          {section === 'topics' &&
            d.topics?.map((t, i) => (
              <Row key={t.id} onRemove={() => save({ topics: without(d.topics!, i) })}>
                <CommitInput
                  aria-label="Nome do tópico"
                  value={t.name}
                  autoFocus={autoFocus('topics', t.id)}
                  onCommit={(name) => save({ topics: replace(d.topics!, i, { ...t, name }) })}
                  className={mono}
                />
              </Row>
            ))}

          {section === 'screens' &&
            d.screens?.map((t, i) => (
              <Row key={t.id} onRemove={() => save({ screens: without(d.screens!, i) })}>
                <CommitInput
                  aria-label="Nome da tela"
                  value={t.name}
                  autoFocus={autoFocus('screens', t.id)}
                  onCommit={(name) => save({ screens: replace(d.screens!, i, { ...t, name }) })}
                  className={compact}
                />
                <CommitInput
                  aria-label="Caminho da tela"
                  value={t.path ?? ''}
                  placeholder="caminho, ex.: /login (opcional)"
                  onCommit={(path) =>
                    save({ screens: replace(d.screens!, i, withOptional(t, 'path', path)) })
                  }
                  className={mono}
                />
              </Row>
            ))}

          {section === 'env' &&
            d.env?.map((v, i) => (
              <Row key={i} onRemove={() => save({ env: without(d.env!, i) })}>
                <div className="flex items-center gap-1">
                  <CommitInput
                    aria-label="Nome da variável"
                    value={v.key}
                    autoFocus={autoFocus('env', `env:${i}`)}
                    onCommit={(key) => save({ env: replace(d.env!, i, { ...v, key }) })}
                    className={mono}
                  />
                  <button
                    type="button"
                    title={v.secret ? 'Segredo: o valor não é guardado' : 'Marcar como segredo'}
                    aria-label="Alternar segredo"
                    onClick={() =>
                      // Segredos nunca guardam valor, para não vazar em exports.
                      save({
                        env: replace(
                          d.env!,
                          i,
                          v.secret ? omit(v, 'secret') : { ...omit(v, 'value'), secret: true },
                        ),
                      })
                    }
                    className={`shrink-0 rounded p-1 ${v.secret ? 'text-amber-600' : 'text-slate-400'} hover:bg-slate-100`}
                  >
                    {v.secret ? <Lock size={13} /> : <LockOpen size={13} />}
                  </button>
                </div>
                {v.secret ? (
                  <p className="px-1.5 text-[12px] text-slate-400 italic">
                    segredo (valor não armazenado)
                  </p>
                ) : (
                  <CommitInput
                    aria-label="Valor"
                    value={v.value ?? ''}
                    placeholder="valor (opcional)"
                    onCommit={(value) =>
                      save({ env: replace(d.env!, i, withOptional(v, 'value', value)) })
                    }
                    className={compact}
                  />
                )}
                <CommitInput
                  aria-label="Descrição da variável"
                  value={v.description ?? ''}
                  placeholder="para que serve / de onde vem (opcional)"
                  onCommit={(description) =>
                    save({ env: replace(d.env!, i, withOptional(v, 'description', description)) })
                  }
                  className={compact}
                />
              </Row>
            ))}
        </Section>
      ))}

      {showNotes && (
        <Field label="Anotações">
          <CommitTextarea
            value={d.notes ?? ''}
            autoFocus={notesOpen && !d.notes}
            placeholder="Qualquer observação sobre este componente"
            onCommit={(notes) => {
              save({ notes })
              setNotesOpen(false)
            }}
          />
        </Field>
      )}

      {(empty.length > 0 || !showNotes) && (
        <div className="space-y-2">
          <SectionTitle>Adicionar detalhes</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {empty.map((section) => (
              <Chip key={section} onClick={() => add(section)}>
                {detailSectionInfo[section].label}
              </Chip>
            ))}
            {!showNotes && <Chip onClick={() => setNotesOpen(true)}>Anotações</Chip>}
          </div>
        </div>
      )}
    </div>
  )
}

function Section(props: {
  section: DetailSection
  count: number
  onAdd: () => void
  children: ReactNode
}) {
  const info = detailSectionInfo[props.section]
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <SectionTitle>
          {info.label} <span className="font-normal text-slate-400">({props.count})</span>
        </SectionTitle>
        <button
          type="button"
          title={`Adicionar ${info.singular}`}
          aria-label={`Adicionar ${info.singular}`}
          onClick={props.onAdd}
          className="rounded p-1 text-slate-500 hover:bg-slate-100"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="space-y-1.5">{props.children}</div>
    </section>
  )
}

function Row({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <div className="group flex items-start gap-1 rounded-md bg-slate-50 p-1.5">
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
      <button
        type="button"
        title="Remover"
        aria-label="Remover"
        onClick={onRemove}
        className="rounded p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-200 hover:text-slate-700 focus:opacity-100"
      >
        <X size={13} />
      </button>
    </div>
  )
}

function Chip({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs text-slate-600 hover:border-slate-400 hover:bg-slate-50"
    >
      <Plus size={12} />
      {children}
    </button>
  )
}

// --- auxiliares de listas imutáveis -------------------------------------------------

const replace = <T,>(list: T[], i: number, item: T) => list.map((x, j) => (j === i ? item : x))
const without = <T,>(list: T[], i: number) => list.filter((_, j) => j !== i)

function withOptional<T extends object, K extends keyof T>(item: T, key: K, value: string): T {
  const next = { ...item }
  if (value.trim()) next[key] = value.trim() as T[K]
  else delete next[key]
  return next
}

function omit<T extends object, K extends keyof T>(item: T, key: K): T {
  const next = { ...item }
  delete next[key]
  return next
}
