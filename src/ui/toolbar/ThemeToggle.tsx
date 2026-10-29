import { Monitor, Moon, Sun } from 'lucide-react'
import { useView, type ThemePreference } from '../../store/view'

const next: Record<ThemePreference, ThemePreference> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
}
const labels: Record<ThemePreference, string> = {
  system: 'Tema: do sistema',
  light: 'Tema: claro',
  dark: 'Tema: escuro',
}
const icons = { system: Monitor, light: Sun, dark: Moon }

/** Alterna entre tema do sistema, claro e escuro. */
export default function ThemeToggle() {
  const theme = useView((s) => s.theme)
  const setTheme = useView((s) => s.setTheme)
  const Icon = icons[theme]
  const label = `${labels[theme]} (clique para mudar)`
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => setTheme(next[theme])}
      className="rounded p-1.5 text-slate-600 hover:bg-slate-100 max-md:flex max-md:min-h-11 max-md:min-w-11 max-md:items-center max-md:justify-center"
    >
      <Icon size={16} />
    </button>
  )
}
