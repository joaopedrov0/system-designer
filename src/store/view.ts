import { useSyncExternalStore } from 'react'
import { create } from 'zustand'

export type ThemePreference = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

/** Mesma chave lida pelo script em index.html (aplica o tema antes da primeira pintura). */
const THEME_KEY = 'system-designer:theme'

function readTheme(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

/** Modos de visualização: não fazem parte do cenário nem do histórico de undo. */
interface ViewState {
  /** Sinais animados percorrendo as conexões. */
  flow: boolean
  /** Laser: desenho temporário que some sozinho, para apontar algo. */
  laser: boolean
  /** Preferência de tema (salva só neste navegador). */
  theme: ThemePreference
  /**
   * O diagrama interno de um componente está em uso (último clique foi nele): o teclado é
   * dele, e o Delete do canvas principal fica desligado para não apagar o componente.
   */
  subdiagramActive: boolean
  toggleFlow: () => void
  setLaser: (on: boolean) => void
  setTheme: (theme: ThemePreference) => void
  setSubdiagramActive: (active: boolean) => void
}

export const useView = create<ViewState>()((set) => ({
  flow: false,
  laser: false,
  theme: readTheme(),
  subdiagramActive: false,
  setSubdiagramActive: (subdiagramActive) => set({ subdiagramActive }),
  toggleFlow: () => set((s) => ({ flow: !s.flow })),
  setLaser: (laser) => set({ laser }),
  setTheme: (theme) => {
    try {
      if (theme === 'system') localStorage.removeItem(THEME_KEY)
      else localStorage.setItem(THEME_KEY, theme)
    } catch {
      // Sem armazenamento (aba privada, bloqueio): vale só para esta sessão.
    }
    set({ theme })
  },
}))

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

function subscribeSystemTheme(onChange: () => void) {
  const query = darkQuery()
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** Tema efetivo: a preferência, ou o do sistema operacional quando for "system". */
export function useResolvedTheme(): Theme {
  const preference = useView((s) => s.theme)
  const systemDark = useSyncExternalStore(subscribeSystemTheme, () => darkQuery().matches)
  if (preference !== 'system') return preference
  return systemDark ? 'dark' : 'light'
}
