import { temporal } from 'zundo'
import { create } from 'zustand'
import {
  addComponent,
  addDetailItem,
  addGroup,
  addNote,
  applyLayout,
  connect,
  createScenario,
  moveElements,
  removeElements,
  renameScenario,
  resizeElement,
  reverseConnection,
  setComponentExpanded,
  updateComponent,
  updateComponentDetails,
  updateConnection,
  updateGroup,
  updateNote,
  updateScenarioDescription,
  type AddComponentInput,
  type ComponentDetails,
  type ComponentPatch,
  type ConnectInput,
  type ConnectionPatch,
  type ComponentKind,
  type ElementIds,
  type Group,
  type Move,
  type Rect,
  type ItemSection,
  type NewDetailItem,
  type Point,
  type Scenario,
} from '../core'

export type SaveStatus = 'saved' | 'pending' | 'error'

export interface Selection {
  componentIds: string[]
  connectionIds: string[]
  groupIds: string[]
  noteIds: string[]
}

export interface SearchState {
  text: string
  kind: ComponentKind | 'all'
}

interface EditorState {
  /** Único dado com histórico de undo/redo. */
  scenario: Scenario
  saveStatus: SaveStatus
  lastError: string | null
  /** Espelho da seleção do canvas (sem histórico). */
  selection: Selection
  /** Busca/filtro do canvas (sem histórico). */
  search: SearchState

  /** Troca o cenário aberto e zera o histórico. */
  open: (scenario: Scenario) => void
  setSaveStatus: (status: SaveStatus) => void
  clearError: () => void
  /** Mostra um erro de uma operação fora dos commands (importar, exportar, abrir...). */
  showError: (error: unknown) => void
  setSelection: (selection: Selection) => void
  setSearch: (search: Partial<SearchState>) => void

  addComponent: (input: AddComponentInput) => string | undefined
  updateComponent: (id: string, patch: ComponentPatch) => void
  moveElements: (moves: Move[]) => void
  resizeElement: (id: string, rect: Rect) => void
  applyLayout: (
    positions: Record<string, Point>,
    sizes?: Record<string, { w: number; h: number }>,
  ) => void
  removeElements: (ids: ElementIds) => void
  addGroup: (input: { layout: Rect; name?: string }) => string | undefined
  updateGroup: (id: string, patch: Partial<Pick<Group, 'name' | 'description'>>) => void
  addNote: (input: { layout: Point & Partial<Rect>; text?: string }) => string | undefined
  updateNote: (id: string, text: string) => void
  connect: (input: ConnectInput) => string | undefined
  renameScenario: (name: string) => void
  updateScenarioDescription: (description: string) => void
  updateConnection: (id: string, patch: ConnectionPatch) => void
  reverseConnection: (id: string) => void
  addDetailItem: <S extends ItemSection>(
    componentId: string,
    section: S,
    item: NewDetailItem[S],
  ) => string | undefined
  updateComponentDetails: (componentId: string, patch: ComponentDetails) => void
  setComponentExpanded: (id: string, expanded: boolean) => void
}

export const emptySelection: Selection = {
  componentIds: [],
  connectionIds: [],
  groupIds: [],
  noteIds: [],
}

export const useEditor = create<EditorState>()(
  temporal(
    (set, get) => {
      /** Aplica um command do core; erros viram `lastError` em vez de quebrar a UI. */
      function apply<T>(run: (s: Scenario) => { scenario: Scenario; result: T }): T | undefined {
        try {
          const { scenario, result } = run(get().scenario)
          set({ scenario, lastError: null })
          return result
        } catch (err) {
          set({ lastError: err instanceof Error ? err.message : String(err) })
          return undefined
        }
      }
      const update = (run: (s: Scenario) => Scenario) =>
        apply((s) => ({ scenario: run(s), result: undefined }))

      return {
        scenario: createScenario('Meu sistema'),
        saveStatus: 'saved',
        lastError: null,
        selection: emptySelection,
        search: { text: '', kind: 'all' },

        open: (scenario) => {
          set({ scenario, lastError: null, saveStatus: 'saved', selection: emptySelection })
          useEditor.temporal.getState().clear()
        },
        setSaveStatus: (saveStatus) => set({ saveStatus }),
        clearError: () => set({ lastError: null }),
        showError: (error) =>
          set({ lastError: error instanceof Error ? error.message : String(error) }),
        setSelection: (selection) => set({ selection }),
        setSearch: (search) => set({ search: { ...get().search, ...search } }),

        addComponent: (input) =>
          apply((s) => {
            const r = addComponent(s, input)
            return { scenario: r.scenario, result: r.id }
          }),
        updateComponent: (id, patch) => update((s) => updateComponent(s, id, patch)),
        moveElements: (moves) => update((s) => moveElements(s, moves)),
        resizeElement: (id, rect) => update((s) => resizeElement(s, id, rect)),
        applyLayout: (positions, sizes) => update((s) => applyLayout(s, positions, sizes)),
        addGroup: (input) =>
          apply((s) => {
            const r = addGroup(s, input)
            return { scenario: r.scenario, result: r.id }
          }),
        updateGroup: (id, patch) => update((s) => updateGroup(s, id, patch)),
        addNote: (input) =>
          apply((s) => {
            const r = addNote(s, input)
            return { scenario: r.scenario, result: r.id }
          }),
        updateNote: (id, text) => update((s) => updateNote(s, id, text)),
        removeElements: (ids) => update((s) => removeElements(s, ids)),
        connect: (input) =>
          apply((s) => {
            const r = connect(s, input)
            return { scenario: r.scenario, result: r.id }
          }),
        renameScenario: (name) => update((s) => renameScenario(s, name)),
        updateScenarioDescription: (description) =>
          update((s) => updateScenarioDescription(s, description)),
        updateConnection: (id, patch) => update((s) => updateConnection(s, id, patch)),
        reverseConnection: (id) => update((s) => reverseConnection(s, id)),
        addDetailItem: (componentId, section, item) =>
          apply((s) => {
            const r = addDetailItem(s, componentId, section, item)
            return { scenario: r.scenario, result: r.id }
          }),
        updateComponentDetails: (componentId, patch) =>
          update((s) => updateComponentDetails(s, componentId, patch)),
        setComponentExpanded: (id, expanded) =>
          update((s) => setComponentExpanded(s, id, expanded)),
      }
    },
    {
      partialize: (state) => ({ scenario: state.scenario }),
      // Só registra histórico quando o cenário muda de fato (status, erros etc. não contam).
      equality: (a, b) => a.scenario === b.scenario,
      limit: 200,
    },
  ),
)

export const undo = () => useEditor.temporal.getState().undo()
export const redo = () => useEditor.temporal.getState().redo()
